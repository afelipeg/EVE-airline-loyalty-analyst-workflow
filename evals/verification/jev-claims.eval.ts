import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { buildClaimCases, CLAIM_SUPPORTED } from "#evals/data/verification-cases.js";
import { askNouls, binaryMetrics, hasJevKey, mapLimit, THRESHOLDS } from "#evals/lib/jev.js";

// B2: measures Jev as a claim-vs-tool-output checker (opportunity #1). Soft
// with no bar: the point is to record accuracy/precision/recall and pick a
// threshold on this data, not to gate CI on a model before it is adopted.
// Spends TypeSafe tokens only; never calls the agent.
export default defineEval({
  description: "Jev flags numeric/ID claims unsupported by tool output (B2).",
  tags: ["typesafe"],
  async test(t) {
    if (!hasJevKey()) {
      t.skip("TYPESAFE_API_KEY not set");
      return;
    }

    const cases = await buildClaimCases();
    const answers = await mapLimit(cases, 4, (c) =>
      askNouls({ evidence: c.evidence, claim: c.claim }, { supported: CLAIM_SUPPORTED }),
    );

    // Positive class = unsupported claim, the thing the layer must catch.
    const rows = cases.map((c, i) => ({ id: c.id, label: !c.supported, p: 1 - answers[i].supported }));
    const metrics = binaryMetrics(rows);
    const sweep = THRESHOLDS.map((threshold) => ({ threshold, ...binaryMetrics(rows, threshold) }));
    const borderline = rows.filter((r) => Math.abs(r.p - 0.5) < 0.2);
    t.log(JSON.stringify({ metrics, sweep, borderline, misses: rows.filter((r) => r.p >= 0.5 !== r.label) }));

    t.check(metrics, satisfies((m: typeof metrics) => m.recall >= 0.9, "catches >=90% of unsupported claims")).soft();
    t.check(metrics, satisfies((m: typeof metrics) => m.precision >= 0.9, ">=90% of flags are real")).soft();
  },
});
