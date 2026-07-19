import { defineTool } from "eve/tools";
import { z } from "zod";

import { getNetworkSnapshot, getUnifiedMembers } from "../lib/aeromexico-data.js";

const TIERS = ["Clasico", "Plata", "Oro", "Platino", "Titanio"] as const;
const HUBS = ["MEX", "GDL", "MTY"] as const;
const SEGMENTS = ["Retencion Prioritaria", "Embajadores", "En Riesgo", "Base"] as const;
const SORT_FIELDS = ["valueScore", "churnRisk", "rpk12m", "clvMxn", "raskAtRiskMxn"] as const;

const FIXED_ASK_DOCTRINE =
  "ASK (Available Seat Kilometers) is fixed network capacity for this period. Loyalty cannot change ASK " +
  "— it changes how efficiently that fixed ASK converts to revenue via load factor (RPK/ASK), RASK, " +
  "yield, ancillary attach, and retained CLV. Frame recommendations as maximizing revenue per ASK, never " +
  "as adding capacity.";

export default defineTool({
  description:
    "Read the unified Club Premier member and network dataset (CRM + CDP + Rewards + Bookings joined, " +
    "with value/churn scores and route/tier rollups). Use before answering any question about members, " +
    "segments, tiers, routes, or network revenue efficiency. Never returns raw bookings.",
  inputSchema: z.object({
    view: z.enum(["members", "network", "route", "tier"]).default("members"),
    tier: z.array(z.enum(TIERS)).optional().describe("Filter to these Club Premier tiers."),
    hub: z.array(z.enum(HUBS)).optional().describe("Filter to these home hubs."),
    route: z.string().optional().describe("Filter to members who flew this route, e.g. MEX-LAX."),
    segment: z.enum(SEGMENTS).optional().describe("Filter to this value/churn segment."),
    minValueScore: z.number().min(0).max(100).optional(),
    minChurnRisk: z.number().min(0).max(100).optional(),
    sortBy: z.enum(SORT_FIELDS).default("valueScore"),
    limit: z.number().int().min(1).max(200).default(50),
  }),
  async execute({ view, tier, hub, route, segment, minValueScore, minChurnRisk, sortBy, limit }) {
    const network = getNetworkSnapshot();
    const allMembers = getUnifiedMembers();

    const filtered = allMembers.filter((member) => {
      if (tier && tier.length > 0 && !tier.includes(member.tier)) return false;
      if (hub && hub.length > 0 && !hub.includes(member.homeHub)) return false;
      if (route && !member.routesFlown.includes(route)) return false;
      if (segment && member.segment !== segment) return false;
      if (minValueScore !== undefined && member.valueScore < minValueScore) return false;
      if (minChurnRisk !== undefined && member.churnRisk < minChurnRisk) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);
    const members = sorted.slice(0, limit);

    return {
      view,
      network,
      members,
      availableFilters: {
        tiers: TIERS,
        hubs: HUBS,
        segments: SEGMENTS,
        routes: network.byRoute.map((entry) => entry.route),
      },
      definitions: {
        valueScore: "0-100 composite of CLV, RPK, revenue, tier, co-brand spend. >=60 is high value.",
        churnRisk:
          "0-100 composite of flight recency, app/web engagement, frequency, CSAT, and service friction. >=50 is high risk.",
        raskAtRiskMxn:
          "Trailing-12m passenger + ancillary revenue weighted by churnRisk — the RASK exposure if the member churns.",
        segment:
          "Retencion Prioritaria (high value + high risk), Embajadores (high value), En Riesgo (high risk), Base (neither).",
      },
      notes: [
        FIXED_ASK_DOCTRINE,
        `${filtered.length} of ${allMembers.length} members matched the filters; showing ${members.length}.`,
      ],
    };
  },
  toModelOutput(output) {
    const segmentAggregates = SEGMENTS.map((segmentName) => {
      const inSegment = output.members.filter((member) => member.segment === segmentName);
      const count = inSegment.length;
      const avgValueScore = count === 0 ? 0 : inSegment.reduce((sum, m) => sum + m.valueScore, 0) / count;
      const avgChurnRisk = count === 0 ? 0 : inSegment.reduce((sum, m) => sum + m.churnRisk, 0) / count;

      return {
        segment: segmentName,
        count,
        avgValueScore: Math.round(avgValueScore * 10) / 10,
        avgChurnRisk: Math.round(avgChurnRisk * 10) / 10,
        totalRaskAtRiskMxn: Math.round(inSegment.reduce((sum, m) => sum + m.raskAtRiskMxn, 0)),
      };
    });

    return {
      type: "json",
      value: {
        view: output.view,
        network: output.network,
        members: output.members,
        segmentAggregates,
        tierAggregates: output.network.byTier,
        availableFilters: output.availableFilters,
        definitions: output.definitions,
        notes: output.notes,
      },
    };
  },
});
