import { defineTool } from "eve/tools";
import { z } from "zod";

import { getUnifiedMembers } from "../../../lib/aeromexico-data.js";

export default defineTool({
  description:
    "Read Club Premier CDP data: engagement recency, open rates, sessions, consent, NPS segment, predicted channel, marketing segment. Use before answering CDP questions.",
  inputSchema: z.object({
    marketingSegment: z.string().optional(),
    npsSegment: z.enum(["promoter", "passive", "detractor"]).optional(),
    maxLastLoginDays: z.number().optional(),
    channel: z.enum(["email", "push", "app"]).optional().describe("Filter to members opted into this channel."),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async execute({ channel, limit, marketingSegment, maxLastLoginDays, npsSegment }) {
    const filtered = getUnifiedMembers().filter((member) => {
      if (marketingSegment && member.marketingSegment !== marketingSegment) return false;
      if (npsSegment && member.npsSegment !== npsSegment) return false;
      if (maxLastLoginDays !== undefined && member.lastLoginDays > maxLastLoginDays) return false;
      if (channel === "email" && !member.emailOptIn) return false;
      if (channel === "push" && !member.pushOptIn) return false;
      if (channel === "app" && !member.appInstalled) return false;
      return true;
    });

    const projected = filtered.map((member) => ({
      memberId: member.memberId,
      name: `${member.firstName} ${member.lastName}`,
      tier: member.tier,
      appInstalled: member.appInstalled,
      emailOptIn: member.emailOptIn,
      pushOptIn: member.pushOptIn,
      lastLoginDays: member.lastLoginDays,
      emailOpenRate90d: member.emailOpenRate90d,
      webSessions90d: member.webSessions90d,
      npsSegment: member.npsSegment,
      predictedChannel: member.predictedChannel,
      marketingSegment: member.marketingSegment,
      isDormant: member.lastLoginDays > 60,
    }));

    const count = filtered.length || 1;
    const engagementSummary = {
      matchedCount: filtered.length,
      dormantCount: filtered.filter((member) => member.lastLoginDays > 60).length,
      avgLastLoginDays: round1(filtered.reduce((sum, m) => sum + m.lastLoginDays, 0) / count),
      avgEmailOpenRate90d: round1(filtered.reduce((sum, m) => sum + m.emailOpenRate90d, 0) / count),
      avgWebSessions90d: round1(filtered.reduce((sum, m) => sum + m.webSessions90d, 0) / count),
    };

    const channelMix = Object.entries(
      filtered.reduce<Record<string, number>>((acc, member) => {
        acc[member.predictedChannel] = (acc[member.predictedChannel] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([predictedChannel, memberCount]) => ({ predictedChannel, count: memberCount }));

    const consentSummary = {
      emailOptIn: filtered.filter((m) => m.emailOptIn).length,
      pushOptIn: filtered.filter((m) => m.pushOptIn).length,
      appInstalled: filtered.filter((m) => m.appInstalled).length,
    };

    return {
      members: projected.slice(0, limit),
      engagementSummary,
      channelMix,
      consentSummary,
      definitions: {
        lastLoginDays: "Days since the member last logged into app or web.",
        emailOpenRate90d: "Email open rate over the trailing 90 days.",
        webSessions90d: "Count of web sessions over the trailing 90 days.",
        isDormant: "Heuristic flag: lastLoginDays > 60.",
      },
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
