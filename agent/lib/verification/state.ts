// Durable per-session slot for this turn's tool evidence. Hook handlers can run
// on different workflow steps, so evidence lives in eve state, not memory.
import { defineState } from "eve/context";

import type { EvidenceCall } from "./numbers.js";

export const turnEvidence = defineState("verify-reply.turn", () => ({
  inputs: {} as Record<string, unknown>,
  calls: [] as EvidenceCall[],
  // The incoming message: for a subagent, the Lead's brief with the figures it
  // hands down, which the subagent may quote.
  received: "",
}));
