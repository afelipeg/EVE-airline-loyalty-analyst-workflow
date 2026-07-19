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
    limit: z.number().int().min(1).default(50),
  }),
  async execute({ corporateOnly, hub, limit, minServiceCases, sortBy, tier }) {
    const tierRank: Record<string, number> = {
      Clasico: 1,
      Plata: 2,
      Oro: 3,
      Platino: 4,
      Titanio: 5,
    };

    let filtered = getUnifiedMembers().filter((member) => {
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

    const tierMix = Object.entries(
      filtered.reduce<Record<string, number>>((acc, member) => {
        acc[member.tier] = (acc[member.tier] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([tierName, count]) => ({ tier: tierName, count }));

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

    return {
      members: projected.slice(0, limit),
      matchedCount: filtered.length,
      tierMix,
      serviceHotspots,
      definitions: {
        csat: "Customer satisfaction score, 0-100, from the CRM system.",
        serviceCases12m: "Count of service cases opened in the trailing 12 months.",
        corporateAccount: "Corporate account name if the member is enrolled under one, else null.",
      },
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
