---
description: Club Premier offer archetype catalog, tier economics, RASK math, and guardrails for the offer-strategist subagent.
---

# Club Premier Offer Playbook

## Doctrine

ASK (available seat-km) is fixed network capacity. Offers never grow ASK —
they only move RPK, load factor, yield, and therefore RASK. Award seats are
a special case: they consume existing ASK for zero passenger revenue but
convert otherwise-empty capacity into flown RPK, which protects loyalty
value cheaply.

## Archetype catalog

Each member is assigned to at most one archetype, using this priority order,
restricted to the archetypes eligible for the requested `objective`:

1. **Status Extension + Double Puntos** (`statusExtension`) — objective:
   `retention`. Targets Titanio/Platino members in "Retencion Prioritaria" or
   "En Riesgo". Mechanics: extend current tier status through the next
   requalification window; double Puntos Premier on the member's next 2
   Premier-cabin segments. Recovery base: `raskAtRiskMxn`. Recovery factor:
   0.45. Cost per member: 600 MXN.

2. **Companion Award + Waived Redemption Fee** (`companionAward`) —
   objective: `retention` or `reactivation`. Targets Oro members in
   "Retencion Prioritaria" or "En Riesgo" with above-median RPK for their
   tier. Mechanics: companion award seat on the member's home-hub route,
   waived redemption fee. Fills empty ASK cheaply with award RPK. Recovery
   base: `raskAtRiskMxn`. Recovery factor: 0.35. Cost per member: 900 MXN.

3. **Bonus Card-Spend Points + Lounge Pass** (`cobrandBonus`) — objective:
   `ancillary_growth`. Targets any co-brand cardholder (Santander or AmEx)
   not already assigned. Mechanics: bonus Puntos on the next 90 days of
   co-brand card spend, plus a one-time lounge pass. Recovery base:
   `ancillary12mMxn`. Recovery factor: 0.30. Cost per member: 350 MXN.

4. **Dormant Elite Reactivation Bonus Miles** (`reactivationBonus`) —
   objective: `reactivation`. Targets members with `daysSinceLastFlight` >
   150 (or `marketingSegment` "Dormant Elite") not already assigned.
   Mechanics: bonus miles redeemable only if the member rebooks within 30
   days. Recovery base: `raskAtRiskMxn`. Recovery factor: 0.30. Cost per
   member: 750 MXN.

5. **AM Plus/Premier Upgrade Certificate** (`upgradeCertificate`) —
   objective: `upsell_yield`. Targets remaining members not already
   assigned (typically Base/Embajadores flying Economy or AM Plus).
   Mechanics: one-cabin upgrade certificate valid on the member's next paid
   booking. Recovery base: `passengerRevenue12mMxn`. Recovery factor: 0.12.
   Cost per member: 400 MXN.

## RASK math

- `estimatedRaskRecoveredMxn` = sum over targeted members of
  `recoveryBase * recoveryFactor`, rounded.
- `estimatedRpkRetained` = `estimatedRaskRecoveredMxn` divided by each
  member's `avgYieldMxnPerKm` (falling back to the network average yield
  when a member's yield is 0), summed across the group.
- `incentiveCostMxn` = `costPerMember * targetCount`.
- `roi` = `estimatedRaskRecoveredMxn / incentiveCostMxn`.
- Rank offers by `roi` descending.

## Guardrails

- Don't discount yield you'd keep anyway — recovery factors are applied
  only against at-risk or growth-eligible revenue bases, not full revenue.
- Award seats fill empty ASK cheaply — treat companion-award offers as
  RPK/loyalty-value plays, not paid-revenue growth.
- Protect Premier margin — do not recommend blanket Premier fare discounts;
  the catalog above uses status, points, and ancillary perks instead of
  cash discounts.
- Recovery factors and costs are modeled assumptions, not measured
  outcomes. State them as such in the handoff.
