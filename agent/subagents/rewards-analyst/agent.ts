import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Analyze Club Premier Puntos Premier points economy, redemptions, co-brand card performance, and CLV.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  limits: {
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 8_000,
  },
});
