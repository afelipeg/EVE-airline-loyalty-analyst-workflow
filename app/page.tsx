import { cookies } from "next/headers";

import { AgentChat } from "@/app/_components/agent-chat";
import { SESSION_COOKIE, readSessionToken } from "@/agent/lib/auth/session";

export default async function Page() {
  // proxy.ts already redirected anyone without a valid session.
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  return <AgentChat userEmail={session?.email ?? ""} />;
}
