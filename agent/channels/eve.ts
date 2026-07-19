import { eveChannel } from "eve/channels/eve";
import { localDev, none, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
    // Public demo mode: anyone with the URL can chat with the agent.
    // This is deliberate, and safe ONLY because of the compensating controls:
    // the dataset is synthetic, there are no send/write tools, sandbox egress
    // is deny-all, and every dangerous framework tool (bash, web_fetch,
    // write_file, ...) is disabled via the sentinels in tools/ and
    // subagents/*/tools/. Token spend is capped by a Vercel WAF rate limit.
    // Replace with app auth before any real customer data reaches this agent.
    none(),
  ],
});
