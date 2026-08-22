import { defineSchedule } from "eve/schedules";

import slack from "../channels/slack";

// Demo Slack destination. Replace with a governed CS leadership channel in production.
const SUCCESS_CHANNEL_ID = "C0BK68N0Z32";

export default defineSchedule({
  // Monday 07:00 CDMX / 13:00 UTC.
  cron: "0 13 * * 1",
  async run({ receive, waitUntil, appAuth }) {
    waitUntil(
      receive(slack, {
        message: [
          "Run the Global Customer Success Monday portfolio review using the synthetic interview dataset.",
          "Call query_accounts and prioritize: renewals inside 90 days, ARR at risk, Protect Now accounts,",
          "accounts without value proof, and healthy accounts with credible expansion readiness.",
          "Separate diagnosis into adoption gap, maintenance-value gap, support friction, and executive relationship risk.",
          "Return five leadership actions with account owner motion, success metric, protected ARR, and only then",
          "responsible expansion potential. Never recommend expansion for an unstable account.",
          "State clearly that the portfolio is synthetic and that the run uses Eve durable workflow orchestration.",
        ].join(" "),
        target: { channelId: SUCCESS_CHANNEL_ID },
        auth: appAuth,
      }),
    );
  },
});
