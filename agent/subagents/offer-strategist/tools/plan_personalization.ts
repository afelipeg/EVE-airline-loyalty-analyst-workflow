import { defineTool } from "eve/tools";
import { z } from "zod";

import { getUnifiedMembers } from "../../../lib/aeromexico-data.js";
import { planMembers } from "../../../lib/cdp/personalization.js";

export default defineTool({
  description:
    "Decide, per member, the channel (email, push or in-app) and weekday for an offer, from identity-resolved " +
    "engagement, with consent, frequency-cap and holdout guardrails applied. Use after design_offers, passing the " +
    "offer each member should get. Returns a plan the Lead must have a human approve; nothing is sent.",
  inputSchema: z.object({
    // Only memberId and the offer label are read; every number comes from the dataset.
    members: z
      .array(z.object({ memberId: z.string(), offer: z.string().describe("Offer name from design_offers.") }))
      .max(200)
      .optional(),
    segment: z.enum(["Retencion Prioritaria", "Embajadores", "En Riesgo", "Base"]).optional(),
  }),
  async execute({ members, segment }) {
    const offerOf = new Map((members ?? []).map((m) => [m.memberId, m.offer]));
    const ids =
      members && members.length > 0
        ? members.map((m) => m.memberId)
        : getUnifiedMembers()
            .filter((m) => !segment || m.segment === segment)
            .map((m) => m.memberId);
    const { plans, summary } = planMembers(ids);
    return {
      summary,
      plans: plans.map((plan) => ({ ...plan, offer: offerOf.get(plan.memberId) ?? null })),
      notes: [
        "Holdout members stay out on purpose: they are the control group for measuring lift.",
        "Nothing is sent. Pass the ready rows to the Lead's record_activation_spec, which requires human approval.",
      ],
    };
  },
  toModelOutput(output) {
    return { type: "json", value: output };
  },
});
