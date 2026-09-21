import { readFileSync } from "node:fs";

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { REAL_REPLIES } from "#evals/data/captured-labels.js";
import { buildReplyEvidence, SIMULATED_REPLIES } from "#evals/data/simulated-replies.js";
import { checkNumbers, type EvidenceCall } from "#lib/verification/numbers.js";

// t4: the deterministic numeric check (threshold 1.0) on every labeled claim,
// zero tokens. Gate: no supported claim may be flagged. Catch rate on
// unsupported claims is tracked, not gated: wrong-population and wrong-entity
// claims use numbers that do exist, which is scope.ts's job, not this one.
export default defineEval({
  description: "Numeric check never flags a supported claim and catches derived figures.",
  async test(t) {
    const simEvidence = await buildReplyEvidence();
    const claims = [
      ...SIMULATED_REPLIES.flatMap((r) => r.paragraphs.flatMap((p) => (p.claims ?? []).map((c) => ({ id: r.id, ...c, ev: simEvidence[c.evidence] })))),
      ...REAL_REPLIES.flatMap((r) => r.paragraphs.flatMap((p) => (p.claims ?? []).map((c) => ({ id: r.id, ...c, ev: r.evidence[c.evidence] })))),
    ];
    const results = claims.map((c) => ({ ...c, report: checkNumbers(c.text, [{ tool: "evidence", output: c.ev }]) }));

    const falseAlarms = results.filter((r) => r.supported && !r.report.pass);
    const caught = results.filter((r) => !r.supported && !r.report.pass);
    const missed = results.filter((r) => !r.supported && r.report.pass);
    t.log(JSON.stringify({
      falseAlarms: falseAlarms.map((r) => ({ id: r.id, text: r.text, misses: r.report.misses.map((m) => m.figure) })),
      caught: caught.length,
      missed: missed.map((r) => ({ id: r.id, text: r.text })),
    }));
    t.check(falseAlarms.length, satisfies((n: number) => n === 0, "no supported claim is flagged"));
    t.check(caught.length / (caught.length + missed.length), satisfies((r: number) => r >= 0.5, "catches most unsupported claims")).soft();

    // Whole real replies against their full tool outputs, as the hook sees them.
    const whole = REAL_REPLIES.map((r) => {
      const { reply, toolCalls } = JSON.parse(readFileSync(`evals/data/captured/${r.id}.json`, "utf8")) as {
        reply: string;
        toolCalls: { name: string; input: unknown; output: unknown }[];
      };
      const calls: EvidenceCall[] = toolCalls.map((c) => ({ tool: c.name, input: c.input, output: c.output }));
      const report = checkNumbers(reply, calls);
      return { id: r.id, checked: report.checked.length, misses: report.misses.map((m) => m.figure), unknownIds: report.unknownIds };
    });
    t.log(JSON.stringify({ wholeReplies: whole }));
  },
});
