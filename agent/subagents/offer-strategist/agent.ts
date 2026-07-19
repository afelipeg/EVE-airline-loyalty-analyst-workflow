import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Design ranked Club Premier retention/growth offers that recover the most RASK per peso of incentive cost.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  limits: {
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 8_000,
  },
});
