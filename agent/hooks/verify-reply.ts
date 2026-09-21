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
      if (enabled()) turnEvidence.update((s) => ({ ...s, inputs: {}, calls: [] }));
    },
    "message.received"(event) {
      if (enabled()) turnEvidence.update((s) => ({ ...s, received: event.data.message }));
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
      if (r.isError) return;
      // Loaded skills count as evidence: the offer playbook is where recovery
      // factors like 0.45 come from.
      const tool =
        r.kind === "tool-result" ? r.toolName : r.kind === "subagent-result" ? r.subagentName : (r.name ?? "load_skill");
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
        const { calls, received } = turnEvidence.get();
        const report = await verifyReply(message, [...calls, { tool: "message.received", output: received }]);
        console.info("[verify-reply]", JSON.stringify({ agent: ctx.agent.name, sessionId: ctx.session.id, ...report }));
      } catch (error) {
        console.error("[verify-reply] skipped", error);
      }
    },
  },
});
