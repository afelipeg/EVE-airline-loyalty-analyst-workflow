import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { getUnifiedMembers, type MemberSegment } from "#lib/aeromexico-data.js";
import queryMembers from "#tools/query_members.js";

// Regression test for the "71% vs 54.1%" incident: a live answer reported a
// concentration share it derived in prose, and the real figure — from
// query_members's precomputed `rollup` — was different. The same pass found a
// latent second bug: aggregating the `limit`-truncated `members` page instead
// of the full matched set, which silently understates every total.
//
// The gate below calls the REAL tool's `execute` and compares its returned
// `rollup` against values derived independently from the dataset. Two sources,
// so deleting or breaking `rollup` fails here — and it costs zero tokens and
// cannot flake, because it never depends on the model choosing to call the
// tool. (Two earlier versions of this eval got that wrong: one recomputed
// `bySegment` locally and asserted it against itself, testing only its own
// arithmetic; the next read the call off a live turn via `turn.toolCalls`,
// which passed alone but failed whenever the agent legitimately routed the
// RASK question to the revenue-analyst subagent instead.)
const SEGMENTS: readonly MemberSegment[] = ["Retencion Prioritaria", "Embajadores", "En Riesgo", "Base"];

const share = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

// `execute` here ignores its ToolContext entirely (it only reads the in-memory
// dataset), so an empty context is safe and keeps this half model-free.
type ExecuteArgs = Parameters<typeof queryMembers.execute>;
const runTool = async (input: Partial<ExecuteArgs[0]> = {}) =>
  await queryMembers.execute(
    { view: "members", sortBy: "valueScore", limit: 50, ...input } as ExecuteArgs[0],
    {} as ExecuteArgs[1],
  );

type RollupSegment = {
  readonly segment: string;
  readonly count: number;
  readonly memberSharePct: number;
  readonly raskAtRiskSharePct: number;
};

// Independent side: derived straight from the dataset, never from the tool.
const expectedBySegment = (): readonly RollupSegment[] => {
  const members = getUnifiedMembers();
  const totalRask = members.reduce((sum, m) => sum + m.raskAtRiskMxn, 0);
  return SEGMENTS.map((segment) => {
    const inSegment = members.filter((m) => m.segment === segment);
    return {
      segment,
      count: inSegment.length,
      memberSharePct: share(inSegment.length, members.length),
      raskAtRiskSharePct: share(
        inSegment.reduce((sum, m) => sum + m.raskAtRiskMxn, 0),
        totalRask,
      ),
    };
  });
};

export default defineEval({
  description: "query_members's rollup matches the dataset and survives limit truncation.",
  async test(t) {
    const expected = expectedBySegment();
    const full = await runTool();
    const actual = full.rollup?.bySegment as readonly RollupSegment[] | undefined;

    // The real gate: the tool's own rollup must equal the independently
    // derived values exactly (both sides round identically, so no tolerance).
    // Fails if `rollup` is deleted or if any segment's shares drift.
    t.check(
      actual,
      satisfies(
        (rows): boolean =>
          Array.isArray(rows) &&
          expected.every((exp) => {
            const row = rows.find((r) => r?.segment === exp.segment);
            return (
              row !== undefined &&
              row.count === exp.count &&
              row.memberSharePct === exp.memberSharePct &&
              row.raskAtRiskSharePct === exp.raskAtRiskSharePct
            );
          }),
        "rollup.bySegment matches the dataset on count, memberSharePct and raskAtRiskSharePct",
      ),
    );

    t.check(
      actual,
      satisfies((rows): boolean => {
        if (!Array.isArray(rows)) return false;
        const members = rows.reduce((sum, r) => sum + (r?.memberSharePct ?? 0), 0);
        const rask = rows.reduce((sum, r) => sum + (r?.raskAtRiskSharePct ?? 0), 0);
        return Math.abs(members - 100) < 0.5 && Math.abs(rask - 100) < 0.5;
      }, "rollup shares sum to ~100% on both the member and RASK axes"),
    );

    // The latent-bug guard: `limit` truncates the returned `members` page but
    // must not touch the rollup, whose denominator is the full matched set.
    // A rollup computed over the page would report 3 matched members here.
    const truncated = await runTool({ limit: 3 });
    t.check(
      truncated,
      satisfies(
        (out: typeof truncated): boolean =>
          out.members.length === 3 &&
          out.rollup.matchedMembers === getUnifiedMembers().length &&
          JSON.stringify(out.rollup.bySegment) === JSON.stringify(full.rollup.bySegment),
        "rollup is computed over the full matched set, not the limit-truncated page",
      ),
    );

    // Doctrine half — the agent must quote the tool's figure rather than
    // derive one in prose. Soft: it grades live model output, and the agent
    // may legitimately answer via a subagent, so it reports without gating.
    // The `%`-anchored regex keeps a fabricated share from hiding inside
    // unrelated float digits ("2.6594071510957322" contains "71", not "71%").
    const expectedPriorityPct =
      expected.find((s) => s.segment === "Retencion Prioritaria")?.raskAtRiskSharePct ?? 0;
    await t.send(
      "What share of total RASK at risk is concentrated in the Retencion Prioritaria segment, across the entire member base?",
    );
    t.succeeded();
    t.check(
      t.reply,
      satisfies((reply) => {
        const matches = [...String(reply).matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
        return matches.some((m) => Math.abs(Number(m[1]) - expectedPriorityPct) < 1);
      }, `reply quotes the RASK-at-risk share (~${expectedPriorityPct}%) rather than deriving one`),
    ).soft();
  },
});
