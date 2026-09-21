"use client";

import { Client } from "eve/client";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { EvidenceCall } from "@/agent/lib/verification/numbers";
import { POLICY_CHECKS, POLICY_THRESHOLDS, type PolicyCheck } from "@/agent/lib/verification/policy";
import type { VerifyReport } from "@/agent/lib/verification/verify";

type StreamEvent = { readonly type: string; readonly data?: unknown };
type Rec = Record<string, unknown>;
type JevItem = { readonly agent: string; readonly reply: string; readonly calls: EvidenceCall[] };
type Entry = { readonly agent: string; readonly status: "evaluating" | "done" | "error"; readonly report?: VerifyReport };

const LABELS: Record<string, string> = {
  pulse: "Lead",
  "crm-analyst": "CRM Analyst",
  "cdp-analyst": "CDP Analyst",
  "rewards-analyst": "Rewards Analyst",
  "revenue-analyst": "Revenue Analyst",
  "offer-strategist": "Offer Strategist",
};

const CHECK_LABELS: Record<PolicyCheck, string> = {
  growsAsk: "Loyalty grows ASK",
  claimsSent: "Claims it was sent",
  premierDiscount: "Blanket Premier discount",
  assumptionAsMeasured: "Projection as fact",
};

// What an agent said in one turn and the evidence it had, mirroring the
// verify-reply hook: tool/subagent results (inputs from actions.requested),
// loaded skills, and the incoming brief.
function collect(stream: readonly StreamEvent[], agent: string): JevItem | null {
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
      calls.push({ tool: String(r.toolName ?? r.subagentName ?? r.name ?? "load_skill"), input: inputs[String(r.callId)], output: r.output });
    }
    if (e.type === "message.completed" && (d.finishReason === "stop" || d.finishReason === "length")) {
      reply = String(d.message ?? "");
    }
  }
  return reply ? { agent, reply, calls } : null;
}

const client = new Client({ host: "" });

// The parent stream carries only subagent.called/completed; a specialist's own
// reasoning lives in its child session, read here once it has completed.
async function readChild(sessionId: string): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of client.session({ sessionId, streamIndex: 0 }).stream()) {
    events.push(event as StreamEvent);
    if (event.type === "turn.completed" || event.type === "session.waiting" || event.type === "session.completed") break;
  }
  return events;
}

async function evaluate(item: JevItem): Promise<VerifyReport> {
  const response = await fetch("/api/jev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [item] }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { reports: { report: VerifyReport }[] };
  return body.reports[0].report;
}

// Live: each subagent is evaluated as soon as its subagent.completed arrives;
// the Lead once the turn settles. Entries reset on every new turn.
export function useJevReports(events: readonly StreamEvent[], idle: boolean) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const started = useRef<{ turn: number; keys: Set<string> }>({ turn: -1, keys: new Set() });

  useEffect(() => {
    const turnStart = events.findLastIndex((e) => e.type === "turn.started");
    if (turnStart === -1) return;
    if (started.current.turn !== turnStart) {
      started.current = { turn: turnStart, keys: new Set() };
      setEntries({});
    }
    const turn = events.slice(turnStart);
    const run = (key: string, agent: string, load: () => Promise<JevItem | null>) => {
      if (started.current.keys.has(key)) return;
      started.current.keys.add(key);
      setEntries((prev) => ({ ...prev, [key]: { agent, status: "evaluating" } }));
      load()
        .then((item) => (item ? evaluate(item) : Promise.reject(new Error("no reply"))))
        .then((report) => setEntries((prev) => ({ ...prev, [key]: { agent, status: "done", report } })))
        .catch(() => setEntries((prev) => ({ ...prev, [key]: { agent, status: "error" } })));
    };

    const children = new Map<string, { name: string; childSessionId?: string }>();
    for (const e of turn) {
      const d = (e.data ?? {}) as Rec;
      if (e.type === "subagent.called") children.set(String(d.callId), { name: String(d.name), childSessionId: d.childSessionId as string | undefined });
      if (e.type === "subagent.completed") {
        const child = children.get(String(d.callId));
        if (child?.childSessionId) run(String(d.callId), child.name, async () => collect(await readChild(child.childSessionId!), child.name));
      }
    }
    // A turn parked on a question to the user has no final reply to score.
    const lead = idle ? collect(turn, "pulse") : null;
    if (lead) run("lead", "pulse", async () => lead);
  }, [events, idle]);

  return Object.values(entries);
}

export function JevPanel({ entries }: { readonly entries: readonly Entry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Ask a question. As each subagent finishes reasoning, Jev scores it here, then the Lead&apos;s final answer:
        figures backed by tool output, scope, and the four loyalty policies.
      </p>
    );
  }
  const counts = { pass: 0, review: 0, flag: 0 };
  for (const e of entries) if (e.report) counts[verdict(e.report)]++;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
        <span className="rounded-sm bg-accent-turquoise/10 py-1 text-accent-turquoise">{counts.pass} pass</span>
        <span className="rounded-sm bg-accent-gold/10 py-1 text-accent-gold">{counts.review} review</span>
        <span className="rounded-sm bg-accent-rose/10 py-1 text-accent-rose">{counts.flag} flag</span>
      </div>
      {entries.map((entry, i) => (
        <JevAgentTile entry={entry} key={`${entry.agent}-${i}`} />
      ))}
      <p className="text-[11px] leading-4 text-muted-foreground">
        Agents reason, Jev evaluates (observe-only). Figures are checked against each agent&apos;s own tool output;
        scope and policies are Jev probabilities.
      </p>
    </div>
  );
}

type Verdict = "pass" | "review" | "flag";

// flag: a check crossed its threshold; review: a policy sits within 0.2 of it
// or a scope is unclear; pass: neither.
function verdict(report: VerifyReport): Verdict {
  if (!report.pass && (report.numbers.misses.length > 0 || report.policy.length > 0 || report.scope.some((s) => s.flag === "differs"))) {
    return "flag";
  }
  const near = POLICY_CHECKS.some((c) => report.policyMax[c] >= POLICY_THRESHOLDS[c] - 0.2);
  return near || report.scope.some((s) => s.flag === "unclear") ? "review" : "pass";
}

const VERDICT_STYLE: Record<Verdict, string> = {
  pass: "bg-accent-turquoise/10 text-accent-turquoise",
  review: "bg-accent-gold/10 text-accent-gold",
  flag: "bg-accent-rose/10 text-accent-rose",
};

function JevAgentTile({ entry }: { readonly entry: Entry }) {
  const label = LABELS[entry.agent] ?? entry.agent;
  if (entry.status !== "done" || !entry.report) {
    return (
      <div className="metric-tile">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{label}</p>
          <span className="font-mono text-[11px] text-muted-foreground">
            {entry.status === "error" ? "evaluation failed" : "Jev evaluating…"}
          </span>
        </div>
      </div>
    );
  }
  const report = entry.report;
  const v = verdict(report);
  const backed = report.numbers.checkedCount - report.numbers.misses.length;

  return (
    <div className="metric-tile">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[11px] uppercase", VERDICT_STYLE[v])}>{v}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-mono text-2xl font-semibold">
          {backed}/{report.numbers.checkedCount}
        </span>
        <span className="text-xs text-muted-foreground">figures backed by tools</span>
      </div>
      {report.jev ? (
        <div className="mt-3 grid gap-1.5">
          {POLICY_CHECKS.map((check) => {
            const p = report.policyMax[check];
            const over = p >= POLICY_THRESHOLDS[check];
            return (
              <div className="grid grid-cols-[1fr_72px_34px] items-center gap-2 text-[11px]" key={check}>
                <span className="truncate text-muted-foreground">{CHECK_LABELS[check]}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", over ? "bg-accent-rose" : "bg-accent-turquoise")}
                    style={{ width: `${Math.round(p * 100)}%` }}
                  />
                </span>
                <span className="text-right font-mono">{p.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Figures only: TYPESAFE_API_KEY not set.</p>
      )}
      {report.numbers.misses.length + report.numbers.unknownIds.length + report.scope.filter((s) => s.flag).length > 0 ? (
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
          {report.scope
            .filter((s) => s.flag)
            .map((s, i) => (
              <li className="text-accent-gold" key={`s${i}`}>
                Scope {s.flag}: <span className="font-mono">{s.figure}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
