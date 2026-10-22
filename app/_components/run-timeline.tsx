"use client";

import {
  ActivityIcon,
  AlertCircleIcon,
  AwardIcon,
  BotIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  MessageSquareIcon,
  NetworkIcon,
  PlaneIcon,
  SparklesIcon,
  TagIcon,
  TerminalSquareIcon,
  UsersIcon,
  WorkflowIcon,
  WrenchIcon,
} from "lucide-react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export type StreamEvent = {
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

// The run as a trace, oldest first, so it reads in the order Eve ran it. The
// newest row shows as running while the turn is still in flight.
export function RunTimeline({
  events,
  isBusy,
}: {
  readonly events: readonly StreamEvent[];
  readonly isBusy: boolean;
}) {
  const visible = events
    .map((event, index) => toTimelineItem(event, index))
    .filter((event): event is TimelineItem => event !== null)
    .slice(-60);

  if (visible.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Session events will appear here while the Loyalty Analyst works.
      </p>
    );
  }

  return (
    <Trace className="text-sm">
      {visible.map((event, index) => (
        <TraceCollapsible key={event.key}>
          <TraceCollapsibleTrigger>
            <TraceLine
              status={
                event.tone === "red"
                  ? "error"
                  : isBusy && index === visible.length - 1
                    ? "running"
                    : undefined
              }
            >
              <TraceIcon>
                <event.icon />
              </TraceIcon>
              <TraceTitle>{event.title}</TraceTitle>
              {event.meta ? <TraceDescription className="max-w-28 truncate">{event.meta}</TraceDescription> : null}
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <span className="font-mono text-[11px] uppercase tracking-wider">{event.eyebrow}</span>
            <p className="mt-1">{event.detail}</p>
          </TraceCollapsibleContent>
        </TraceCollapsible>
      ))}
    </Trace>
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
