import { daysBetween } from "../aeromexico-data.js";
import {
  getCdpSources,
  hashEmail,
  normalizeEmail,
  normalizePhone,
  type AncillaryOrder,
  type CampaignSend,
  type DigitalEvent,
} from "./sources.js";

// Deterministic identity resolution. Rules fire in precision order and a lower
// tier never overrides a higher one:
//
//   1 member_id    the record carries the member number (signed-in event)
//   1 pnr          ancillary order or purchase -> reservation -> member
//   2 email_hash   normalized sha256(email) matches exactly one CRM member
//   2 phone        E.164 phone matches exactly one CRM member
//   3 device       app device signed in by exactly one member, within 30 days
//   3 cookie       web cookie signed in by exactly one member, within 30 days
//
// Guardrails (an over-merge is a breach, not a bug): a device or cookie seen
// signed in by two members is never used to link anonymous activity; an email
// that shows up on PNRs of two members, or a generic inbox, is blocked; no
// probabilistic matching or fingerprinting.

export type MatchRule = "member_id" | "pnr" | "email_hash" | "phone" | "device" | "cookie";
export type Resolution = { readonly memberId: string | null; readonly rule: MatchRule | null; readonly blockedBy?: string };
export type RecordKind = "event" | "send" | "ancillary_order";

const STITCH_WINDOW_DAYS = 30;
const GENERIC_LOCAL_PARTS = /^(reservas|info|contacto|admin|ventas|viajes|no-?reply)@/;

export type IdentityGraph = {
  readonly resolutions: ReadonlyMap<string, Resolution>;
  readonly clusters: ReadonlyMap<string, MemberCluster>;
  readonly guardrails: {
    readonly sharedDevices: readonly { readonly id: string; readonly memberIds: readonly string[] }[];
    readonly sharedCookies: readonly { readonly id: string; readonly memberIds: readonly string[] }[];
    readonly blockedEmails: readonly { readonly emailSha256: string; readonly reason: string }[];
    readonly pnrEmailConflicts: number;
  };
};

export type MemberCluster = {
  readonly memberId: string;
  readonly emailSha256: string;
  readonly phone: string;
  readonly devices: readonly string[];
  readonly cookies: readonly string[];
  readonly pnrs: readonly string[];
};

function buildGraph(): IdentityGraph {
  const sources = getCdpSources();

  const memberByEmail = new Map<string, string>();
  const memberByPhone = new Map<string, string>();
  for (const contact of sources.crmContacts) {
    memberByEmail.set(hashEmail(contact.email), contact.memberId);
    memberByPhone.set(normalizePhone(contact.phone), contact.memberId);
  }
  const reservationByPnr = new Map(sources.reservations.map((r) => [r.pnr, r]));
  const reservationByBooking = new Map(sources.reservations.map((r) => [r.bookingId, r]));

  // Blocked emails: generic inboxes, and any email used on PNRs of more than
  // one member (a travel agency or an assistant booking for several people).
  const membersPerOrderEmail = new Map<string, Set<string>>();
  const genericEmails = new Set<string>();
  for (const order of sources.ancillaryOrders) {
    if (!order.contactEmail) continue;
    const hashed = hashEmail(order.contactEmail);
    if (GENERIC_LOCAL_PARTS.test(normalizeEmail(order.contactEmail))) genericEmails.add(hashed);
    const owner = order.pnr ? reservationByPnr.get(order.pnr)?.memberId : undefined;
    if (!owner) continue;
    const set = membersPerOrderEmail.get(hashed) ?? new Set<string>();
    set.add(owner);
    membersPerOrderEmail.set(hashed, set);
  }
  const blockedEmails = new Map<string, string>();
  for (const hashed of genericEmails) blockedEmails.set(hashed, "generic inbox");
  for (const [hashed, owners] of membersPerOrderEmail) {
    if (owners.size > 1) blockedEmails.set(hashed, `used for ${owners.size} different members`);
  }

  // Who signed in on each device and cookie, and when.
  const signIns = (key: "deviceId" | "cookieId") => {
    const byId = new Map<string, Map<string, string[]>>();
    for (const event of sources.events) {
      const id = event[key];
      if (!id || !event.memberId) continue;
      const members = byId.get(id) ?? new Map<string, string[]>();
      members.set(event.memberId, [...(members.get(event.memberId) ?? []), event.date]);
      byId.set(id, members);
    }
    return byId;
  };
  const deviceSignIns = signIns("deviceId");
  const cookieSignIns = signIns("cookieId");
  const shared = (byId: Map<string, Map<string, string[]>>) =>
    [...byId].filter(([, members]) => members.size > 1).map(([id, members]) => ({ id, memberIds: [...members.keys()].sort() }));

  // A device/cookie links anonymous activity only if exactly one member ever
  // signed in on it, and only within STITCH_WINDOW_DAYS of one of those sign-ins.
  const stitch = (byId: Map<string, Map<string, string[]>>, id: string | undefined, date: string): string | null => {
    const members = id ? byId.get(id) : undefined;
    if (!members || members.size !== 1) return null;
    const [[memberId, dates]] = [...members];
    return dates.some((d) => Math.abs(daysBetween(d, date)) <= STITCH_WINDOW_DAYS) ? memberId : null;
  };

  const resolutions = new Map<string, Resolution>();
  const viaEmail = (raw: string | undefined, hashed?: string): Resolution | null => {
    const key = hashed ?? (raw ? hashEmail(raw) : undefined);
    if (!key) return null;
    if (blockedEmails.has(key)) return { memberId: null, rule: null, blockedBy: `email blocked: ${blockedEmails.get(key)}` };
    const memberId = memberByEmail.get(key);
    return memberId ? { memberId, rule: "email_hash" } : null;
  };

  const resolveEvent = (event: DigitalEvent): Resolution => {
    if (event.memberId) return { memberId: event.memberId, rule: "member_id" };
    if (event.bookingId) {
      const reservation = reservationByBooking.get(event.bookingId);
      if (reservation) return { memberId: reservation.memberId, rule: "pnr" };
    }
    if (event.deviceId) {
      const memberId = stitch(deviceSignIns, event.deviceId, event.date);
      if (memberId) return { memberId, rule: "device" };
      if ((deviceSignIns.get(event.deviceId)?.size ?? 0) > 1) return { memberId: null, rule: null, blockedBy: "shared device" };
    }
    if (event.cookieId) {
      const memberId = stitch(cookieSignIns, event.cookieId, event.date);
      if (memberId) return { memberId, rule: "cookie" };
      if ((cookieSignIns.get(event.cookieId)?.size ?? 0) > 1) return { memberId: null, rule: null, blockedBy: "shared cookie" };
    }
    return { memberId: null, rule: null };
  };

  const resolveSend = (send: CampaignSend): Resolution => {
    if (send.emailSha256) return viaEmail(undefined, send.emailSha256) ?? { memberId: null, rule: null };
    const memberId = stitch(deviceSignIns, send.deviceId, send.sentDate);
    if (memberId) return { memberId, rule: "device" };
    return (deviceSignIns.get(send.deviceId ?? "")?.size ?? 0) > 1
      ? { memberId: null, rule: null, blockedBy: "shared device" }
      : { memberId: null, rule: null };
  };

  let pnrEmailConflicts = 0;
  const resolveOrder = (order: AncillaryOrder): Resolution => {
    const byPnr = order.pnr ? reservationByPnr.get(order.pnr)?.memberId : undefined;
    const byEmail = viaEmail(order.contactEmail);
    if (byPnr) {
      if (byEmail?.memberId && byEmail.memberId !== byPnr) pnrEmailConflicts += 1;
      return { memberId: byPnr, rule: "pnr" };
    }
    if (byEmail) return byEmail;
    const byPhone = order.contactPhone ? memberByPhone.get(normalizePhone(order.contactPhone)) : undefined;
    return byPhone ? { memberId: byPhone, rule: "phone" } : { memberId: null, rule: null };
  };

  for (const event of sources.events) resolutions.set(event.eventId, resolveEvent(event));
  for (const send of sources.sends) resolutions.set(send.sendId, resolveSend(send));
  for (const order of sources.ancillaryOrders) resolutions.set(order.orderId, resolveOrder(order));

  // Clusters: the identifiers each member's profile ends up holding.
  const clusters = new Map<string, MemberCluster>();
  for (const contact of sources.crmContacts) {
    const linked = (byId: Map<string, Map<string, string[]>>) =>
      [...byId].filter(([, members]) => members.size === 1 && members.has(contact.memberId)).map(([id]) => id);
    clusters.set(contact.memberId, {
      memberId: contact.memberId,
      emailSha256: hashEmail(contact.email),
      phone: normalizePhone(contact.phone),
      devices: linked(deviceSignIns),
      cookies: linked(cookieSignIns),
      pnrs: sources.reservations.filter((r) => r.memberId === contact.memberId).map((r) => r.pnr),
    });
  }

  return {
    resolutions,
    clusters,
    guardrails: {
      sharedDevices: shared(deviceSignIns),
      sharedCookies: shared(cookieSignIns),
      blockedEmails: [...blockedEmails].map(([emailSha256, reason]) => ({ emailSha256, reason })),
      pnrEmailConflicts,
    },
  };
}

let cached: IdentityGraph | null = null;
export function getIdentityGraph(): IdentityGraph {
  return (cached ??= buildGraph());
}

export function resolveRecord(recordId: string): Resolution {
  return getIdentityGraph().resolutions.get(recordId) ?? { memberId: null, rule: null };
}

const share = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

// Coverage per source and the funnel the UI and the cdp-analyst quote.
export function getIdentitySummary() {
  const sources = getCdpSources();
  const graph = getIdentityGraph();
  const bySource = (kind: string, ids: readonly string[]) => {
    const rules: Record<string, number> = {};
    let resolved = 0;
    let blocked = 0;
    for (const id of ids) {
      const resolution = graph.resolutions.get(id);
      if (resolution?.memberId) {
        resolved += 1;
        rules[resolution.rule!] = (rules[resolution.rule!] ?? 0) + 1;
      } else if (resolution?.blockedBy) {
        blocked += 1;
      }
    }
    return { source: kind, records: ids.length, resolved, resolvedSharePct: share(resolved, ids.length), blockedByGuardrail: blocked, byRule: rules };
  };

  const webEvents = sources.events.filter((e) => e.source === "web").map((e) => e.eventId);
  const appEvents = sources.events.filter((e) => e.source === "app").map((e) => e.eventId);
  const allIds = [...sources.events.map((e) => e.eventId), ...sources.sends.map((s) => s.sendId), ...sources.ancillaryOrders.map((o) => o.orderId)];
  const resolvedMembers = new Set([...graph.resolutions.values()].map((r) => r.memberId).filter(Boolean));
  const profiles = new Set(sources.crmContacts.map((c) => c.memberId));
  const resolvedTotal = allIds.filter((id) => graph.resolutions.get(id)?.memberId).length;

  // Over-merge check: any device or cookie held by two clusters is a breach.
  const holders = new Map<string, number>();
  for (const cluster of graph.clusters.values()) {
    for (const id of [...cluster.devices, ...cluster.cookies]) holders.set(id, (holders.get(id) ?? 0) + 1);
  }
  const overMerges = [...holders.values()].filter((count) => count > 1).length;

  return {
    window: { days: 90 },
    funnel: {
      records: allIds.length,
      resolvedRecords: resolvedTotal,
      resolvedSharePct: share(resolvedTotal, allIds.length),
      crmProfiles: profiles.size,
      profilesWithDigitalActivity: resolvedMembers.size,
    },
    bySource: [
      bySource("web", webEvents),
      bySource("app", appEvents),
      bySource("esp_sends", sources.sends.map((s) => s.sendId)),
      bySource("ancillary_orders", sources.ancillaryOrders.map((o) => o.orderId)),
    ],
    guardrails: {
      sharedDevices: graph.guardrails.sharedDevices,
      sharedCookies: graph.guardrails.sharedCookies,
      blockedEmails: graph.guardrails.blockedEmails.length,
      blockedEmailReasons: graph.guardrails.blockedEmails.map((b) => b.reason),
      pnrEmailConflicts: graph.guardrails.pnrEmailConflicts,
      overMerges,
    },
  };
}
