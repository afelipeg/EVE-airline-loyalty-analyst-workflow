import { verifyReply } from "@/agent/lib/verification/verify";
import type { EvidenceCall } from "@/agent/lib/verification/numbers";

// Runs the same observe-only verifier as the verify-reply hook, on evidence the
// browser already holds from the session stream, so the Jev panel can show it.
// TYPESAFE_API_KEY stays server-side. Caps bound TypeSafe spend on this public
// demo (the Vercel WAF rate limit covers request volume).
const MAX_ITEMS = 6;
const MAX_REPLY_CHARS = 20_000;

type Item = { readonly agent: string; readonly reply: string; readonly calls: readonly EvidenceCall[] };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { items?: Item[] } | null;
  const items = (body?.items ?? [])
    .filter((item) => typeof item?.reply === "string" && item.reply.length > 0 && Array.isArray(item.calls))
    .slice(0, MAX_ITEMS);
  if (items.length === 0) return Response.json({ reports: [] });

  const reports = await Promise.all(
    items.map(async (item) => ({
      agent: String(item.agent),
      report: await verifyReply(item.reply.slice(0, MAX_REPLY_CHARS), item.calls),
    })),
  );
  return Response.json({ reports });
}
