"use client";

import { useEveAgent } from "eve/react";
import {
  ActivityIcon,
  AlertCircleIcon,
  AwardIcon,
  BotIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  Layers3Icon,
  MessageSquareIcon,
  NetworkIcon,
  PlaneIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TagIcon,
  TerminalSquareIcon,
  UsersIcon,
  WrenchIcon,
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
import { cn } from "@/lib/utils";
import { getDashboardSnapshot } from "@/agent/lib/aeromexico-data";
import { AgentMessage } from "./agent-message";

const AGENT_NAME = "Loyalty Analyst";
const snapshot = getDashboardSnapshot();

const suggestions = [
  "Which Oro & Platino members on MEX–JFK are at churn risk, and which offer recovers the most RASK per peso?",
  "How much RASK is at risk from high-value members who haven't flown in 90+ days — and the reactivation plan?",
  "Weekly loyalty report: RASK-at-risk, load-factor by hub, and the 3 highest-ROI retention offers.",
];

const stackMoments = [
  { label: "Eve", value: "filesystem agent", icon: Layers3Icon },
  { label: "AI Gateway", value: "model routing", icon: SparklesIcon },
  { label: "Sandbox", value: "isolated Python", icon: TerminalSquareIcon },
  { label: "Subagents", value: "5 specialist analysts", icon: BotIcon },
  { label: "Workflow", value: "durable sessions", icon: WorkflowIcon },
  { label: "Vercel Connect", value: "Slack bot auth", icon: MessageSquareIcon },
];

type AgentStatus = ReturnType<typeof useEveAgent>["status"];
type StreamEvent = {
  readonly type: string;
  readonly data?: unknown;
};
type TimelineTone = "teal" | "gold" | "cyan" | "purple" | "red" | "muted";
type TimelineItem = {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  readonly eyebrow: string;
  readonly meta?: string;
  readonly tone: TimelineTone;
  readonly icon: typeof ActivityIcon;
};

export function AgentChat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || isBusy) return;

    await agent.send({ message: text });
  };

  const sendSuggestion = async (text: string) => {
    if (isBusy) return;
    await agent.send({
      message: text,
      clientContext: {
        demo: "Loyalty Analyst Eve Agent Stack walkthrough",
        currentWeek: snapshot.currentWeek,
        previousWeek: snapshot.previousWeek,
      },
    });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Ask the Loyalty Analyst about RASK, load factor, churn risk, or offers..." />
      <PromptInputSubmit
        className="bg-accent-rose text-white hover:bg-accent-rose/90"
        onStop={agent.stop}
        status={agent.status}
      />
    </PromptInput>
  );

  return (
    <main className="h-dvh overflow-hidden bg-background text-foreground">
      <div className="mx-auto grid h-full w-full max-w-[1560px] gap-4 overflow-hidden px-4 py-4 lg:grid-cols-[360px_minmax(0,1fr)_360px]">
        <aside className="app-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <section className="dashboard-panel shrink-0 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Vercel Agent Stack demo</p>
                <h1 className="mt-3 text-4xl font-semibold leading-none tracking-normal">
                  {AGENT_NAME}
                </h1>
              </div>
              <StatusBadge status={agent.status} />
            </div>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              Explore customer behavior, loyalty segments and retention
              opportunities in a synthetic airline loyalty dataset — sandboxed
              analysis, specialist subagents, and durable runs on Vercel Eve.
            </p>
          </section>

          <section className="dashboard-panel shrink-0 p-4">
            <div className="mb-4 flex items-center gap-2">
              <DatabaseIcon className="size-4 text-accent-blue" />
              <h2 className="section-title">Metrics Snapshot</h2>
            </div>
            <div className="grid gap-3">
              {snapshot.comparisons.map((comparison) => (
                <MetricTile key={comparison.metric} comparison={comparison} />
              ))}
            </div>
          </section>
        </aside>

        <section className="dashboard-panel flex h-full min-h-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Live Eve session</p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal">
                  Ask the Loyalty Analyst anything about the two-week dataset
                </h2>
              </div>
              <Button
                className="rounded-md"
                disabled={isBusy}
                onClick={() => sendSuggestion(suggestions[2])}
                type="button"
              >
                <CalendarClockIcon className="size-4" />
                Weekly report
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  className="suggestion-chip"
                  disabled={isBusy}
                  key={suggestion}
                  onClick={() => sendSuggestion(suggestion)}
                  type="button"
                >
                  <PlayIcon className="size-3.5" />
                  {suggestion}
                </button>
              ))}
            </div>
          </header>

          {agent.error ? (
            <div className="mx-5 mt-4 flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Request failed</p>
                <p className="mt-0.5 text-muted-foreground">
                  {agent.error.message}
                </p>
              </div>
            </div>
          ) : null}

          {isEmpty ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="max-w-2xl">
                <div className="mx-auto flex size-14 items-center justify-center rounded-md border border-accent-blue/35 bg-accent-blue/10 text-accent-blue">
                  <ActivityIcon className="size-7" />
                </div>
                <h3 className="mt-6 text-3xl font-semibold tracking-normal">
                  Start with the hero prompt from the video.
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  The Loyalty Analyst will query deterministic loyalty
                  data, run a sandboxed analysis step, delegate to specialist
                  subagents when needed, and return a recording-ready summary
                  with concrete dates.
                </p>
              </div>
            </div>
          ) : (
            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="mx-auto w-full max-w-4xl gap-6 px-5 py-6">
                {agent.data.messages.map((message, index) => (
                  <AgentMessage
                    canRespond={!isBusy}
                    isStreaming={
                      agent.status === "streaming" &&
                      index === agent.data.messages.length - 1
                    }
                    key={message.id}
                    message={message}
                    onInputResponses={(inputResponses) =>
                      agent.send({ inputResponses })
                    }
                  />
                ))}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          )}

          <div className="shrink-0 border-t border-border bg-card/70 px-5 py-4">
            {composer}
          </div>
        </section>

        <aside className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
          <section className="dashboard-panel shrink-0 p-4">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-accent-blue" />
              <h2 className="section-title">Agent Stack</h2>
            </div>
            <div className="grid gap-2">
              {stackMoments.map((moment) => (
                <StackMoment key={moment.label} {...moment} />
              ))}
            </div>
          </section>

          <section className="dashboard-panel flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WorkflowIcon className="size-4 text-accent-turquoise" />
                <h2 className="section-title">Run Timeline</h2>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {agent.events.length} events
              </span>
            </div>
            <Timeline
              events={agent.events as readonly StreamEvent[]}
              isEmpty={isEmpty}
            />
          </section>
        </aside>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium uppercase tracking-[0.12em]">
      <span className="relative flex size-2">
        {isLive ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-turquoise opacity-75" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full transition-colors",
            status === "error"
              ? "bg-destructive"
              : isLive
                ? "bg-accent-turquoise"
                : "bg-muted-foreground",
          )}
        />
      </span>
      {status}
    </span>
  );
}

function MetricTile({
  comparison,
}: {
  readonly comparison: (typeof snapshot.comparisons)[number];
}) {
  const positive = comparison.absoluteChange >= 0;

  return (
    <div className="metric-tile">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {labelForMetric(comparison.metric)}
        </p>
        <span
          className={cn(
            "rounded-sm px-1.5 py-0.5 font-mono text-[11px]",
            positive
              ? "bg-accent-turquoise/10 text-accent-turquoise"
              : "bg-accent-rose/10 text-accent-rose",
          )}
        >
          {comparison.percentChange === null
            ? "n/a"
            : `${positive ? "+" : ""}${comparison.percentChange.toFixed(1)}%`}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-mono text-2xl font-semibold">
          {formatValue(comparison.metric, comparison.current.value)}
        </span>
        <span className="text-xs text-muted-foreground">
          was {formatValue(comparison.metric, comparison.previous.value)}
        </span>
      </div>
    </div>
  );
}

function StackMoment({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Layers3Icon;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="stack-row">
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {value}
        </span>
      </span>
    </div>
  );
}

function Timeline({
  events,
  isEmpty,
}: {
  readonly events: readonly StreamEvent[];
  readonly isEmpty: boolean;
}) {
  const visible = events
    .map((event, index) => toTimelineItem(event, index))
    .filter((event): event is TimelineItem => event !== null)
    .slice(-40)
    .reverse();

  if (isEmpty || visible.length === 0) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center rounded-md border border-dashed border-border text-center text-sm text-muted-foreground">
        Session events will appear here while the Loyalty Analyst works.
      </div>
    );
  }

  return (
    <div className="timeline-scroll">
      <ol className="space-y-3">
        {visible.map((event) => (
          <li className={cn("timeline-item", event.tone)} key={event.key}>
            <span className={cn("timeline-icon", event.tone)}>
              <event.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="timeline-eyebrow">{event.eyebrow}</p>
                  <p className="timeline-title">{event.title}</p>
                </div>
                {event.meta ? (
                  <span className="timeline-meta">{event.meta}</span>
                ) : null}
              </div>
              <p className="timeline-detail">{event.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function toTimelineItem(
  event: StreamEvent,
  index: number,
): TimelineItem | null {
  const key = `${index}-${event.type}`;

  switch (event.type) {
    case "session.started": {
      const runtime = asRecord(asRecord(event.data)?.runtime);
      const modelId = readString(runtime?.modelId);
      const gitSha = readString(asRecord(runtime?.build)?.gitSha);
      return {
        key,
        eyebrow: "session",
        title: "Agent runtime online",
        detail: modelId
          ? `Loyalty Analyst is running on ${modelId}.`
          : "Loyalty Analyst opened a durable Eve session.",
        meta: gitSha ? gitSha.slice(0, 7) : undefined,
        tone: "teal",
        icon: ActivityIcon,
      };
    }
    case "turn.started":
      return {
        key,
        eyebrow: "turn",
        title: "Turn started",
        detail: `Durable workflow turn ${readString(asRecord(event.data)?.turnId) ?? "started"}.`,
        meta: readSequenceMeta(asRecord(event.data)?.sequence),
        tone: "purple",
        icon: WorkflowIcon,
      };
    case "message.received":
      return {
        key,
        eyebrow: "input",
        title: "User prompt received",
        detail: truncate(
          readString(asRecord(event.data)?.message) ??
            "Eve accepted the user turn.",
          92,
        ),
        tone: "teal",
        icon: MessageSquareIcon,
      };
    case "actions.requested":
      return {
        key,
        eyebrow: "action",
        title: readActionTitle(event.data),
        detail: readActionDetail(event.data),
        meta: readActionCount(event.data),
        tone: "gold",
        icon: readActionIcon(event.data),
      };
    case "action.result":
      return {
        key,
        eyebrow: "result",
        title: readToolResultTitle(event.data),
        detail: readToolResultDetail(event.data),
        meta: readToolResultMeta(event.data),
        tone: "cyan",
        icon: CheckCircle2Icon,
      };
    case "subagent.called": {
      const label = subagentLabel(event.data);
      return {
        key,
        eyebrow: "subagent",
        title: `${label} delegated`,
        detail: `Loyalty Analyst handed the analysis to the ${label}.`,
        meta: readChildSession(event.data),
        tone: "gold",
        icon: BotIcon,
      };
    }
    case "subagent.completed": {
      const label = subagentLabel(event.data);
      return {
        key,
        eyebrow: "subagent",
        title: `${label} completed`,
        detail: truncate(
          readString(asRecord(event.data)?.output) ??
            "The child agent returned its specialist handoff.",
          110,
        ),
        meta: readString(asRecord(event.data)?.subagentName),
        tone: "teal",
        icon: BotIcon,
      };
    }
    case "step.started":
      return {
        key,
        eyebrow: "workflow",
        title: `Step ${readNumber(asRecord(event.data)?.stepIndex) ?? ""} started`,
        detail: "Eve checkpointed the run and advanced the durable turn.",
        tone: "purple",
        icon: WorkflowIcon,
      };
    case "step.completed":
      return {
        key,
        eyebrow: "workflow",
        title: `Step ${readNumber(asRecord(event.data)?.stepIndex) ?? ""} completed`,
        detail: readUsageDetail(event.data),
        meta: readCostMeta(event.data),
        tone: "purple",
        icon: WorkflowIcon,
      };
    case "message.completed":
      return {
        key,
        eyebrow: "answer",
        title: "Final response ready",
        detail: truncate(
          readString(asRecord(event.data)?.message) ??
            "Loyalty Analyst finished the answer.",
          110,
        ),
        tone: "teal",
        icon: SparklesIcon,
      };
    case "session.waiting":
      return {
        key,
        eyebrow: "ready",
        title: "Session parked",
        detail: "Loyalty Analyst is waiting durably for the next turn.",
        tone: "purple",
        icon: WorkflowIcon,
      };
    case "turn.completed":
      return {
        key,
        eyebrow: "turn",
        title: "Turn completed",
        detail: "The durable Eve turn finished successfully.",
        tone: "purple",
        icon: WorkflowIcon,
      };
    case "turn.failed":
    case "session.failed":
      return {
        key,
        eyebrow: "error",
        title: "Run failed",
        detail:
          readString(asRecord(event.data)?.errorText) ??
          "Inspect the chat error for details.",
        tone: "red",
        icon: AlertCircleIcon,
      };
    case "reasoning.appended":
    case "message.appended":
      return null;
    default:
      return {
        key,
        eyebrow: "event",
        title: humanizeEventType(event.type),
        detail: "Eve emitted a low-level stream event.",
        tone: "muted",
        icon: ActivityIcon,
      };
  }
}

const SUBAGENT_LABELS: Record<string, string> = {
  "crm-analyst": "CRM Analyst",
  "cdp-analyst": "CDP Analyst",
  "rewards-analyst": "Rewards Analyst",
  "revenue-analyst": "Revenue Analyst",
  "offer-strategist": "Offer Strategist",
};

const TOOL_META: Record<
  string,
  { readonly title: string; readonly icon: typeof ActivityIcon; readonly resultTitle: string }
> = {
  query_members: {
    title: "Query members",
    icon: UsersIcon,
    resultTitle: "Members returned",
  },
  segment_members: {
    title: "Segment members (sandbox)",
    icon: TerminalSquareIcon,
    resultTitle: "Segmentation completed",
  },
  query_crm: {
    title: "CRM analysis",
    icon: DatabaseIcon,
    resultTitle: "CRM data returned",
  },
  query_cdp: {
    title: "CDP engagement",
    icon: NetworkIcon,
    resultTitle: "CDP data returned",
  },
  query_loyalty: {
    title: "Rewards & CLV",
    icon: AwardIcon,
    resultTitle: "Rewards data returned",
  },
  query_network: {
    title: "Network RASK",
    icon: PlaneIcon,
    resultTitle: "Network data returned",
  },
  design_offers: {
    title: "Design offers",
    icon: TagIcon,
    resultTitle: "Offers designed",
  },
};

function subagentLabel(data: unknown) {
  const record = asRecord(data);
  const name =
    readString(record?.subagentName) ?? readString(record?.name);
  if (!name) return "Subagent";
  return SUBAGENT_LABELS[name] ?? name;
}

function readActionTitle(data: unknown) {
  const names = readToolNames(data);
  const subagentName = names.find((name) => name in SUBAGENT_LABELS);
  if (subagentName) return `${SUBAGENT_LABELS[subagentName]} requested`;
  const toolName = names.find((name) => name in TOOL_META);
  if (toolName) return `${TOOL_META[toolName].title} requested`;
  if (names.includes("load_skill")) return "Skill context requested";
  if (names.includes("bash")) return "Sandbox command requested";
  return names.length > 0 ? "Tool call requested" : "Action requested";
}

function readActionDetail(data: unknown) {
  const names = readToolNames(data);
  if (names.length === 0) return "The model selected an Eve action.";
  return `Calling ${formatList(names)}.`;
}

function readActionCount(data: unknown) {
  const count = readActions(data).length;
  return count > 1 ? `${count} calls` : undefined;
}

function readActionIcon(data: unknown) {
  const names = readToolNames(data);
  const subagentName = names.find((name) => name in SUBAGENT_LABELS);
  if (subagentName) return BotIcon;
  const toolName = names.find((name) => name in TOOL_META);
  if (toolName) return TOOL_META[toolName].icon;
  if (names.includes("bash")) return TerminalSquareIcon;
  if (names.includes("load_skill")) return SparklesIcon;
  return WrenchIcon;
}

function readToolNames(data: unknown) {
  return readActions(data)
    .map(
      (action) =>
        readString(asRecord(action)?.name) ??
        readString(asRecord(action)?.toolName),
    )
    .filter((name): name is string => typeof name === "string");
}

function readActions(data: unknown) {
  const record = asRecord(data);
  return Array.isArray(record?.actions) ? record.actions : [];
}

function readToolResultTitle(data: unknown) {
  const result = asRecord(asRecord(data)?.result);
  const name = readString(result?.toolName) ?? readString(result?.subagentName);
  if (name && name in SUBAGENT_LABELS) return `${SUBAGENT_LABELS[name]} result returned`;
  if (name && name in TOOL_META) return TOOL_META[name].resultTitle;
  if (name === "load_skill") return "Definitions loaded";
  if (name === "bash") return "Sandbox command completed";
  return name ? `${name} returned` : "Action result returned";
}

function readToolResultDetail(data: unknown) {
  const result = asRecord(asRecord(data)?.result);
  const name = readString(result?.toolName) ?? readString(result?.subagentName);
  const output = result?.output;

  if (name === "segment_members") {
    const outputRecord = asRecord(output);
    const sandbox = asRecord(outputRecord?.sandbox);
    const filesWritten = Array.isArray(sandbox?.filesWritten)
      ? sandbox.filesWritten.length
      : undefined;
    const artifactNote = filesWritten
      ? ` Wrote ${filesWritten} sandbox artifacts.`
      : "";
    return truncate(
      `${readString(outputRecord?.takeaway) ?? "Python segmentation ran inside the Eve sandbox."}${artifactNote}`,
      110,
    );
  }

  if (
    name === "query_members" ||
    name === "query_crm" ||
    name === "query_cdp" ||
    name === "query_loyalty" ||
    name === "query_network"
  ) {
    const outputRecord = asRecord(output);
    const rows = Array.isArray(outputRecord?.rows)
      ? outputRecord.rows.length
      : undefined;
    return `${TOOL_META[name].title} data returned${rows ? ` across ${rows} rows` : ""}.`;
  }

  if (name === "design_offers") {
    const outputRecord = asRecord(output);
    const offers = Array.isArray(outputRecord?.offers)
      ? outputRecord.offers.length
      : undefined;
    return `Designed${offers ? ` ${offers}` : ""} retention offer${offers === 1 ? "" : "s"}.`;
  }

  if (name === "load_skill") {
    return "Loyalty Analyst loaded metric definitions before answering.";
  }

  if (name === "bash") {
    const outputRecord = asRecord(output);
    return truncate(
      readString(outputRecord?.stdout) ||
        readString(outputRecord?.stderr) ||
        "Command completed.",
      110,
    );
  }

  return truncate(
    typeof output === "string"
      ? output
      : "A durable action returned data to the model.",
    110,
  );
}

function readToolResultMeta(data: unknown) {
  const result = asRecord(asRecord(data)?.result);
  const status = readString(asRecord(data)?.status);
  const name = readString(result?.toolName) ?? readString(result?.subagentName);
  if (name === "segment_members") {
    const sandbox = asRecord(asRecord(result?.output)?.sandbox);
    const filesWritten = Array.isArray(sandbox?.filesWritten)
      ? sandbox.filesWritten.length
      : undefined;
    if (sandbox?.used === true && filesWritten) return `${filesWritten} files`;
    return sandbox?.used === true ? "sandbox" : status;
  }
  return status;
}

function readChildSession(data: unknown) {
  const record = asRecord(data);
  const childSessionId =
    typeof record?.childSessionId === "string" ? record.childSessionId : null;
  return childSessionId
    ? childSessionId.replace(/^wrun_/, "child ")
    : undefined;
}

function readUsageDetail(data: unknown) {
  const usage = asRecord(asRecord(data)?.usage);
  const inputTokens = readNumber(usage?.inputTokens);
  const outputTokens = readNumber(usage?.outputTokens);
  if (inputTokens !== undefined || outputTokens !== undefined) {
    return `${formatInteger(inputTokens ?? 0)} input tokens, ${formatInteger(outputTokens ?? 0)} output tokens.`;
  }
  return "The workflow step finished and state was checkpointed.";
}

function readCostMeta(data: unknown) {
  const cost = asRecord(asRecord(data)?.usage)?.costUsd;
  return typeof cost === "number" ? `$${cost.toFixed(4)}` : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function readSequenceMeta(value: unknown) {
  const sequence = readNumber(value);
  return sequence === undefined ? undefined : `#${sequence}`;
}

function truncate(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength
    ? `${compact.slice(0, maxLength - 1)}...`
    : compact;
}

function formatList(items: readonly string[]) {
  if (items.length === 0) return "selected tools";
  if (items.length === 1) return `\`${items[0]}\``;
  return items.map((item) => `\`${item}\``).join(", ");
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function humanizeEventType(type: string) {
  return type
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function labelForMetric(metric: string) {
  const labels: Record<string, string> = {
    loadFactor: "Load Factor",
    raskMxn: "RASK",
    rpkMillions: "RPK filled",
    valueAtRiskMxn: "Value at risk",
  };
  return labels[metric] ?? metric;
}

function formatValue(metric: string, value: number) {
  if (metric === "loadFactor") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  }
  if (metric === "raskMxn") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (metric === "rpkMillions") {
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(value)} M`;
  }
  if (metric === "valueAtRiskMxn") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "MXN",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US").format(value);
}
