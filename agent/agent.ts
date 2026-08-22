import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Customer Success Command Center — Global CS orchestrator. Unifies portfolio health, product adoption, maintenance value realization, support friction, renewal exposure, and expansion readiness to prioritize interventions that protect GRR and compound NRR.",
  model: "anthropic/claude-sonnet-5",
  reasoning: "medium",
  compaction: {
    thresholdPercent: 0.78,
  },
  limits: {
    maxInputTokensPerSession: 350_000,
    maxOutputTokensPerSession: 18_000,
  },
});
