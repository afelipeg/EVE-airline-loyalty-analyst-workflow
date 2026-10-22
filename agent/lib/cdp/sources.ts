import { createHash } from "node:crypto";

import {
  TODAY,
  addDays,
  bookings,
  cdpProfiles,
  crmMembers,
  daysBetween,
  getUnifiedMembers,
  mulberry32,
  weightedPick,
  type Booking,
  type CdpProfile,
} from "../aeromexico-data";

// Synthetic input systems for the CDP. Each one only carries the identifiers
// that system would really have, so identity.ts has to stitch them:
//
//   CRM            memberId, email, phone            (system of record)
//   Reservations   PNR, bookingId, memberId          (who booked what)
//   Ancillaries    PNR, contact email and/or phone   (NO memberId)
//   ESP sends      sha256(email) or app deviceId     (email, push, in-app)
//   Web            cookieId; memberId only after login
//   App            deviceId; memberId only while signed in
//
// Generation is deterministic (seeded mulberry32), so every figure the agent
// quotes is reproducible. The true owner of every record is kept apart in
// GROUND_TRUTH for the evals; identity.ts never reads it.

export const WINDOW_DAYS = 90;
export const WINDOW_START = addDays(TODAY, -WINDOW_DAYS);
const SEED = 20_260_718;

export type DigitalChannel = "email" | "push" | "in_app";
export type EventSource = "web" | "app";
export type EventType =
  | "page_view"
  | "login"
  | "search_flight"
  | "select_fare"
  | "view_ancillary"
  | "checkout_start"
  | "purchase"
  | "email_click"
  | "push_open"
  | "in_app_open";

export type CrmContact = { readonly memberId: string; readonly email: string; readonly phone: string };
export type Reservation = {
  readonly pnr: string;
  readonly bookingId: string;
  readonly memberId: string;
  readonly bookingDate: string;
};
export type Campaign = {
  readonly campaignId: string;
  readonly name: string;
  readonly channel: DigitalChannel;
  readonly sentDate: string;
  readonly costPerSendMxn: number;
};
export type CampaignSend = {
  readonly sendId: string;
  readonly campaignId: string;
  readonly channel: DigitalChannel;
  readonly sentDate: string;
  readonly emailSha256?: string;
  readonly deviceId?: string;
  readonly opened: boolean;
  readonly clicked: boolean;
  readonly openDate?: string;
};
export type DigitalEvent = {
  readonly eventId: string;
  readonly source: EventSource;
  readonly sessionId: string;
  readonly type: EventType;
  readonly date: string;
  readonly cookieId?: string;
  readonly deviceId?: string;
  readonly memberId?: string;
  readonly route?: string;
  readonly bookingId?: string;
  readonly campaignId?: string;
};
export type AncillaryItem = { readonly type: "seat" | "bag" | "lounge" | "upgrade"; readonly amountMxn: number };
export type AncillaryOrder = {
  readonly orderId: string;
  /** Absent for standalone purchases (airport lounge pass, kiosk bag). */
  readonly pnr?: string;
  readonly orderDate: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly items: readonly AncillaryItem[];
  readonly amountMxn: number;
};

export const CAMPAIGNS: readonly Campaign[] = [
  { campaignId: "CMP-01", name: "Doble Puntos Premier", channel: "email", sentDate: addDays(TODAY, -80), costPerSendMxn: 0.4 },
  { campaignId: "CMP-02", name: "Upgrade a Premier", channel: "push", sentDate: addDays(TODAY, -70), costPerSendMxn: 0.1 },
  { campaignId: "CMP-03", name: "Equipaje y asiento", channel: "in_app", sentDate: addDays(TODAY, -60), costPerSendMxn: 0.05 },
  { campaignId: "CMP-04", name: "Reactivacion Elite", channel: "email", sentDate: addDays(TODAY, -45), costPerSendMxn: 0.4 },
  { campaignId: "CMP-05", name: "Ruta MEX-JFK", channel: "push", sentDate: addDays(TODAY, -30), costPerSendMxn: 0.1 },
  { campaignId: "CMP-06", name: "Sala VIP y upgrade", channel: "email", sentDate: addDays(TODAY, -15), costPerSendMxn: 0.4 },
];

// Edge cases seeded on purpose so the identity guardrails have something to
// catch: two family members who both sign in on one tablet, and a corporate
// travel agency that books ancillaries for several members with its own inbox.
export const SHARED_DEVICE_ID = "dev-family-tablet";
export const AGENCY_EMAIL = "reservas@viajescorporativos-demo.mx";
const SHARED_DEVICE_MEMBERS = new Set(["CP10000021", "CP10000022"]);

const seqOf = (memberId: string) => Number(memberId.slice(2)) - 10_000_000;

// A fifth of members never receive campaigns, so lift can be read against a
// control group instead of assumed.
export const isHoldout = (memberId: string) => seqOf(memberId) % 5 === 0;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `+${digits.startsWith("52") ? digits : `52${digits}`}`;
}

const pad = (value: number, size: number) => String(value).padStart(size, "0");

function buildCrmContacts(): readonly CrmContact[] {
  return crmMembers.map((member) => ({
    memberId: member.memberId,
    email: member.email,
    phone: `+52 55 ${pad((seqOf(member.memberId) * 7_919) % 10_000, 4)} ${pad((seqOf(member.memberId) * 104_729) % 10_000, 4)}`,
  }));
}

function buildReservations(rng: () => number): readonly Reservation[] {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const used = new Set<string>();
  return bookings.map((booking) => {
    let pnr = "";
    do {
      pnr = Array.from({ length: 6 }, () => letters[Math.floor(rng() * letters.length)]).join("");
    } while (used.has(pnr));
    used.add(pnr);
    // Booked 3 to 60 days ahead of the flight.
    const bookingDate = addDays(booking.flightDate, -(3 + Math.floor(rng() * 58)));
    return { pnr, bookingId: booking.bookingId, memberId: booking.memberId, bookingDate };
  });
}

type Truth = Map<string, string | null>;

export type CdpSources = {
  readonly crmContacts: readonly CrmContact[];
  readonly reservations: readonly Reservation[];
  readonly campaigns: readonly Campaign[];
  readonly sends: readonly CampaignSend[];
  readonly events: readonly DigitalEvent[];
  readonly ancillaryOrders: readonly AncillaryOrder[];
};

function generate(): { sources: CdpSources; truth: Truth } {
  const rng = mulberry32(SEED);
  const truth: Truth = new Map();
  const crmContacts = buildCrmContacts();
  const reservations = buildReservations(rng);
  const profiles = new Map<string, CdpProfile>(cdpProfiles.map((profile) => [profile.memberId, profile]));
  const unified = new Map(getUnifiedMembers().map((member) => [member.memberId, member]));
  const contactOf = new Map(crmContacts.map((contact) => [contact.memberId, contact]));
  const bookingOf = new Map<string, Booking>(bookings.map((booking) => [booking.bookingId, booking]));

  const randomDay = (from: string, span: number) => addDays(from, Math.floor(rng() * span));
  const hex = (length: number) => Array.from({ length }, () => Math.floor(rng() * 16).toString(16)).join("");

  // Devices and browser cookies per member.
  const deviceOf = new Map<string, string>();
  const cookiesOf = new Map<string, string[]>();
  for (const member of crmMembers) {
    const profile = profiles.get(member.memberId);
    if (profile?.appInstalled) deviceOf.set(member.memberId, `dev-${hex(10)}`);
    const cookieCount = (profile?.webSessions90d ?? 0) > 20 ? 2 : 1;
    cookiesOf.set(member.memberId, Array.from({ length: cookieCount }, () => `ck-${hex(12)}`));
  }

  const events: DigitalEvent[] = [];
  let eventSeq = 0;
  let sessionSeq = 0;
  const push = (event: Omit<DigitalEvent, "eventId">, owner: string | null) => {
    const eventId = `EV${pad(++eventSeq, 6)}`;
    events.push({ eventId, ...event });
    truth.set(eventId, owner);
  };

  // One web or app session: a short run of events, authenticated or not.
  const session = (
    owner: string | null,
    source: EventSource,
    date: string,
    options: {
      readonly cookieId?: string;
      readonly deviceId?: string;
      readonly authenticated: boolean;
      readonly steps: readonly { type: EventType; route?: string; bookingId?: string; campaignId?: string }[];
    },
  ) => {
    const sessionId = `S${pad(++sessionSeq, 5)}`;
    const ids = { cookieId: options.cookieId, deviceId: options.deviceId };
    let signedIn = false;
    for (const step of options.steps) {
      if (options.authenticated && !signedIn && step.type !== "email_click" && step.type !== "push_open" && step.type !== "in_app_open") {
        push({ source, sessionId, type: "login", date, ...ids, memberId: owner ?? undefined }, owner);
        signedIn = true;
      }
      push({ source, sessionId, date, ...ids, ...step, memberId: signedIn ? (owner ?? undefined) : undefined }, owner);
    }
  };

  const browseSteps = (memberId: string) => {
    const routes = unified.get(memberId)?.routesFlown ?? [];
    const route = routes.length > 0 ? routes[Math.floor(rng() * routes.length)] : undefined;
    const steps: { type: EventType; route?: string }[] = [{ type: "page_view" }];
    if (rng() < 0.6) steps.push({ type: "search_flight", route });
    if (rng() < 0.3) steps.push({ type: "view_ancillary" });
    if (rng() < 0.25) steps.push({ type: "select_fare", route });
    return steps;
  };

  // Organic web and app traffic, scaled from the CDP engagement profile.
  for (const member of crmMembers) {
    const profile = profiles.get(member.memberId);
    if (!profile) continue;
    const cookies = cookiesOf.get(member.memberId) ?? [];
    const webSessions = Math.min(12, Math.round(profile.webSessions90d / 4));
    for (let i = 0; i < webSessions; i += 1) {
      session(member.memberId, "web", randomDay(WINDOW_START, WINDOW_DAYS), {
        cookieId: cookies[Math.floor(rng() * cookies.length)],
        authenticated: rng() < 0.55,
        steps: browseSteps(member.memberId),
      });
    }
    const device = deviceOf.get(member.memberId);
    const appSessions = !device ? 0 : profile.lastLoginDays < 30 ? 8 : profile.lastLoginDays < 90 ? 3 : 0;
    for (let i = 0; i < appSessions; i += 1) {
      session(member.memberId, "app", randomDay(WINDOW_START, WINDOW_DAYS), {
        deviceId: device,
        authenticated: rng() < 0.85,
        steps: browseSteps(member.memberId),
      });
    }
    if (SHARED_DEVICE_MEMBERS.has(member.memberId)) {
      for (let i = 0; i < 3; i += 1) {
        session(member.memberId, "app", randomDay(WINDOW_START, WINDOW_DAYS), {
          deviceId: SHARED_DEVICE_ID,
          authenticated: rng() < 0.7,
          steps: browseSteps(member.memberId),
        });
      }
    }
  }

  // Anonymous visitors who never sign in.
  for (let i = 0; i < 80; i += 1) {
    const cookieId = `ck-${hex(12)}`;
    session(null, "web", randomDay(WINDOW_START, WINDOW_DAYS), {
      cookieId,
      authenticated: false,
      steps: [{ type: "page_view" }, ...(rng() < 0.5 ? [{ type: "search_flight" as const }] : [])],
    });
  }

  // A member already shopping for a trip (a booking within 21 days of the
  // send) engages more with campaigns. This is what ties sends to the
  // existing bookings instead of leaving them independent noise.
  const bookingDates = new Map<string, string[]>();
  for (const reservation of reservations) {
    bookingDates.set(reservation.memberId, [...(bookingDates.get(reservation.memberId) ?? []), reservation.bookingDate]);
  }
  const inMarket = (memberId: string, date: string) =>
    (bookingDates.get(memberId) ?? []).some((d) => d >= date && daysBetween(date, d) <= 21);

  // Campaign sends, gated on consent; holdout members get none.
  const sends: CampaignSend[] = [];
  let sendSeq = 0;
  for (const campaign of CAMPAIGNS) {
    for (const member of crmMembers) {
      if (isHoldout(member.memberId)) continue;
      const profile = profiles.get(member.memberId);
      if (!profile) continue;
      const device = SHARED_DEVICE_MEMBERS.has(member.memberId) ? SHARED_DEVICE_ID : deviceOf.get(member.memberId);
      const eligible =
        campaign.channel === "email"
          ? profile.emailOptIn
          : campaign.channel === "push"
            ? profile.pushOptIn && device !== undefined
            : device !== undefined;
      if (!eligible) continue;

      const recent = profile.lastLoginDays < 30;
      const openRate =
        campaign.channel === "email" ? profile.emailOpenRate90d : campaign.channel === "push" ? (recent ? 0.25 : 0.08) : recent ? 0.5 : 0.1;
      const shopping = inMarket(member.memberId, campaign.sentDate);
      const opened = rng() < (shopping ? Math.min(0.95, openRate * 1.6) : openRate);
      const clicked = opened && rng() < (shopping ? 0.6 : 0.2);
      const openDate = opened ? addDays(campaign.sentDate, Math.floor(rng() * 4)) : undefined;
      const sendId = `SD${pad(++sendSeq, 5)}`;
      sends.push({
        sendId,
        campaignId: campaign.campaignId,
        channel: campaign.channel,
        sentDate: campaign.sentDate,
        ...(campaign.channel === "email"
          ? { emailSha256: hashEmail(contactOf.get(member.memberId)!.email) }
          : { deviceId: device }),
        opened,
        clicked,
        openDate,
      });
      truth.set(sendId, member.memberId);

      if (clicked && openDate) {
        const landing: EventType = campaign.channel === "email" ? "email_click" : campaign.channel === "push" ? "push_open" : "in_app_open";
        const cookies = cookiesOf.get(member.memberId) ?? [];
        session(member.memberId, campaign.channel === "email" ? "web" : "app", openDate, {
          ...(campaign.channel === "email" ? { cookieId: cookies[0] } : { deviceId: device }),
          authenticated: rng() < (campaign.channel === "email" ? 0.5 : 0.85),
          steps: [{ type: landing, campaignId: campaign.campaignId }, ...browseSteps(member.memberId)],
        });
      }
    }
  }

  // Digital purchases for bookings made in the window through web or app.
  for (const reservation of reservations) {
    if (reservation.bookingDate < WINDOW_START || reservation.bookingDate > TODAY) continue;
    const booking = bookingOf.get(reservation.bookingId)!;
    if (booking.bookedChannel !== "web" && booking.bookedChannel !== "app") continue;
    const owner = reservation.memberId;
    const steps = [
      { type: "search_flight" as const, route: booking.route },
      { type: "select_fare" as const, route: booking.route },
      { type: "checkout_start" as const },
      { type: "purchase" as const, bookingId: booking.bookingId, route: booking.route },
    ];
    if (booking.bookedChannel === "web") {
      // About one in seven web purchases is a guest checkout with no login.
      session(owner, "web", reservation.bookingDate, {
        cookieId: cookiesOf.get(owner)?.[0],
        authenticated: rng() >= 0.15,
        steps,
      });
    } else {
      session(owner, "app", reservation.bookingDate, {
        deviceId: deviceOf.get(owner) ?? `dev-${hex(10)}`,
        authenticated: true,
        steps,
      });
    }
  }

  // Ancillary orders: the ancillary system knows the PNR and whatever contact
  // the buyer typed, never the member number.
  const ancillaryOrders: AncillaryOrder[] = [];
  let orderSeq = 0;
  for (const reservation of reservations) {
    const booking = bookingOf.get(reservation.bookingId)!;
    if (booking.ancillaryMxn <= 0) continue;
    const contact = contactOf.get(reservation.memberId)!;
    const corporate = unified.get(reservation.memberId)?.corporateAccount !== null;
    const roll = rng();
    const contactFields =
      corporate && roll < 0.25
        ? { contactEmail: AGENCY_EMAIL }
        : roll < 0.7
          ? { contactEmail: ` ${contact.email.toUpperCase()} ` }
          : roll < 0.9
            ? { contactPhone: contact.phone.replace(/\s/g, "") }
            : {};
    const seat = Math.round(booking.ancillaryMxn * 0.4);
    const bag = Math.round(booking.ancillaryMxn * 0.35);
    const rest = booking.ancillaryMxn - seat - bag;
    const items: AncillaryItem[] = [
      { type: "seat", amountMxn: seat },
      { type: "bag", amountMxn: bag },
      { type: booking.cabin === "Economy" ? "upgrade" : "lounge", amountMxn: rest },
    ];
    const orderId = `ANC${pad(++orderSeq, 5)}`;
    const orderDate = addDays(reservation.bookingDate, Math.min(2, daysBetween(reservation.bookingDate, booking.flightDate)));
    // About one order in six is bought standalone at the airport, with no PNR,
    // so only the contact details can tie it back to the member.
    const standalone = rng() < 0.16;
    ancillaryOrders.push({
      orderId,
      ...(standalone ? {} : { pnr: reservation.pnr }),
      orderDate,
      ...contactFields,
      items,
      amountMxn: booking.ancillaryMxn,
    });
    truth.set(orderId, reservation.memberId);
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId));
  return {
    sources: { crmContacts, reservations, campaigns: CAMPAIGNS, sends, events, ancillaryOrders },
    truth,
  };
}

let cached: ReturnType<typeof generate> | null = null;
const load = () => (cached ??= generate());

export function getCdpSources(): CdpSources {
  return load().sources;
}

// For evals only: the true owner of every event, send and order (null for
// anonymous visitors). Never read by identity resolution.
export function getGroundTruth(): ReadonlyMap<string, string | null> {
  return load().truth;
}
