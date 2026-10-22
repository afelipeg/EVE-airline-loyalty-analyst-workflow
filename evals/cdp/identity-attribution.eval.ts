import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { ATTRIBUTION_MODELS, getAttribution } from "#lib/cdp/attribution.js";
import { getIdentityGraph, getIdentitySummary } from "#lib/cdp/identity.js";
import { AGENCY_EMAIL, getCdpSources, getGroundTruth } from "#lib/cdp/sources.js";

// Deterministic, zero tokens: identity resolution is checked against the
// generator's ground truth, and every attribution model must conserve
// conversions and revenue.
export default defineEval({
  description: "Identity resolution never merges two people and attribution conserves revenue.",
  async test(t) {
    const graph = getIdentityGraph();
    const truth = getGroundTruth();

    let wrong = 0;
    let owned = 0;
    let found = 0;
    for (const [recordId, owner] of truth) {
      const resolved = graph.resolutions.get(recordId)?.memberId ?? null;
      if (owner) owned += 1;
      if (resolved && resolved !== owner) wrong += 1;
      if (resolved && resolved === owner) found += 1;
    }
    const summary = getIdentitySummary();
    t.log(JSON.stringify({ wrong, recall: found / owned, guardrails: summary.guardrails }));

    t.check(wrong, satisfies((n: number) => n === 0, "no record resolves to the wrong member"));
    t.check(summary.guardrails.overMerges, satisfies((n: number) => n === 0, "no identifier sits in two profiles"));
    t.check(summary.guardrails.sharedDevices.length, satisfies((n: number) => n >= 1, "the shared family device is caught"));
    t.check(summary.guardrails.blockedEmails, satisfies((n: number) => n >= 1, "the agency inbox is blocked"));
    // Orders an agency booked with its own inbox may resolve through the PNR,
    // never through that shared email.
    const agencyByEmail = getCdpSources()
      .ancillaryOrders.filter((order) => order.contactEmail === AGENCY_EMAIL)
      .filter((order) => graph.resolutions.get(order.orderId)?.rule === "email_hash").length;
    t.check(agencyByEmail, satisfies((n: number) => n === 0, "agency-email orders never resolve by email"));
    t.check(found / owned, satisfies((r: number) => r >= 0.9, "resolves at least 90% of identifiable records")).soft();

    for (const model of ATTRIBUTION_MODELS) {
      const result = getAttribution(model);
      const credited = result.byChannel.reduce((sum, c) => sum + c.conversions, 0);
      const revenue = result.byChannel.reduce((sum, c) => sum + c.revenueMxn, 0);
      t.check(Math.abs(credited - result.totals.conversions), satisfies((d: number) => d < 0.05, `${model}: credits sum to conversions`));
      t.check(Math.abs(revenue - result.totals.revenueMxn), satisfies((d: number) => d <= result.byChannel.length, `${model}: revenue is conserved`));
      t.check(result.totals.windowRaskMxn, satisfies((r: number) => r <= result.totals.networkRaskMxn, `${model}: window RASK within network RASK`));
    }

    const again = getAttribution("position_based");
    t.check(JSON.stringify(again), satisfies((s: string) => s === JSON.stringify(getAttribution("position_based")), "attribution is deterministic"));
  },
});
