"use client";

import { Client } from "eve/client";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { EvidenceCall } from "@/agent/lib/verification/numbers";
import type { VerifyReport } from "@/agent/lib/verification/verify";

type StreamEvent = { readonly type: string; readonly data?: unknown };
type Rec = Record<string, unknown>;
type JevItem = { readonly agent: string; readonly reply: string; readonly calls: EvidenceCall[] };
export type JevReport = { readonly agent: string; readonly report: VerifyReport };

const LABELS: Record<string, string> = {
  pulse: "Lead",
  "crm-analyst": "CRM Analyst",
  "cdp-analyst": "CDP Analyst",
  "rewards-analyst": "Rewards Analyst",
  "revenue-analyst": "Revenue Analyst",
  "offer-strategist": "Offer Strategist",
};

const CHECK_LABELS: Record<string, string> = {
  growsAsk: "Implies loyalty grows ASK",
  claimsSent: "Claims something was sent",
  premierDiscount: "Blanket Premier discount",
  assumptionAsMeasured: "Projection stated as fact",
};

// Rebuilds, for the latest turn, what each agent said and the evidence it had,
// mirroring the verify-reply hook: tool/subagent results (with the inputs from
// actions.requested), loaded skills, and the incoming brief. Each specialist is
// scored on its own child session, so its reasoning is evaluated separately.
export function buildJevItems(events: readonly StreamEvent[]) {
  const start = events.findLastIndex((e) => e.type === "turn.started");
  const turn = start === -1 ? events : events.slice(start);

  const collect = (stream: readonly StreamEvent[], agent: string): JevItem | null => {
    const inputs: Rec = {};
    const calls: EvidenceCall[] = [];
    let reply = "";
    for (const e of stream) {
      const d = (e.data ?? {}) as Rec;
      if (e.type === "message.received") calls.push({ tool: "message.received", output: d.message });
      if (e.type === "actions.requested") {
        for (const a of (d.actions ?? []) as Rec[]) if (a.kind === "tool-call") inputs[String(a.callId)] = a.input;
      }
      if (e.type === "action.result") {
        const r = (d.result ?? {}) as Rec;
        if (r.isError) continue;
        const tool = String(r.toolName ?? r.subagentName ?? r.name ?? "load_skill");
        calls.push({ tool, input: inputs[String(r.callId)], output: r.output });
      }
      if (e.type === "message.completed" && (d.finishReason === "stop" || d.finishReason === "length")) {
        reply = String(d.message ?? "");
      }
    }
    return reply ? { agent, reply, calls } : null;
  };

  const lead = collect(turn, "pulse");
  if (!lead) return null;

  // The parent stream carries only subagent.called/completed; each specialist's
  // own reasoning lives in its child session, read separately below.
  const children = turn
    .filter((e) => e.type === "subagent.called")
    .map((e) => e.data as { childSessionId?: string; name: string })
    .filter((d): d is { childSessionId: string; name: string } => Boolean(d.childSessionId));

  return { key: `${events.length}:${lead.reply.length}`, lead, children, collect };
}

const client = new Client({ host: "" });

// Reads a finished child session's stream from the start, same origin.
async function readChild(sessionId: string): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of client.session({ sessionId, streamIndex: 0 }).stream()) {
    events.push(event as StreamEvent);
    if (event.type === "turn.completed" || event.type === "session.waiting" || event.type === "session.completed") break;
  }
  return events;
}

// Evaluates each completed turn once, after the stream settles.
export function useJevReports(events: readonly StreamEvent[], idle: boolean) {
  const [state, setState] = useState<{ key: string; loading: boolean; reports: JevReport[]; error?: string } | null>(null);

  useEffect(() => {
    if (!idle) return;
    const built = buildJevItems(events);
    if (!built || built.key === state?.key) return;
    setState({ key: built.key, loading: true, reports: [] });
    Promise.all(built.children.map(async (c) => built.collect(await readChild(c.childSessionId), c.name)))
      .then((subagents) => {
        const items = [built.lead, ...subagents.filter((i): i is JevItem => i !== null)];
        return fetch("/api/jev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { reports: JevReport[] }) => setState({ key: built.key, loading: false, reports: body.reports }))
      .catch((error: Error) => setState({ key: built.key, loading: false, reports: [], error: error.message }));
  }, [events, idle, state?.key]);

  return state;
}

export function JevPanel({ state }: { readonly state: ReturnType<typeof useJevReports> }) {
  if (!state) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Ask a question. When the turn finishes, Jev scores the Lead&apos;s answer and each subagent&apos;s reasoning:
        figures backed by tool output, scope, and the four loyalty policies.
      </p>
    );
  }
  if (state.loading) return <p className="text-sm text-muted-foreground">Jev is evaluating the last turn…</p>;
  if (state.error) return <p className="text-sm text-accent-rose">Jev evaluation failed: {state.error}</p>;
  if (state.reports.length === 0) return <p className="text-sm text-muted-foreground">No final reply to evaluate yet.</p>;

  return (
    <div className="grid gap-3">
      {state.reports.map(({ agent, report }) => (
        <JevAgentTile agent={agent} key={agent} report={report} />
      ))}
      <p className="text-[11px] leading-4 text-muted-foreground">
        Observe-only: agents reason, Jev evaluates. Figures are checked against this turn&apos;s tool and subagent
        output; scope and policies are Jev judgments.
      </p>
    </div>
  );
}

function JevAgentTile({ agent, report }: { readonly agent: string; readonly report: VerifyReport }) {
  const unsupported = report.numbers.misses.length + report.numbers.unknownIds.length;
  const scopeFlags = report.scope.filter((s) => s.flag);

  return (
    <div className="metric-tile">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{LABELS[agent] ?? agent}</p>
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono text-[11px]",
            report.pass ? "bg-accent-turquoise/10 text-accent-turquoise" : "bg-accent-rose/10 text-accent-rose",
          )}
        >
          {report.pass ? "PASS" : "REVIEW"}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-mono text-2xl font-semibold">
          {report.numbers.checkedCount - report.numbers.misses.length}/{report.numbers.checkedCount}
        </span>
        <span className="text-xs text-muted-foreground">figures backed by tools</span>
      </div>
      {unsupported + scopeFlags.length + report.policy.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-xs">
          {report.numbers.misses.slice(0, 4).map((m, i) => (
            <li className="text-accent-rose" key={`n${i}`}>
              Unsupported figure <span className="font-mono">{m.figure}</span>
            </li>
          ))}
          {report.numbers.unknownIds.map((id) => (
            <li className="text-accent-rose" key={id}>
              Unknown member <span className="font-mono">{id}</span>
            </li>
          ))}
          {scopeFlags.map((s, i) => (
            <li className="text-accent-gold" key={`s${i}`}>
              Scope {s.flag}: <span className="font-mono">{s.figure}</span>
            </li>
          ))}
          {report.policy.map((p, i) => (
            <li className="text-accent-gold" key={`p${i}`}>
              {CHECK_LABELS[p.check] ?? p.check} <span className="font-mono">p={p.p.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!report.jev ? <p className="mt-2 text-[11px] text-muted-foreground">Figures only: TYPESAFE_API_KEY not set.</p> : null}
    </div>
  );
}
