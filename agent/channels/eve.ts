import { eveChannel } from "eve/channels/eve";
import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";

import { readSessionFromCookieHeader } from "../lib/auth/session";

// The web chat sends the sign-in cookie on every eve request (same origin), so
// only the allowed users signed in at /login can reach the agent.
function appSession(): AuthFn<Request> {
  return async (request) => {
    const session = readSessionFromCookieHeader(request.headers.get("cookie"));
    if (!session) return null;
    return {
      authenticator: "app",
      principalId: session.email,
      principalType: "user",
      attributes: { email: session.email },
    };
  };
}

export default eveChannel({
  auth: [
    appSession(),
    // Lets the eve TUI, subagents and the runtime reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
  ],
});
