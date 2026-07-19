import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Analyze RPK, RASK, load factor, and yield by route and tier against fixed ASK network capacity; keeper of the fixed-ASK doctrine.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  limits: {
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 8_000,
  },
});
