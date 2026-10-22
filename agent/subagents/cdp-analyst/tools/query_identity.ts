import { defineTool } from "eve/tools";
import { z } from "zod";

import { getIdentityGraph, getIdentitySummary } from "../../../lib/cdp/identity.js";
import { getCdpSources } from "../../../lib/cdp/sources.js";

export default defineTool({
  description:
    "Read the CDP identity graph: how web, app, campaign (ESP) and ancillary-order records resolve to Club Premier " +
    "members, coverage per source, and the over-merge guardrails. Pass memberId for that member's unified profile " +
    "and resolved activity timeline. Use before answering identity, coverage or customer-journey questions.",
  inputSchema: z.object({
    memberId: z.string().optional().describe("Return the unified profile and timeline for this member."),
    timelineLimit: z.number().int().min(1).max(100).default(30),
  }),
  async execute({ memberId, timelineLimit }) {
    const summary = getIdentitySummary();
    if (!memberId) {
      return {
        ...summary,
        definitions: {
          rules: "member_id and pnr are exact; email_hash and phone match one CRM contact; device and cookie link only after a sign-in by exactly one member within 30 days.",
          blockedByGuardrail: "Records deliberately left unresolved because the identifier is shared (family device, agency inbox).",
          overMerges: "Identifiers held by two profiles. Must be 0.",
        },
      };
    }

    const graph = getIdentityGraph();
    const cluster = graph.clusters.get(memberId);
    if (!cluster) return { error: `No CRM member ${memberId}.`, availableExample: [...graph.clusters.keys()].slice(0, 3) };

    const sources = getCdpSources();
    const owned = (id: string) => graph.resolutions.get(id)?.memberId === memberId;
    const ruleOf = (id: string) => graph.resolutions.get(id)?.rule;
    const timeline = [
      ...sources.events.filter((e) => owned(e.eventId)).map((e) => ({
        date: e.date,
        source: e.source,
        type: e.type,
        detail: e.route ?? e.bookingId ?? e.campaignId ?? null,
        matchedBy: ruleOf(e.eventId),
      })),
      ...sources.sends.filter((s) => owned(s.sendId)).map((s) => ({
        date: s.sentDate,
        source: "esp",
        type: `${s.channel}_send${s.clicked ? "_clicked" : s.opened ? "_opened" : ""}`,
        detail: s.campaignId,
        matchedBy: ruleOf(s.sendId),
      })),
      ...sources.ancillaryOrders.filter((o) => owned(o.orderId)).map((o) => ({
        date: o.orderDate,
        source: "ancillary",
        type: "ancillary_order",
        detail: `${o.amountMxn} MXN (${o.items.map((i) => i.type).join(", ")})`,
        matchedBy: ruleOf(o.orderId),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return {
      memberId,
      identifiers: {
        devices: cluster.devices.length,
        cookies: cluster.cookies.length,
        pnrs: cluster.pnrs.length,
      },
      activityCounts: timeline.reduce<Record<string, number>>((acc, item) => {
        acc[item.source] = (acc[item.source] ?? 0) + 1;
        return acc;
      }, {}),
      timeline: timeline.slice(0, timelineLimit),
      notes: [`${timeline.length} resolved records for ${memberId}; showing the latest ${Math.min(timelineLimit, timeline.length)}.`],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
