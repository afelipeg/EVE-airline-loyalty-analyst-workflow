import { cookies } from "next/headers";

import { AgentChat } from "@/app/_components/agent-chat";
import { getUnifiedMembers } from "@/agent/lib/aeromexico-data";
import { SESSION_COOKIE, readSessionToken } from "@/agent/lib/auth/session";
import {
  ATTRIBUTION_MODELS,
  getAttribution,
  getChannelFunnel,
  getEngagementByWeek,
  getEngagementVsRask,
  getHoldoutLift,
  getRaskDrivers,
} from "@/agent/lib/cdp/attribution";
import { getIdentitySummary } from "@/agent/lib/cdp/identity";
import { planMembers } from "@/agent/lib/cdp/personalization";

export default async function Page() {
  // proxy.ts already redirected anyone without a valid session.
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  // The CDP modules are server-only; the views get plain, serializable data.
  const [last_touch, linear, position_based] = ATTRIBUTION_MODELS.map((model) => getAttribution(model));
  const [vsLastTouch, vsLinear, vsPositionBased] = ATTRIBUTION_MODELS.map((model) => getEngagementVsRask(model));
  const [driversLastTouch, driversLinear, driversPositionBased] = ATTRIBUTION_MODELS.map((model) => getRaskDrivers(model));
  return (
    <AgentChat
      attribution={{
        byModel: { last_touch, linear, position_based },
        funnel: getChannelFunnel(),
        holdout: getHoldoutLift(),
        engagementByWeek: getEngagementByWeek(),
        engagementVsRask: { last_touch: vsLastTouch, linear: vsLinear, position_based: vsPositionBased },
      }}
      drivers={{ last_touch: driversLastTouch, linear: driversLinear, position_based: driversPositionBased }}
      identity={getIdentitySummary()}
      personalization={planMembers(getUnifiedMembers().map((member) => member.memberId))}
      userEmail={session?.email ?? ""}
    />
  );
}
