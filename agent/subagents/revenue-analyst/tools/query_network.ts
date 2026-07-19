import { defineTool } from "eve/tools";
import { z } from "zod";

import { getNetworkSnapshot, getRouteView, getTierView } from "../../../lib/aeromexico-data.js";

export default defineTool({
  description:
    "Read Aeromexico network RPK, RASK, load factor, and yield by route and tier against fixed ASK capacity. Use before answering network revenue questions.",
  inputSchema: z.object({
    view: z.enum(["network", "route", "tier"]).default("network"),
    route: z.string().optional().describe("Route code, e.g. MEX-GDL. Narrows the route view."),
  }),
  async execute({ route, view }) {
    const snapshot = getNetworkSnapshot();
    const byTier = getTierView();

    let byRoute = snapshot.byRoute;
    if (route) {
      const routeView = getRouteView(route);
      byRoute = routeView.snapshot ? [routeView.snapshot] : [];
    }

    return {
      view,
      network: {
        askMillions: snapshot.askMillions,
        rpkMillions: snapshot.rpkMillions,
        loadFactor: snapshot.loadFactor,
        raskMxn: snapshot.raskMxn,
        yieldMxnPerKm: snapshot.yieldMxnPerKm,
        ancillaryShare: snapshot.ancillaryShare,
      },
      byRoute,
      byTier,
      notes: [
        "ASK (available seat-km) is fixed network capacity; it does not respond to loyalty or marketing actions.",
        "Loyalty and marketing actions move RPK, load factor, yield, and RASK — never ASK.",
        "RASK = (passenger revenue + ancillary revenue) / ASK. Yield = passenger revenue / paid RPK.",
        "This tool has no row limit: `byRoute` covers the whole network (or the single requested route) and " +
          "`byTier` all five tiers, so nothing here is truncated. Quote the returned figures as-is rather than " +
          "re-deriving them from the rows.",
      ],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
