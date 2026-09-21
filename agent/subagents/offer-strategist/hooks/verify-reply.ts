// Subagent hooks are isolated from the Lead's, so each specialist mounts the
// same observe-only verifier to have its own handoff evaluated by Jev.
export { default } from "../../../hooks/verify-reply.js";
