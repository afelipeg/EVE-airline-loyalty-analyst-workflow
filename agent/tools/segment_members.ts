import { defineTool } from "eve/tools";
import { z } from "zod";

import { getNetworkSnapshot, getUnifiedMembers } from "../lib/aeromexico-data.js";
import { createSandboxPaths } from "../lib/sandbox-analysis/sandbox-paths.js";
import { segmentMembers } from "../lib/sandbox-analysis/segmentation.js";
import { runSegmentationInSandbox, withSandboxFailure } from "../lib/sandbox-analysis/sandbox-runner.js";
import { primitiveValue, type InputRow } from "../lib/sandbox-analysis/schema.js";

export default defineTool({
  description:
    "Run Club Premier value/churn segmentation and RASK-at-risk analysis inside the Eve sandbox. Use for " +
    "value-vs-churn scatter, RASK-by-segment, RPK-by-route, or load-factor-by-route charts and for finding " +
    "top retention targets.",
  inputSchema: z.object({
    title: z.string().min(1),
    chart: z
      .enum(["value_churn_scatter", "rask_by_segment", "rpk_by_route", "loadfactor_by_route"])
      .default("value_churn_scatter"),
    members: z
      .array(z.record(z.string(), primitiveValue))
      .max(200)
      .optional()
      .describe("Member rows to segment. Defaults to all unified members."),
  }),
  async execute({ title, chart, members }, ctx) {
    // Re-hydrate any caller-supplied rows against the real dataset by memberId.
    // The model often passes trimmed member objects (missing numeric fields such
    // as rpk12m) and could even supply fabricated numbers; segmentation must run
    // on the deterministic source data, so `members` is used ONLY to select which
    // members to include, never as the numeric input. Falls back to all members
    // when nothing is passed or nothing matches. The cast bridges the typed domain
    // objects to the sandbox boundary's JSON-primitive row shape.
    const all = getUnifiedMembers();
    const selected =
      members && members.length
        ? (() => {
            const byId = new Map(all.map((m) => [m.memberId, m]));
            const picked = members
              .map((m) => (typeof m.memberId === "string" ? byId.get(m.memberId) : undefined))
              .filter((m): m is (typeof all)[number] => Boolean(m));
            return picked.length ? picked : all;
          })()
        : all;
    const rows = selected as unknown as readonly InputRow[];
    const net = getNetworkSnapshot();
    const routes = net.byRoute as unknown as readonly InputRow[];
    const fallback = segmentMembers(rows, net.askMillions, title);
    const paths = createSandboxPaths(ctx.callId);

    try {
      const sandbox = await ctx.getSandbox();

      const result = await runSegmentationInSandbox({
        askMillions: net.askMillions,
        chart,
        fallback,
        paths,
        rows,
        routes,
        sandbox,
        title,
      });
      return { ...result, chart };
    } catch (error) {
      // The model already sees sandbox.reason; this surfaces it in server logs
      // so a degraded sandbox is visible in Vercel rather than only in-band.
      console.error("[segment_members] sandbox execution failed", error);
      return { ...withSandboxFailure(fallback, error), chart };
    }
  },
  toModelOutput(output) {
    return {
      type: "json",
      value: {
        title: output.title,
        chart: output.chart,
        segmentSummary: output.segments,
        totalRaskAtRiskMxn: output.totalRaskAtRiskMxn,
        topRetentionTargets: output.topRetentionTargets,
        takeaway: output.takeaway,
        sandbox: output.sandbox,
      },
    };
  },
});
