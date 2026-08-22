"use client";

import { useEveAgent } from "eve/react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BotIcon,
  BriefcaseBusinessIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  DatabaseIcon,
  GaugeIcon,
  MessageSquareIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TerminalSquareIcon,
  WorkflowIcon,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { getDashboardSnapshot } from "@/agent/lib/fracttal-success-data";
import { AgentMessage } from "./agent-message";

const snapshot = getDashboardSnapshot();

const suggestions = [
  "Which accounts represent the largest ARR-at-risk in the next 90 days, why, and what should we do first?",
  "Separate the portfolio into Protect Now, Accelerate Value, Expand, and Scale. Quantify the ARR in each motion.",
  "Where do we have proven maintenance value and enough whitespace to build a responsible expansion motion?",
];

const metricLabels: Record<string, string> = {
  avgHealthScore: "Portfolio health",
  arrAtRiskUsd: "ARR at risk",
  valueProofPct: "Accounts with value proof",
  expansionPotentialUsd: "Expansion potential",
};

function formatMetric(metric: string, value: number) {
  if (metric === "arrAtRiskUsd" || metric === "expansionPotentialUsd") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (metric === "valueProofPct") return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}

export function SuccessCommandCenter() {
  const agent = useEveAgent();
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const empty = agent.data.messages.length === 0;

  async function send(text: string) {
    if (!text.trim() || busy) return;
    await agent.send({
      message: text.trim(),
      clientContext: {
        demo: "Global Customer Success Command Center",
        asOfDate: snapshot.current.asOfDate,
        dataPolicy: "synthetic interview portfolio",
      },
    });
  }

  async function onSubmit(message: PromptInputMessage) {
    await send(message.text);
  }

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid h-full w-full max-w-[1600px] gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[370px_minmax(0,1fr)_340px]">
        <aside className="app-scroll flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <section className="dashboard-panel p-5">
            <p className="eyebrow">Global Customer Success · Interview MVP</p>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold leading-tight">Customer Success<br />Command Center</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Prioritize customer value, renewal protection and responsible expansion from one AI operating layer.
                </p>
              </div>
              <span className="rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                synthetic
              </span>
            </div>
          </section>

          <section className="dashboard-panel p-4">
            <div className="mb-4 flex items-center gap-2">
              <GaugeIcon className="size-4 text-accent-blue" />
              <h2 className="section-title">Portfolio pulse</h2>
            </div>
            <div className="grid gap-3">
              {snapshot.comparisons.map((item) => {
                const delta = item.current - item.previous;
                const favorable = item.metric === "arrAtRiskUsd" ? delta <= 0 : delta >= 0;
                return (
                  <div className="metric-tile" key={item.metric}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{metricLabels[item.metric]}</p>
                      <span className={favorable ? "font-mono text-xs text-accent-turquoise" : "font-mono text-xs text-accent-rose"}>
                        {delta >= 0 ? "+" : ""}{formatMetric(item.metric, delta)}
                      </span>
                    </div>
                    <p className="mt-3 font-mono text-2xl font-semibold">{formatMetric(item.metric, item.current)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              {snapshot.current.accounts} synthetic accounts · {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" }).format(snapshot.current.totalArrUsd)} ARR · as of {snapshot.current.asOfDate}
            </div>
          </section>
        </aside>

        <section className="dashboard-panel flex min-h-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Live Eve decision session</p>
                <h2 className="mt-1 text-xl font-semibold">Ask the portfolio, not another dashboard</h2>
              </div>
              <Button disabled={busy} onClick={() => send("Give me the Monday executive portfolio review: risk, renewals, value proof, expansion readiness, and the five actions requiring leadership attention.")} type="button">
                <BriefcaseBusinessIcon className="size-4" /> Executive review
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button className="suggestion-chip" disabled={busy} key={suggestion} onClick={() => send(suggestion)} type="button">
                  <PlayIcon className="size-3.5" />{suggestion}
                </button>
              ))}
            </div>
          </header>

          {agent.error ? (
            <div className="mx-5 mt-4 flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangleIcon className="mt-0.5 size-4 text-destructive" />
              <span>{agent.error.message}</span>
            </div>
          ) : null}

          {empty ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-8 text-center">
              <div className="max-w-2xl">
                <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-accent-blue/35 bg-accent-blue/10 text-accent-blue">
                  <TargetIcon className="size-7" />
                </div>
                <h3 className="mt-6 text-3xl font-semibold">Protect ARR by proving customer value.</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  The agent grounds every decision in deterministic account data, distinguishes rescue from value acceleration and expansion, and exposes the operating logic behind the recommendation.
                </p>
              </div>
            </div>
          ) : (
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="mx-auto w-full max-w-4xl gap-6 px-5 py-6">
                {agent.data.messages.map((message, index) => (
                  <AgentMessage
                    canRespond={!busy}
                    isStreaming={agent.status === "streaming" && index === agent.data.messages.length - 1}
                    key={message.id}
                    message={message}
                    onInputResponses={(inputResponses) => agent.send({ inputResponses })}
                  />
                ))}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          )}

          <div className="shrink-0 border-t border-border bg-card/70 px-5 py-4">
            <PromptInput onSubmit={onSubmit}>
              <PromptInputTextarea placeholder="Ask about ARR risk, adoption, maintenance value, renewals or expansion readiness..." />
              <PromptInputSubmit onStop={agent.stop} status={agent.status} />
            </PromptInput>
          </div>
        </section>

        <aside className="app-scroll flex min-h-0 flex-col gap-4 overflow-y-auto">
          <section className="dashboard-panel p-4">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-accent-blue" />
              <h2 className="section-title">CS decision architecture</h2>
            </div>
            <div className="grid gap-2 text-sm">
              <ArchitectureRow icon={DatabaseIcon} title="Customer 360" detail="product + support + commercial" />
              <ArchitectureRow icon={TargetIcon} title="Value realization" detail="maintenance outcomes" />
              <ArchitectureRow icon={CircleDollarSignIcon} title="Revenue protection" detail="ARR risk + renewals" />
              <ArchitectureRow icon={SparklesIcon} title="Expansion readiness" detail="value proof before whitespace" />
              <ArchitectureRow icon={TerminalSquareIcon} title="Eve tools / sandbox" detail="grounded analysis" />
              <ArchitectureRow icon={WorkflowIcon} title="Durable workflow" detail="repeatable CS cadence" />
            </div>
          </section>

          <section className="dashboard-panel p-4">
            <div className="mb-4 flex items-center gap-2">
              <BotIcon className="size-4 text-accent-turquoise" />
              <h2 className="section-title">Operating doctrine</h2>
            </div>
            <ol className="space-y-3 text-sm">
              <Doctrine n="01" text="Accelerate adoption and time-to-value." />
              <Doctrine n="02" text="Prove measurable maintenance outcomes." />
              <Doctrine n="03" text="Remove support and executive friction." />
              <Doctrine n="04" text="Protect renewal and GRR." />
              <Doctrine n="05" text="Expand only after value proof." />
            </ol>
          </section>

          <section className="dashboard-panel p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-accent-turquoise" />
              <p className="text-xs leading-5 text-muted-foreground">
                Interview prototype. All portfolio data is synthetic; production would connect governed Fracttal telemetry, CRM, support and billing sources with explicit authorization for actions.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ArchitectureRow({ icon: Icon, title, detail }: { readonly icon: typeof ActivityIcon; readonly title: string; readonly detail: string }) {
  return (
    <div className="stack-row">
      <span className="flex size-8 items-center justify-center rounded-md bg-muted"><Icon className="size-4" /></span>
      <span><span className="block font-medium">{title}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
    </div>
  );
}

function Doctrine({ n, text }: { readonly n: string; readonly text: string }) {
  return <li className="flex gap-3"><span className="font-mono text-xs text-muted-foreground">{n}</span><span>{text}</span></li>;
}
