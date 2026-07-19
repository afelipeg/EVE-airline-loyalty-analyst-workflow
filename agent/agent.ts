import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Club Premier Loyalty Analyst — Lead. Unifies Aeromexico CRM/CDP/Rewards/Booking data, scores member " +
    "value and churn, runs sandbox segmentation, and delegates to specialist subagents (crm-analyst, " +
    "cdp-analyst, rewards-analyst, revenue-analyst, offer-strategist) to maximize revenue per fixed ASK.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  compaction: {
    thresholdPercent: 0.78,
  },
  limits: {
    maxInputTokensPerSession: 350_000,
    maxOutputTokensPerSession: 18_000,
    maxSubagentDepth: 2,
  },
});
