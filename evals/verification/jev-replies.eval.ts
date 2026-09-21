import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { REAL_REPLIES } from "#evals/data/captured-labels.js";
import { buildReplyEvidence, SIMULATED_REPLIES } from "#evals/data/simulated-replies.js";
import { CLAIM_SUPPORTED, POLICY_CHECKS, POLICY_QUESTIONS, policyScores } from "#evals/data/verification-cases.js";
import { askNouls, binaryMetrics, hasJevKey, mapLimit, THRESHOLDS } from "#evals/lib/jev.js";
import { POLICY_THRESHOLDS } from "#lib/verification/policy.js";

// t3: the same Jev questions as B2/B3, run on full agent replies split into
// paragraphs (policy) and numeric sentences (claims), the granularity t2
// showed is needed. Covers 20 simulated replies plus the hand-labeled real
// captures. Soft and tracked, like the other Jev evals.
export default defineEval({
  description: "Jev policy and claim checks hold on paragraph-split agent replies (t3).",
  tags: ["typesafe"],
  async test(t) {
    if (!hasJevKey()) {
      t.skip("TYPESAFE_API_KEY not set");
      return;
    }

    const simEvidence = await buildReplyEvidence();
    const replies = [
      ...SIMULATED_REPLIES.map((r) => ({ ...r, source: "sim" as const, evidence: simEvidence as Record<string, unknown> })),
      ...REAL_REPLIES.map((r) => ({ ...r, source: "real" as const })),
    ];
    const paragraphs = replies.flatMap((r) => r.paragraphs.map((p, i) => ({ id: `${r.id}#${i}`, source: r.source, ...p })));
    const claims = replies.flatMap((r) =>
      r.paragraphs.flatMap((p, i) =>
        (p.claims ?? []).map((c, j) => ({ id: `${r.id}#${i}.${j}`, source: r.source, ...c, evidenceValue: r.evidence[c.evidence] })),
      ),
    );

    const policy = await mapLimit(paragraphs, 4, (p) => askNouls({ text: p.text }, POLICY_QUESTIONS).then(policyScores));
    const support = await mapLimit(claims, 4, (c) =>
      askNouls({ evidence: c.evidenceValue, claim: c.text }, { supported: CLAIM_SUPPORTED }),
    );

    const report = (name: string, rows: { id: string; source: string; label: boolean; p: number }[], threshold = 0.5) => {
      const metrics = binaryMetrics(rows, threshold);
      const bySource = Object.fromEntries(
        ["sim", "real"].map((s) => [s, binaryMetrics(rows.filter((r) => r.source === s), threshold)]),
      );
      const sweep = THRESHOLDS.map((threshold) => ({ threshold, ...binaryMetrics(rows, threshold) }));
      const misses = rows.filter((r) => r.p >= threshold !== r.label);
      t.log(JSON.stringify({ check: name, metrics, bySource, sweep, misses }));
      t.check(metrics, satisfies((m: typeof metrics) => m.accuracy >= 0.9, `${name}: accuracy >= 90%`)).soft();
    };

    for (const check of POLICY_CHECKS) {
      report(
        check,
        paragraphs.map((p, i) => ({ id: p.id, source: p.source, label: p.violates.includes(check), p: policy[i][check] })),
        POLICY_THRESHOLDS[check],
      );
    }
    // Positive class = unsupported claim.
    report(
      "claims",
      claims.map((c, i) => ({ id: c.id, source: c.source, label: !c.supported, p: 1 - support[i].supported })),
    );
  },
});
