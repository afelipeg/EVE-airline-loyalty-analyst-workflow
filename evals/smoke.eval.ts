import { defineEval } from "eve/evals";

// Catches the "model stopped consulting the source of truth" regression. The
// agent is required to read the dataset before answering member questions
// rather than inventing numbers, so query_members must actually fire.
export default defineEval({
  description: "A real member question reads the dataset and completes cleanly.",
  async test(t) {
    await t.send("Which Titanio and Platino members are highest RASK-at-risk this month?");

    t.succeeded();
    t.calledTool("query_members");
    t.noFailedActions();
  },
});
