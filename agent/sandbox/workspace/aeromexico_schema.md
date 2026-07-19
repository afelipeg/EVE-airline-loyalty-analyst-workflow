# Aeromexico Club Premier Demo Dataset

Deterministic synthetic loyalty analytics dataset for the Aeromexico Club
Premier demo. Everything is generated in `agent/lib/aeromexico-data.ts` — 40
hand-authored members joined against ~500 booking segments generated with a
constant-seeded mulberry32 PRNG (never `Math.random`), so re-running the app
produces byte-identical data.

## Source systems

All records join on `memberId` ("CP" + 8 digits, e.g. `CP10000001`).

- **CRM (`crmMembers`)** — identity and tier: name, email, home hub (MEX/GDL/MTY),
  enrollment date, tier ("Clasico" | "Plata" | "Oro" | "Platino" | "Titanio"),
  corporate account, preferred cabin, service cases, CSAT.
- **CDP (`cdpProfiles`)** — digital engagement: app/email/push opt-ins, days
  since last login, email open rate, web sessions, NPS segment, predicted
  channel, marketing segment.
- **Loyalty (`loyaltyAccounts`)** — points and card economics: points balance,
  points earned/redeemed in the trailing 12 months, redemption count,
  co-brand card, card spend, CLV, status-qualifying segments YTD.
- **Bookings (`bookings`)** — ~500 flight segments generated deterministically:
  booking id, memberId, flight date (trailing 12 months from 2026-07-18),
  route, distance, cabin, fare class, fare (0 for award travel), ancillary
  revenue, seats, award flag, booking channel. Higher tiers fly more, longer
  (skewed toward long-haul/international routes), and in higher cabins.

## The fixed ASK anchor

`networkCapacity` is a hardcoded table of 11 routes (distance, fixed ASK in
millions of seat-km per trailing 12 months, and a blended RASK target). It is
**never derived from member or booking data** — it represents the airline's
actual scheduled capacity. Everything member-driven (RPK, load factor, yield,
RASK, ancillary share) is computed against this fixed denominator.

> **Doctrine: ASK is FIXED network capacity; loyalty moves RPK/load
> factor/yield/RASK — never ASK.**

## The unified member view

`getUnifiedMembers()` is the single source of truth: CRM + CDP + Loyalty +
a booking rollup (`rollupBookingsByMember()`), each row extended with a
score:

- **valueScore (0–100)** — weighted, min-max-normalized blend of CLV (30%),
  trailing-12m RPK (25%), passenger + ancillary revenue (20%), tier rank
  (15%), and co-brand card spend (10%).
- **churnRisk (0–100)** — weighted blend of flight recency (35%), digital
  engagement decay via last login (20%), flight frequency drop (20%,
  inverted), satisfaction via CSAT (15%, inverted), and service friction via
  case count (10%).
- **raskAtRiskMxn** — `(churnRisk / 100) * (passengerRevenue12mMxn +
  ancillary12mMxn)`: the trailing-12m revenue this member represents,
  weighted by how likely they are to leave.
- **segment** — quadrant of the 60/50 valueScore/churnRisk thresholds:
  "Retencion Prioritaria" (high value, high risk), "Embajadores" (high
  value, low risk), "En Riesgo" (low value, high risk), "Base" (low value,
  low risk).

## Sandbox segmentation artifacts

`run_analysis`-style tools call into `agent/lib/sandbox-analysis/`, which
writes `input.json` (member rows + a route array + a chart selector) into the
sandbox, runs `aeromexico_segmentation.py` (Python stdlib only — no
numpy/pandas/matplotlib), and reads back:

- `aeromexico_segmentation.json` — segment counts, Σ raskAtRiskMxn per
  segment, network load factor, top retention targets.
- `aeromexico_chart.svg` — hand-rendered chart. Selectable via the `chart`
  input field: `value_churn_scatter`, `rask_by_segment`, `rpk_by_route`,
  `loadfactor_by_route`.
- `report.md` — human-readable summary.

If the sandbox is unavailable, the TypeScript fallback in
`agent/lib/sandbox-analysis/segmentation.ts` (`segmentMembers`) computes the
identical numbers so tools degrade gracefully.
