import { defineTool } from "eve/tools";
import { z } from "zod";

import { getUnifiedMembers } from "../../../lib/aeromexico-data.js";

export default defineTool({
  description:
    "Read Club Premier CRM data: identity, tier, home hub, CSAT, service cases, corporate accounts. Use before answering CRM questions.",
  inputSchema: z.object({
    tier: z.array(z.string()).optional().describe("Filter to these tiers."),
    hub: z.array(z.string()).optional().describe("Filter to these home hubs."),
    corporateOnly: z.boolean().optional().describe("Only members with a corporate account."),
    minServiceCases: z.number().int().optional().describe("Minimum serviceCases12m."),
    sortBy: z.enum(["tier", "csat", "serviceCases12m"]).default("tier"),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async execute({ corporateOnly, hub, limit, minServiceCases, sortBy, tier }) {
    const tierRank: Record<string, number> = {
      Clasico: 1,
      Plata: 2,
      Oro: 3,
      Platino: 4,
      Titanio: 5,
    };

    const allMembers = getUnifiedMembers();

    let filtered = allMembers.filter((member) => {
      if (tier && tier.length > 0 && !tier.includes(member.tier)) return false;
      if (hub && hub.length > 0 && !hub.includes(member.homeHub)) return false;
      if (corporateOnly && !member.corporateAccount) return false;
      if (minServiceCases !== undefined && member.serviceCases12m < minServiceCases) return false;
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "tier") return tierRank[b.tier] - tierRank[a.tier];
      if (sortBy === "csat") return a.csat - b.csat;
      return b.serviceCases12m - a.serviceCases12m;
    });

    const projected = filtered.map((member) => ({
      memberId: member.memberId,
      name: `${member.firstName} ${member.lastName}`,
      tier: member.tier,
      homeHub: member.homeHub,
      csat: member.csat,
      serviceCases12m: member.serviceCases12m,
      corporateAccount: member.corporateAccount,
      preferredCabin: member.preferredCabin,
      enrollmentDate: member.enrollmentDate,
      tierSince: member.tierSince,
    }));

    // Shares are computed here, over the full matched set, because the model
    // gets these wrong when it derives them in prose. `filtered` is the correct
    // denominator; `members` below is truncated by `limit`.
    const share = (part: number, whole: number) =>
      whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

    const tierMix = Object.entries(
      filtered.reduce<Record<string, number>>((acc, member) => {
        acc[member.tier] = (acc[member.tier] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([tierName, count]) => ({ tier: tierName, count, sharePct: share(count, filtered.length) }));

    const corporateMembers = filtered.filter((member) => member.corporateAccount).length;
    const membersWithServiceCases = filtered.filter((member) => member.serviceCases12m > 0).length;

    const rollup = {
      matchedMembers: filtered.length,
      totalMembers: allMembers.length,
      matchedSharePct: share(filtered.length, allMembers.length),
      corporateMembers,
      corporateSharePct: share(corporateMembers, filtered.length),
      membersWithServiceCases,
      serviceCaseSharePct: share(membersWithServiceCases, filtered.length),
      avgCsat:
        filtered.length === 0
          ? 0
          : Math.round((filtered.reduce((sum, m) => sum + m.csat, 0) / filtered.length) * 10) / 10,
    };

    const serviceHotspots = filtered
      .filter((member) => member.serviceCases12m >= 2)
      .sort((a, b) => b.serviceCases12m - a.serviceCases12m || a.csat - b.csat)
      .slice(0, 10)
      .map((member) => ({
        memberId: member.memberId,
        name: `${member.firstName} ${member.lastName}`,
        tier: member.tier,
        serviceCases12m: member.serviceCases12m,
        csat: member.csat,
      }));

    const members = projected.slice(0, limit);

    return {
      members,
      matchedCount: filtered.length,
      rollup,
      tierMix,
      serviceHotspots,
      definitions: {
        csat: "Customer satisfaction score, 0-100, from the CRM system.",
        serviceCases12m: "Count of service cases opened in the trailing 12 months.",
        corporateAccount: "Corporate account name if the member is enrolled under one, else null.",
      },
      notes: [
        `${filtered.length} of ${allMembers.length} members matched the filters; showing ${members.length}.`,
        "Percentages and totals in `rollup` and `tierMix` cover every matched member, including those beyond " +
          "the shown limit. Quote them as returned; do not recompute shares from the `members` list.",
      ],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
