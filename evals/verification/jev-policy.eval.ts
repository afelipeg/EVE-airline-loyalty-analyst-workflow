import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { POLICY_CASES, POLICY_CHECKS, type PolicyCheck } from "#evals/data/verification-cases.js";
import { askNouls, binaryMetrics, hasJevKey, mapLimit, THRESHOLDS } from "#evals/lib/jev.js";

// B3: measures Jev as the policy guardrail layer (opportunities #2-#4). All
// four checks ride one request per text (speculative fan-out over the same
// state). Soft, tracked metrics: tune thresholds here before adopting.
export default defineEval({
  description: "Jev flags fixed-ASK, outbound, Premier-discount, and assumption violations (B3).",
  tags: ["typesafe"],
  async test(t) {
    if (!hasJevKey()) {
      t.skip("TYPESAFE_API_KEY not set");
      return;
    }

    const answers = await mapLimit(POLICY_CASES, 4, (c) => askNouls({ text: c.text }, POLICY_CHECKS));
    const checks = Object.keys(POLICY_CHECKS) as PolicyCheck[];

    for (const check of checks) {
      const rows = POLICY_CASES.map((c, i) => ({ id: c.id, label: c.violates.includes(check), p: answers[i][check] }));
      const metrics = binaryMetrics(rows);
      const sweep = THRESHOLDS.map((threshold) => ({ threshold, ...binaryMetrics(rows, threshold) }));
      const borderline = rows.filter((r) => Math.abs(r.p - 0.5) < 0.2);
      t.log(JSON.stringify({ check, metrics, sweep, borderline, misses: rows.filter((r) => r.p >= 0.5 !== r.label) }));
      t.check(metrics, satisfies((m: typeof metrics) => m.accuracy >= 0.9, `${check}: accuracy >= 90%`)).soft();
    }
  },
});
