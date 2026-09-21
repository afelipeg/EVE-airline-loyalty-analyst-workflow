import { readFileSync } from "node:fs";

import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { hasJevKey, mapLimit } from "#evals/lib/jev.js";
import { checkNumbers, type EvidenceCall } from "#lib/verification/numbers.js";
import { checkScope } from "#lib/verification/scope.js";

// t4: Jev scope Choice on figures that DO exist in tool output but may be
// attributed to the wrong population. Real cases come from captured turns with
// their real tool inputs (filters); the synthetic one moves a share to the
// wrong segment. Soft and tracked.
const calls = (id: string): EvidenceCall[] =>
  (JSON.parse(readFileSync(`evals/data/captured/${id}.json`, "utf8")) as { toolCalls: { name: string; input: unknown; output: unknown }[] })
    .toolCalls.map((c) => ({ tool: c.name, input: c.input, output: c.output }));

const CASES: readonly { id: string; source: string; claim: string; expected: "matches" | "differs" }[] = [
  { id: "real-04-100pct", source: "real-04", claim: "Retención Prioritaria: 2 miembros, 100% del RASK en riesgo detectado en la base actual de 40 miembros.", expected: "differs" },
  { id: "real-07-54pct", source: "real-07", claim: "Combined they carry 54.1% of all RASK-at-risk across the Platino/Titanio tiers.", expected: "matches" },
  { id: "real-00-23pct", source: "real-00", claim: "Retención Prioritaria holds 23.0% of total RASK-at-risk across the full 40-member base.", expected: "matches" },
  { id: "real-00-swap", source: "real-00", claim: "En Riesgo holds 23.0% of total RASK-at-risk across the full 40-member base.", expected: "differs" },
  { id: "real-05-lf", source: "real-05", claim: "MEX-LAX runs at 87.9% load factor on its fixed ASK.", expected: "matches" },
];

export default defineEval({
  description: "Jev scope check flags figures attributed to the wrong population (t4).",
  tags: ["typesafe"],
  async test(t) {
    if (!hasJevKey()) {
      t.skip("TYPESAFE_API_KEY not set");
      return;
    }
    const results = await mapLimit(CASES, 3, async (c) => {
      const evidence = calls(c.source);
      const figure = checkNumbers(c.claim, evidence).checked.find((f) => f.isPercent && f.match);
      if (!figure) return { ...c, error: "figure not found in tool output" };
      const scope = await checkScope(figure, evidence);
      const flagged = scope.flag === "differs";
      return { ...c, path: figure.match?.path, population: scope.population, entity: scope.entity, flag: scope.flag, correct: flagged === (c.expected === "differs") };
    });
    t.log(JSON.stringify(results));
    const correct = results.filter((r) => "correct" in r && r.correct).length;
    t.check(correct / CASES.length, satisfies((a: number) => a >= 0.8, "scope accuracy >= 80%")).soft();
  },
});
