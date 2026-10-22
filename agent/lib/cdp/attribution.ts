import { TODAY, bookings, daysBetween, getNetworkSnapshot, type Booking } from "../aeromexico-data.js";
import { getIdentityGraph } from "./identity.js";
import { CAMPAIGNS, WINDOW_START, getCdpSources, isHoldout, type DigitalChannel } from "./sources.js";

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
