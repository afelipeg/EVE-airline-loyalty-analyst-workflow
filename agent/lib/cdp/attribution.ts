import { TODAY, addDays, bookings, daysBetween, getNetworkSnapshot, type Booking } from "../aeromexico-data";
import { getIdentityGraph } from "./identity";
import { CAMPAIGNS, WINDOW_START, getCdpSources, isHoldout, type DigitalChannel } from "./sources";

// Multi-touch attribution of revenue to channels, then to RASK. ASK is fixed:
// a channel's RASK contribution is the revenue it is credited with divided by
// the same network ASK getNetworkSnapshot() uses, so the channels add up to
// the slice of network RASK that came from bookings made in the window.
//
// Only touches identity resolution tied to the booking member count, within
// LOOKBACK_DAYS before the booking date. A booking with no resolved touch is
// credited to the channel it was booked in (call center, OTA, or direct
// web/app with no tracked touch).

export type AttributionModel = "last_touch" | "linear" | "position_based";
export type AttributionChannel =
  | DigitalChannel
  | "web_organic"
  | "app_organic"
  | "direct_web"
  | "direct_app"
  | "call_center"
  | "ota";

export const ATTRIBUTION_MODELS: readonly AttributionModel[] = ["last_touch", "linear", "position_based"];
const LOOKBACK_DAYS = 30;

type Touch = { readonly date: string; readonly channel: AttributionChannel; readonly campaignId?: string };
type Conversion = {
  readonly bookingId: string;
  readonly memberId: string;
  readonly bookingDate: string;
  readonly revenueMxn: number;
  readonly touches: readonly Touch[];
  readonly fallback: AttributionChannel;
};

const round = (value: number, digits = 0) => Math.round(value * 10 ** digits) / 10 ** digits;
const share = (part: number, whole: number) => (whole === 0 ? 0 : round((part / whole) * 100, 1));

function touchesByMember(): Map<string, Touch[]> {
  const sources = getCdpSources();
  const graph = getIdentityGraph();
  const byMember = new Map<string, Touch[]>();
  const add = (memberId: string | null | undefined, touch: Touch) => {
    if (!memberId) return;
    byMember.set(memberId, [...(byMember.get(memberId) ?? []), touch]);
  };

  // Campaign touches count when opened (an unopened send never reached anyone).
  for (const send of sources.sends) {
    if (!send.opened || !send.openDate) continue;
    add(graph.resolutions.get(send.sendId)?.memberId, { date: send.openDate, channel: send.channel, campaignId: send.campaignId });
  }
  // Organic sessions: one touch per session, unless it landed from a campaign
  // (that click is already the campaign's touch) or is the purchase session
  // itself (the conversion, not a touch toward it).
  const sessions = new Map<string, { date: string; source: "web" | "app"; campaign: boolean; purchase: boolean; memberId: string | null }>();
  for (const event of sources.events) {
    const memberId = graph.resolutions.get(event.eventId)?.memberId ?? null;
    const current = sessions.get(event.sessionId);
    sessions.set(event.sessionId, {
      date: event.date,
      source: event.source,
      campaign: (current?.campaign ?? false) || event.campaignId !== undefined,
      purchase: (current?.purchase ?? false) || event.type === "purchase",
      memberId: current?.memberId ?? memberId,
    });
  }
  for (const session of sessions.values()) {
    if (session.campaign || session.purchase) continue;
    add(session.memberId, { date: session.date, channel: session.source === "web" ? "web_organic" : "app_organic" });
  }
  return byMember;
}

function buildConversions(): readonly Conversion[] {
  const sources = getCdpSources();
  const bookingById = new Map<string, Booking>(bookings.map((b) => [b.bookingId, b]));
  const touches = touchesByMember();
  return sources.reservations
    .filter((r) => r.bookingDate >= WINDOW_START && r.bookingDate <= TODAY)
    .map((reservation) => {
      const booking = bookingById.get(reservation.bookingId)!;
      const inLookback = (touches.get(reservation.memberId) ?? [])
        .filter((t) => t.date <= reservation.bookingDate && daysBetween(t.date, reservation.bookingDate) <= LOOKBACK_DAYS)
        .sort((a, b) => a.date.localeCompare(b.date));
      const fallback: AttributionChannel =
        booking.bookedChannel === "web" ? "direct_web" : booking.bookedChannel === "app" ? "direct_app" : booking.bookedChannel;
      return {
        bookingId: reservation.bookingId,
        memberId: reservation.memberId,
        bookingDate: reservation.bookingDate,
        revenueMxn: booking.fareMxn + booking.ancillaryMxn,
        touches: inLookback,
        fallback,
      };
    });
}

function credits(conversion: Conversion, model: AttributionModel): readonly { touch: Touch | null; weight: number }[] {
  const t = conversion.touches;
  if (t.length === 0) return [{ touch: null, weight: 1 }];
  if (model === "last_touch") return [{ touch: t[t.length - 1], weight: 1 }];
  if (model === "linear" || t.length === 1) return t.map((touch) => ({ touch, weight: 1 / t.length }));
  if (t.length === 2) return t.map((touch) => ({ touch, weight: 0.5 }));
  // Position-based: 40% first, 40% last, 20% spread over the middle.
  return t.map((touch, index) => ({
    touch,
    weight: index === 0 || index === t.length - 1 ? 0.4 : 0.2 / (t.length - 2),
  }));
}

let cachedConversions: readonly Conversion[] | null = null;
const conversions = () => (cachedConversions ??= buildConversions());

export function getAttribution(model: AttributionModel = "position_based") {
  const network = getNetworkSnapshot();
  const askKm = network.askMillions * 1_000_000;
  const all = conversions();
  const totalRevenue = all.reduce((sum, c) => sum + c.revenueMxn, 0);

  const channelAgg = new Map<AttributionChannel, { conversions: number; revenue: number }>();
  const campaignAgg = new Map<string, { conversions: number; revenue: number }>();
  for (const conversion of all) {
    for (const { touch, weight } of credits(conversion, model)) {
      const channel = touch?.channel ?? conversion.fallback;
      const entry = channelAgg.get(channel) ?? { conversions: 0, revenue: 0 };
      entry.conversions += weight;
      entry.revenue += weight * conversion.revenueMxn;
      channelAgg.set(channel, entry);
      if (touch?.campaignId) {
        const campaign = campaignAgg.get(touch.campaignId) ?? { conversions: 0, revenue: 0 };
        campaign.conversions += weight;
        campaign.revenue += weight * conversion.revenueMxn;
        campaignAgg.set(touch.campaignId, campaign);
      }
    }
  }

  const byChannel = [...channelAgg]
    .map(([channel, agg]) => ({
      channel,
      conversions: round(agg.conversions, 2),
      revenueMxn: round(agg.revenue),
      raskMxn: round(agg.revenue / askKm, 4),
      revenueSharePct: share(agg.revenue, totalRevenue),
    }))
    .sort((a, b) => b.revenueMxn - a.revenueMxn);

  const sources = getCdpSources();
  const byCampaign = CAMPAIGNS.map((campaign) => {
    const sends = sources.sends.filter((s) => s.campaignId === campaign.campaignId);
    const opens = sends.filter((s) => s.opened).length;
    const clicks = sends.filter((s) => s.clicked).length;
    const agg = campaignAgg.get(campaign.campaignId) ?? { conversions: 0, revenue: 0 };
    const costMxn = round(sends.length * campaign.costPerSendMxn, 2);
    return {
      campaignId: campaign.campaignId,
      name: campaign.name,
      channel: campaign.channel,
      sentDate: campaign.sentDate,
      sends: sends.length,
      opens,
      clicks,
      openRatePct: share(opens, sends.length),
      clickRatePct: share(clicks, sends.length),
      attributedConversions: round(agg.conversions, 2),
      attributedRevenueMxn: round(agg.revenue),
      raskMxn: round(agg.revenue / askKm, 4),
      costMxn,
      revenuePerPesoCost: costMxn === 0 ? 0 : round(agg.revenue / costMxn, 1),
    };
  });

  return {
    model,
    window: { start: WINDOW_START, end: TODAY, lookbackDays: LOOKBACK_DAYS },
    totals: {
      conversions: all.length,
      revenueMxn: round(totalRevenue),
      windowRaskMxn: round(totalRevenue / askKm, 4),
      networkRaskMxn: round(network.raskMxn, 4),
      windowShareOfNetworkRaskPct: share(totalRevenue / askKm, network.raskMxn),
      conversionsWithResolvedTouch: all.filter((c) => c.touches.length > 0).length,
    },
    byChannel,
    byCampaign,
    notes: [
      "RASK contribution = attributed revenue (fare + ancillary) / fixed network ASK. Channels add up to the window's slice of network RASK; loyalty does not add ASK.",
      "Shares and totals are computed here over every conversion in the window. Quote them as returned.",
    ],
  };
}

// Engagement funnel per channel, for the Sankey: sent -> opened -> clicked ->
// converted (a resolved conversion whose last touch was that channel).
export function getChannelFunnel() {
  const sources = getCdpSources();
  const lastTouch = getAttribution("last_touch").byChannel;
  return (["email", "push", "in_app"] as const).map((channel) => {
    const sends = sources.sends.filter((s) => s.channel === channel);
    return {
      channel,
      sent: sends.length,
      opened: sends.filter((s) => s.opened).length,
      clicked: sends.filter((s) => s.clicked).length,
      converted: round(lastTouch.find((c) => c.channel === channel)?.conversions ?? 0, 2),
    };
  });
}

// Treated vs holdout: bookings and revenue per member in the window. With 40
// members this is directional, and the output says so.
export function getHoldoutLift() {
  const sources = getCdpSources();
  const members = sources.crmContacts.map((c) => c.memberId);
  const group = (holdout: boolean) => {
    const ids = new Set(members.filter((m) => isHoldout(m) === holdout));
    const inGroup = conversions().filter((c) => ids.has(c.memberId));
    const revenue = inGroup.reduce((sum, c) => sum + c.revenueMxn, 0);
    return {
      members: ids.size,
      conversions: inGroup.length,
      conversionsPerMember: round(inGroup.length / (ids.size || 1), 2),
      revenuePerMemberMxn: round(revenue / (ids.size || 1)),
    };
  };
  const treated = group(false);
  const holdout = group(true);
  return {
    treated,
    holdout,
    revenuePerMemberLiftPct:
      holdout.revenuePerMemberMxn === 0 ? null : share(treated.revenuePerMemberMxn - holdout.revenuePerMemberMxn, holdout.revenuePerMemberMxn),
    caveat: `Directional only: ${holdout.members} holdout members vs ${treated.members} treated, no significance test at this size.`,
  };
}

// Weekly engagement per channel across the window, for the trend chart:
// campaign sends/opens/clicks by send channel, organic sessions by source.
export function getEngagementByWeek() {
  const sources = getCdpSources();
  const graph = getIdentityGraph();
  const weekOf = (date: string) => Math.min(12, Math.floor(daysBetween(WINDOW_START, date) / 7));
  const weeks = Array.from({ length: 13 }, (_, index) => ({
    week: index + 1,
    weekStart: addDays(WINDOW_START, index * 7),
    email: { sends: 0, opens: 0, clicks: 0 },
    push: { sends: 0, opens: 0, clicks: 0 },
    in_app: { sends: 0, opens: 0, clicks: 0 },
    webSessions: 0,
    appSessions: 0,
  }));
  for (const send of sources.sends) {
    const bucket = weeks[weekOf(send.sentDate)][send.channel];
    bucket.sends += 1;
    if (send.opened) bucket.opens += 1;
    if (send.clicked) bucket.clicks += 1;
  }
  const seen = new Set<string>();
  for (const event of sources.events) {
    if (seen.has(event.sessionId) || event.date < WINDOW_START || !graph.resolutions.get(event.eventId)?.memberId) continue;
    seen.add(event.sessionId);
    const week = weeks[weekOf(event.date)];
    if (event.source === "web") week.webSessions += 1;
    else week.appSessions += 1;
  }
  return weeks;
}

// "High engagement is not high RASK": each touch channel ranked by
// engagement volume (campaign opens + clicks, or resolved organic sessions)
// and by attributed RASK under the chosen model.
export function getEngagementVsRask(model: AttributionModel = "position_based") {
  const attribution = getAttribution(model).byChannel;
  const touchCounts = new Map<AttributionChannel, number>();
  for (const touches of touchesByMember().values()) {
    for (const touch of touches) touchCounts.set(touch.channel, (touchCounts.get(touch.channel) ?? 0) + 1);
  }
  const channels: readonly AttributionChannel[] = ["email", "push", "in_app", "web_organic", "app_organic"];
  const rows = channels.map((channel) => ({
    channel,
    engagements: touchCounts.get(channel) ?? 0,
    raskMxn: attribution.find((a) => a.channel === channel)?.raskMxn ?? 0,
  }));
  const rank = (key: "engagements" | "raskMxn") => {
    const ordered = [...rows].sort((a, b) => b[key] - a[key]).map((r) => r.channel);
    return (channel: AttributionChannel) => ordered.indexOf(channel) + 1;
  };
  const byEngagement = rank("engagements");
  const byRask = rank("raskMxn");
  return rows.map((r) => ({
    ...r,
    raskPerEngagementMxn: r.engagements === 0 ? 0 : round(r.raskMxn / r.engagements, 6),
    engagementRank: byEngagement(r.channel),
    raskRank: byRask(r.channel),
  }));
}

// The RASK driver tree for the impact map: RASK is the north star, load
// factor, yield and ancillary share are the levers (ASK is fixed, so they are
// the only ones), and campaigns hang off RASK by their attributed slice.
// Edge weights are attributed shares, not correlations.
export function getRaskDrivers(model: AttributionModel = "position_based") {
  const network = getNetworkSnapshot();
  const attribution = getAttribution(model);
  return {
    northStar: { raskMxn: round(network.raskMxn, 4), windowRaskMxn: attribution.totals.windowRaskMxn },
    levers: [
      { id: "load_factor", label: "Load factor", value: round(network.loadFactor * 100, 1), unit: "%" },
      { id: "yield", label: "Yield", value: round(network.yieldMxnPerKm, 3), unit: "MXN/km" },
      { id: "ancillary_share", label: "Ancillary share", value: round(network.ancillaryShare * 100, 1), unit: "%" },
    ],
    fixedAsk: { askMillions: round(network.askMillions, 3) },
    campaigns: attribution.byCampaign.map((campaign) => ({
      id: campaign.campaignId,
      name: campaign.name,
      channel: campaign.channel,
      raskMxn: campaign.raskMxn,
      shareOfWindowRaskPct: share(campaign.raskMxn, attribution.totals.windowRaskMxn),
      revenuePerPesoCost: campaign.revenuePerPesoCost,
    })),
    channels: attribution.byChannel.map((channel) => ({
      channel: channel.channel,
      raskMxn: channel.raskMxn,
      revenueSharePct: channel.revenueSharePct,
    })),
  };
}
