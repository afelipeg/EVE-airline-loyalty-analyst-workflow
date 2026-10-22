import { defineTool } from "eve/tools";
import { z } from "zod";

import { getAttribution, getHoldoutLift } from "../../../lib/cdp/attribution.js";

export default defineTool({
  description:
    "Attribute revenue from bookings made in the last 90 days to channels and campaigns, and convert it to RASK " +
    "against the fixed network ASK. Models: position_based (default), linear, last_touch. Also returns the " +
    "treated-vs-holdout comparison. Use before answering which channel or campaign moves RASK.",
  inputSchema: z.object({
    model: z.enum(["position_based", "linear", "last_touch"]).default("position_based"),
  }),
  async execute({ model }) {
    return { ...getAttribution(model), holdout: getHoldoutLift() };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
