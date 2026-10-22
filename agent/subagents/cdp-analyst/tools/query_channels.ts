import { defineTool } from "eve/tools";
import { z } from "zod";

import { getAttribution, getChannelFunnel } from "../../../lib/cdp/attribution.js";

export default defineTool({
  description:
    "Read channel engagement and conversion from identity-resolved CDP data: the sent -> opened -> clicked -> " +
    "converted funnel for email, push and in-app, plus per-campaign opens, clicks, cost and attributed revenue. " +
    "Use before ranking channels by engagement or conversion.",
  inputSchema: z.object({}),
  async execute() {
    const attribution = getAttribution("last_touch");
    return {
      window: attribution.window,
      funnel: getChannelFunnel(),
      campaigns: attribution.byCampaign,
      definitions: {
        converted: "Bookings in the window whose last resolved touch was this channel (last-touch credit).",
        revenuePerPesoCost: "Last-touch attributed revenue divided by send cost. Not incremental lift.",
      },
      notes: [
        "Counts come from identity-resolved records only. Quote them as returned.",
        "High engagement is not high RASK: compare with attribute_rask on the revenue analyst before ranking channels by value.",
      ],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
