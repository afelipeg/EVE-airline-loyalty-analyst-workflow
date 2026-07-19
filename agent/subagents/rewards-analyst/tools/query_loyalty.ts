import { defineTool } from "eve/tools";
import { z } from "zod";

import { getUnifiedMembers } from "../../../lib/aeromexico-data.js";

export default defineTool({
  description:
    "Read Club Premier loyalty data: points balance, earn/redeem activity, co-brand card, card spend, CLV. Use before answering rewards or points economy questions.",
  inputSchema: z.object({
    cobrandCard: z.enum(["none", "Santander", "AmEx"]).optional(),
    minClvMxn: z.number().optional(),
    minRedemptions: z.number().int().optional().describe("Minimum redemptions12m."),
    sortBy: z.enum(["clvMxn", "pointsBalance", "redemptions12m", "cardSpend12mMxn"]).default("clvMxn"),
    limit: z.number().int().min(1).default(50),
  }),
  async execute({ cobrandCard, limit, minClvMxn, minRedemptions, sortBy }) {
    let filtered = getUnifiedMembers().filter((member) => {
      if (cobrandCard && member.cobrandCard !== cobrandCard) return false;
      if (minClvMxn !== undefined && member.clvMxn < minClvMxn) return false;
      if (minRedemptions !== undefined && member.redemptions12m < minRedemptions) return false;
      return true;
    });

    filtered = [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);

    const projected = filtered.map((member) => ({
      memberId: member.memberId,
      name: `${member.firstName} ${member.lastName}`,
      tier: member.tier,
      pointsBalance: member.pointsBalance,
      pointsEarned12m: member.pointsEarned12m,
      pointsRedeemed12m: member.pointsRedeemed12m,
      redemptions12m: member.redemptions12m,
      cobrandCard: member.cobrandCard,
      cardSpend12mMxn: member.cardSpend12mMxn,
      clvMxn: member.clvMxn,
      statusQualifyingSegmentsYtd: member.statusQualifyingSegmentsYtd,
      pointsLiability: member.pointsBalance,
    }));

    const totals = filtered.reduce(
      (acc, member) => {
        acc.totalEarned12m += member.pointsEarned12m;
        acc.totalRedeemed12m += member.pointsRedeemed12m;
        acc.totalBalance += member.pointsBalance;
        return acc;
      },
      { totalEarned12m: 0, totalRedeemed12m: 0, totalBalance: 0 },
    );

    const pointsEconomy = {
      ...totals,
      redemptionRate: totals.totalEarned12m === 0 ? 0 : round3(totals.totalRedeemed12m / totals.totalEarned12m),
    };

    const cobrandMix = Object.entries(
      filtered.reduce<Record<string, number>>((acc, member) => {
        acc[member.cobrandCard] = (acc[member.cobrandCard] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([card, count]) => ({ cobrandCard: card, count }));

    const clvValues = filtered.map((member) => member.clvMxn);
    const clvSummary = {
      totalClvMxn: Math.round(clvValues.reduce((sum, value) => sum + value, 0)),
      avgClvMxn: clvValues.length === 0 ? 0 : Math.round(clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length),
      maxClvMxn: clvValues.length === 0 ? 0 : Math.max(...clvValues),
    };

    return {
      members: projected.slice(0, limit),
      matchedCount: filtered.length,
      pointsEconomy,
      cobrandMix,
      clvSummary,
      definitions: {
        pointsLiability: "Outstanding Puntos Premier balance the airline owes the member (equals pointsBalance).",
        clvMxn: "Modeled customer lifetime value in MXN.",
        redemptionRate: "pointsRedeemed12m / pointsEarned12m across the query scope.",
      },
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
