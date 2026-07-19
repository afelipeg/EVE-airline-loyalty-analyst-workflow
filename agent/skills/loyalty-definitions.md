---
description: Use when interpreting Club Premier RASK, yield, load factor, tier, or segment questions, or when explaining the fixed-ASK doctrine.
---

# Club Premier Loyalty Definitions

Use these definitions before interpreting network performance or member segments.

## Network metrics

- `ASK` (Available Seat Kilometers): fixed network capacity for the period — seats offered times distance
  flown. Loyalty cannot change ASK; it is set by network/fleet planning. `askMillions` in the data is
  expressed in millions of seat-km.
- `RPK` (Revenue Passenger Kilometers): seats actually sold/flown times distance. Loyalty's job is to grow
  RPK against the fixed ASK.
- `Load factor`: RPK / ASK. The share of fixed capacity actually filled.
- `RASK` (Revenue per ASK): (passenger revenue + ancillary revenue) / ASK. The headline revenue-efficiency
  metric — it rises from higher load factor, higher yield, or more ancillary attach, never from more ASK.
- `Yield`: passenger revenue per RPK (MXN per km flown). Reflects fare/cabin mix.
- `Ancillary share`: ancillary revenue as a share of total (passenger + ancillary) revenue.

## Fixed-ASK doctrine

ASK is FIXED network capacity. Loyalty programs, offers, and retention campaigns cannot add ASK — they can
only change how efficiently the existing ASK converts to revenue (load factor, RASK, yield, ancillary,
CLV/retention). Never frame a loyalty recommendation as "growing capacity"; frame it as "filling the fixed
ASK more profitably."

## Club Premier tiers

Ascending order: `Clasico` → `Plata` → `Oro` → `Platino` → `Titanio`. Higher tiers skew toward Premier cabin,
longer-haul international routes, and higher award-redemption rates.

## Member value and churn scoring

- `valueScore` (0-100): weighted composite of CLV, trailing-12m RPK, trailing-12m passenger + ancillary
  revenue, tier rank, and co-brand card spend. A member is high value at `valueScore >= 60`.
- `churnRisk` (0-100): weighted composite of days since last flight, app/web login recency, flight
  frequency (inverse), CSAT (inverse), and service-case friction. A member is high risk at
  `churnRisk >= 50`.
- `raskAtRiskMxn`: trailing-12m passenger + ancillary revenue weighted by `churnRisk` — the RASK exposure if
  the member churns.

## Segments

- `Retencion Prioritaria`: high value AND high risk (`valueScore >= 60` and `churnRisk >= 50`). Highest
  priority for retention offers — largest RASK-at-risk per member.
- `Embajadores`: high value, low risk. Protect and grow; strong co-brand/upsell candidates.
- `En Riesgo`: low value, high risk. Lower RASK exposure but still churn-prone; use low-cost retention plays.
- `Base`: low value, low risk. Standard servicing, no special intervention needed.
