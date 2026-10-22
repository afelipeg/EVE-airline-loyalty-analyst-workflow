import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

import { planMembers } from "../lib/cdp/personalization.js";

export default defineTool({
  description:
    "Record a personalization activation spec (member, offer, channel, weekday) after a human approves it. " +
    "Re-checks consent, holdout and frequency cap; rows that fail are dropped and listed. Nothing is sent: v1 " +
    "has no outbound messaging, so the result is a spec for the CRM team.",
  inputSchema: z.object({
    name: z.string().describe("Short name for the activation, e.g. 'Retencion Titanio julio'."),
    rows: z.array(z.object({ memberId: z.string(), offer: z.string() })).min(1).max(200),
  }),
  approval: always(),
  async execute({ name, rows }) {
    const { plans } = planMembers(rows.map((r) => r.memberId));
    const offerOf = new Map(rows.map((r) => [r.memberId, r.offer]));
    const accepted = plans.filter((p) => p.status === "ready");
    const dropped = plans.filter((p) => p.status !== "ready").map((p) => ({ memberId: p.memberId, status: p.status, reason: p.reason }));
    return {
      specId: `ACT-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 24)}-${accepted.length}`,
      name,
      status: "approved_spec_not_sent",
      rows: accepted.map((p) => ({ memberId: p.memberId, offer: offerOf.get(p.memberId), channel: p.channel, sendWeekday: p.sendWeekday })),
      dropped,
      raskAtRiskCoveredMxn: Math.round(accepted.reduce((sum, p) => sum + p.raskAtRiskMxn, 0)),
      notes: ["Approved by a human in this session. Nothing was sent; hand this spec to the CRM team."],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
