import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Analyze Club Premier engagement decay, channel propensity, consent, and NPS/behavioral segments from CDP data; " +
      "resolve web, app, campaign and ancillary-order activity to members and report the channel engagement funnel.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  limits: {
    maxInputTokensPerSession: 120_000,
    maxOutputTokensPerSession: 8_000,
  },
});
