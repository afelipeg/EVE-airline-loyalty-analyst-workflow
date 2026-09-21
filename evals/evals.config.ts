import { defineEvalConfig } from "eve/evals";

// No judge model on purpose: every assertion in this suite is deterministic, so
// the suite never spends tokens on grading. Evals still bill the gateway for the
// agent's own turns, so run them deliberately with `pnpm eval`, not on every push.
// Exception: evals/verification/jev-*.eval.ts measure TypeSafe's Jev and bill
// TypeSafe; they skip without TYPESAFE_API_KEY.
export default defineEvalConfig({});
