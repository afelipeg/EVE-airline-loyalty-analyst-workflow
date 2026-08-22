import { defineTool } from "eve/tools";
import { z } from "zod";

import { getPortfolioSnapshot, getScoredAccounts, SUCCESS_DEFINITIONS } from "../lib/fracttal-success-data.js";

const REGIONS = ["LATAM", "Iberia", "Europe", "North America"] as const;
const SEGMENTS = ["Protect Now", "Accelerate Value", "Expand", "Scale"] as const;
const SORT_FIELDS = ["arrAtRiskUsd", "arrUsd", "churnRisk", "healthScore", "valueRealizationScore", "expansionScore", "renewalDays"] as const;

export default defineTool({
  description:
    "Read the deterministic synthetic Customer Success portfolio. Use before answering account health, adoption, value realization, renewal, ARR-at-risk, or expansion questions. This is demo data, not actual Fracttal customer data.",
  inputSchema: z.object({
    region: z.array(z.enum(REGIONS)).optional(),
    segment: z.enum(SEGMENTS).optional(),
    renewalWithinDays: z.number().int().min(1).max(730).optional(),
    minArrUsd: z.number().min(0).optional(),
    minChurnRisk: z.number().min(0).max(100).optional(),
    minExpansionScore: z.number().min(0).max(100).optional(),
    valueProof: z.boolean().optional(),
    sortBy: z.enum(SORT_FIELDS).default("arrAtRiskUsd"),
    limit: z.number().int().min(1).max(100).default(25),
  }),
  async execute({ region, segment, renewalWithinDays, minArrUsd, minChurnRisk, minExpansionScore, valueProof, sortBy, limit }) {
    const all = getScoredAccounts();
    const filtered = all.filter((account) => {
      if (region?.length && !region.includes(account.region)) return false;
      if (segment && account.successSegment !== segment) return false;
      if (renewalWithinDays !== undefined && (account.renewalDays < 0 || account.renewalDays > renewalWithinDays)) return false;
      if (minArrUsd !== undefined && account.arrUsd < minArrUsd) return false;
      if (minChurnRisk !== undefined && account.churnRisk < minChurnRisk) return false;
      if (minExpansionScore !== undefined && account.expansionScore < minExpansionScore) return false;
      if (valueProof !== undefined && account.valueProof !== valueProof) return false;
      return true;
    });
    const accounts = [...filtered].sort((a, b) => b[sortBy] - a[sortBy]).slice(0, limit);
    const matchedArrUsd = filtered.reduce((s, a) => s + a.arrUsd, 0);
    const matchedArrAtRiskUsd = filtered.reduce((s, a) => s + a.arrAtRiskUsd, 0);
    const matchedExpansionPotentialUsd = filtered.reduce((s, a) => s + a.expansionPotentialUsd, 0);
    const share = (part: number, whole: number) => whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
    const bySegment = SEGMENTS.map((name) => {
      const rows = filtered.filter((a) => a.successSegment === name);
      const arr = rows.reduce((s, a) => s + a.arrUsd, 0);
      const risk = rows.reduce((s, a) => s + a.arrAtRiskUsd, 0);
      return { segment: name, accounts: rows.length, arrUsd: arr, arrSharePct: share(arr, matchedArrUsd), arrAtRiskUsd: risk, riskSharePct: share(risk, matchedArrAtRiskUsd) };
    });
    return {
      portfolio: getPortfolioSnapshot(),
      accounts,
      rollup: { matchedAccounts: filtered.length, totalAccounts: all.length, matchedArrUsd, matchedArrAtRiskUsd, matchedExpansionPotentialUsd, bySegment },
      definitions: SUCCESS_DEFINITIONS,
      guardrails: [
        "Synthetic interview dataset: never present these account names or values as actual Fracttal customer data.",
        "Do not recommend expansion until value proof and account stability are established.",
        "Quote percentages and monetary totals from this tool; do not recompute them in prose.",
      ],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
