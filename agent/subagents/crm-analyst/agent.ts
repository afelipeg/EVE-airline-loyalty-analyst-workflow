import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Analyze Club Premier member identity, tier health, service friction, and corporate accounts from CRM data.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  limits: {
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 8_000,
  },
});
