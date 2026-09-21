import { defineHook } from "eve/hooks";

import { turnEvidence } from "../lib/verification/state.js";
import { verifyReply } from "../lib/verification/verify.js";

// Observe-only reply verification (numbers, scope, policies). eve hooks cannot
// block or edit a reply, so this logs a structured report for review and for
// the t5 UI panel. Off unless JEV_VERIFY=1, so default agent behavior is
// unchanged. It never throws: a throwing hook fails the whole turn.
const enabled = () => process.env.JEV_VERIFY === "1";

export default defineHook({
  events: {
    "turn.started"() {
      if (enabled()) turnEvidence.update(() => ({ inputs: {}, calls: [] }));
    },
    "actions.requested"(event) {
      if (!enabled()) return;
      // Tool inputs (filters) arrive here; results arrive without them.
      const inputs = Object.fromEntries(
        event.data.actions.filter((a) => a.kind === "tool-call").map((a) => [a.callId, a.input]),
      );
      turnEvidence.update((s) => ({ ...s, inputs: { ...s.inputs, ...inputs } }));
    },
    "action.result"(event) {
      if (!enabled()) return;
      const r = event.data.result;
      if (r.isError || r.kind === "load-skill-result") return;
      const tool = r.kind === "tool-result" ? r.toolName : r.subagentName;
      turnEvidence.update((s) => ({
        ...s,
        calls: [...s.calls, { tool, input: s.inputs[r.callId], output: r.output }],
      }));
    },
    async "message.completed"(event, ctx) {
      if (!enabled()) return;
      const { finishReason, message } = event.data;
      if ((finishReason !== "stop" && finishReason !== "length") || !message) return;
      try {
        const report = await verifyReply(message, turnEvidence.get().calls);
        console.info("[verify-reply]", JSON.stringify({ sessionId: ctx.session.id, ...report }));
      } catch (error) {
        console.error("[verify-reply] skipped", error);
      }
    },
  },
});
