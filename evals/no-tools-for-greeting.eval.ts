import { defineEval } from "eve/evals";

// A greeting must not trigger a dataset read or a subagent delegation. This is
// the token-economy guard: without it, an over-eager orchestrator can fan out to
// five specialists to answer "hola".
export default defineEval({
  description: "A plain greeting answers directly without touching any tool.",
  async test(t) {
    await t.send("Hola");

    t.succeeded();
    // If this proves flaky because the model reaches for load_skill on a
    // greeting, narrow it to notCalledTool("query_members") + the subagents
    // rather than deleting the eval — the fan-out is the thing worth guarding.
    t.usedNoTools();
  },
});
