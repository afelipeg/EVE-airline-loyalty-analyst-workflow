import { defineSchedule } from "eve/schedules";

import slack from "../channels/slack";

// #ai-loyalty-analyst
const LOYALTY_CHANNEL_ID = "C0BK68N0Z32";

export default defineSchedule({
  // Every Monday at 07:00 CDMX (UTC-6) = 13:00 UTC.
  //
  // In a deployed Eve app this becomes a Vercel Cron Job. During local
  // recording, Eve exposes the same path through:
  //   POST /eve/v1/dev/schedules/weekly-loyalty-report
  //
  // That local trigger is useful on camera because it starts the exact same
  // schedule run without waiting for the real weekly cron tick.
  cron: "0 13 * * 1",

  // Handler form: the schedule has no channel of its own, so it hands the
  // work to the Slack channel with `receive`, and the report lands in
  // #ai-loyalty-analyst instead of only in the run stream/logs. The agent can
  // still call tools, subagents, and the sandbox while it works.
  //
  // Workflow SDK note for the demo:
  // Raw Workflow SDK code usually marks an orchestrator function with
  // `"use workflow"`, then marks retryable units of work with `"use step"`.
  // Eve hides that boilerplate here. Under the hood, every scheduled Eve
  // session/turn is still backed by the Workflow SDK, so progress is
  // checkpointed at step boundaries and can resume instead of starting over
  // after a crash, timeout, or redeploy.
  async run({ receive, waitUntil, appAuth }) {
    waitUntil(
      receive(slack, {
        message: [
          "Run the weekly Club Premier loyalty report.",
          "Call query_members with view=network for the fixed-ASK network snapshot, then call query_members with",
          "view=members and sortBy=raskAtRiskMxn to pull the top Retencion Prioritaria members.",
          "Run segment_members with chart=rask_by_segment so the Python segmentation executes in the Eve sandbox.",
          "Delegate to the revenue-analyst subagent for the load-factor/RASK read on the network, and to the",
          "offer-strategist subagent for a retention offer on the top at-risk high-value segment.",
          "Finish with an executive summary framed on RASK / load factor versus the FIXED ASK: RASK-at-risk this",
          "week, RPK exposed, and the top-3 highest-ROI offers.",
          "Close with an Agent Stack note that explicitly calls out Eve, Vercel Workflow, Vercel Sandbox, AI",
          "Gateway, and the Slack channel.",
        ].join(" "),
        target: { channelId: LOYALTY_CHANNEL_ID },
        auth: appAuth,
      }),
    );
  },
});
