"use client";

import { useMemo } from "react";
import { Handle, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import {
  ActivityIcon,
  AwardIcon,
  BotIcon,
  CheckIcon,
  ClockIcon,
  DatabaseIcon,
  FileCheck2Icon,
  MinusIcon,
  PauseCircleIcon,
  ShieldCheckIcon,
  TagIcon,
  TrendingUpIcon,
  UsersIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/reui/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";
import { FlowCanvas } from "./flow-canvas";
import type { StreamEvent } from "./run-timeline";

// After ReUI flow-3 (Pipeline Run Monitor): the task marks, the status ring and
// badge, and the animated wires. The demo pipeline, run controls, inspector and
// editing actions are gone; the graph is the fixed eve team and every state is
// derived from the live stream.

// The block's six run states, mapped to the team's:
//   queued -> idle              running -> working
//   succeeded -> done           failed -> failed / denied
//   waiting -> awaiting approval   skipped -> not called this turn
type RunStatus = "succeeded" | "running" | "failed" | "queued" | "waiting" | "skipped";

const STATUS_LABEL: Record<RunStatus, string> = {
  succeeded: "Done",
  running: "Working",
  failed: "Failed",
  queued: "Idle",
  waiting: "Awaiting approval",
  skipped: "Not called",
};
const STATUS_RING: Record<RunStatus, string> = {
  succeeded: "border-success",
  running: "border-info",
  failed: "border-destructive",
  queued: "border-border",
  waiting: "border-warning",
  skipped: "border-border",
};
const STATUS_BADGE: Record<RunStatus, BadgeProps["variant"]> = {
  succeeded: "success-light",
  running: "info-light",
  failed: "destructive-light",
  queued: "outline",
  waiting: "warning-light",
  skipped: "outline",
};
const STATUS_TONE: Record<RunStatus, string> = {
  succeeded: "text-success",
  running: "text-info",
  failed: "text-destructive",
  queued: "text-muted-foreground",
  waiting: "text-warning",
  skipped: "text-muted-foreground",
};
const STATUS_ICON: Record<RunStatus, React.ReactNode> = {
  succeeded: <CheckIcon aria-hidden="true" />,
  running: <ActivityIcon aria-hidden="true" />,
  failed: <XIcon aria-hidden="true" />,
  queued: <ClockIcon aria-hidden="true" />,
  waiting: <PauseCircleIcon aria-hidden="true" />,
  skipped: <MinusIcon aria-hidden="true" />,
};

const ICON = {
  lead: BotIcon,
  cdp: DatabaseIcon,
  revenue: TrendingUpIcon,
  offer: TagIcon,
  crm: UsersIcon,
  rewards: AwardIcon,
  gate: ShieldCheckIcon,
  spec: FileCheck2Icon,
} as const;

const SPECIALISTS = [
  { id: "cdp-analyst", title: "cdp-analyst", icon: "cdp" },
  { id: "revenue-analyst", title: "revenue-analyst", icon: "revenue" },
  { id: "offer-strategist", title: "offer-strategist", icon: "offer" },
  { id: "crm-analyst", title: "crm-analyst", icon: "crm" },
  { id: "rewards-analyst", title: "rewards-analyst", icon: "rewards" },
] as const;

type Rec = Record<string, unknown>;
type TeamNodeData = {
  title: string;
  detail: string;
  status: RunStatus;
  icon: keyof typeof ICON;
  tools: string[];
};
type TeamNode = Node<TeamNodeData, "team">;

const asRec = (value: unknown): Rec => (value && typeof value === "object" ? (value as Rec) : {});

// One turn of the stream (from its last turn.started) as node states.
export function deriveTeamRun(events: readonly StreamEvent[], status: string) {
  const start = events.findLastIndex((event) => event.type === "turn.started");
  if (start < 0) return null;
  const turn = events.slice(start);
  const busy = status === "submitted" || status === "streaming";
  const failedTurn = status === "error" || turn.some((event) => event.type === "turn.failed" || event.type === "session.failed");

  const calls = new Map<string, string>();
  const completed = new Set<string>();
  const tools: string[] = [];
  let inputRequested = false;
  let result: Rec | null = null;
  for (const event of turn) {
    const data = asRec(event.data);
    if (event.type === "subagent.called") calls.set(String(data.callId), String(data.name ?? data.subagentName ?? ""));
    if (event.type === "subagent.completed") completed.add(String(data.callId));
    if (event.type === "input.requested") inputRequested = true;
    if (event.type === "actions.requested") {
      for (const action of (Array.isArray(data.actions) ? data.actions : []) as Rec[]) {
        const name = String(action.toolName ?? action.name ?? "");
        if (name && name !== "agent" && !tools.includes(name)) tools.push(name);
      }
    }
    if (event.type === "action.result") {
      const r = asRec(data.result);
      if (r.toolName === "record_activation_spec") result = r;
    }
  }

  const lead: TeamNodeData = {
    title: "Loyalty Analyst",
    detail: failedTurn ? "Turn failed" : busy ? "Orchestrating" : "Turn complete",
    status: failedTurn ? "failed" : busy ? "running" : "succeeded",
    icon: "lead",
    tools: tools.filter((name) => name !== "record_activation_spec"),
  };

  const specialists = SPECIALISTS.map((specialist): TeamNodeData => {
    const mine = [...calls].filter(([, name]) => name === specialist.id || name.includes(specialist.id));
    const pending = mine.filter(([callId]) => !completed.has(callId)).length;
    const count = mine.length > 1 ? ` · ${mine.length} calls` : "";
    if (mine.length === 0) {
      return { title: specialist.title, detail: busy ? "Idle" : "Not called", status: busy ? "queued" : "skipped", icon: specialist.icon, tools: [] };
    }
    return pending > 0
      ? { title: specialist.title, detail: `Working${count}`, status: "running", icon: specialist.icon, tools: [] }
      : { title: specialist.title, detail: `Done${count}`, status: "succeeded", icon: specialist.icon, tools: [] };
  });

  const output = asRec(result?.output);
  const rows = Array.isArray(output.rows) ? output.rows.length : null;
  const denied = result !== null && result.isError === true;
  const approval: TeamNodeData = {
    title: "Human approval",
    icon: "gate",
    tools: inputRequested || result ? ["record_activation_spec"] : [],
    ...(result
      ? denied
        ? { status: "failed" as const, detail: "Denied or rejected" }
        : { status: "succeeded" as const, detail: "Approved" }
      : inputRequested
        ? { status: "waiting" as const, detail: "Awaiting approval" }
        : { status: busy ? ("queued" as const) : ("skipped" as const), detail: busy ? "Idle" : "Not requested" }),
  };
  const spec: TeamNodeData = {
    title: "Activation spec",
    icon: "spec",
    tools: [],
    ...(result && !denied
      ? { status: "succeeded" as const, detail: [output.specId ? String(output.specId) : "Recorded", rows !== null ? `${rows} rows` : ""].filter(Boolean).join(" · ") }
      : { status: busy ? ("queued" as const) : ("skipped" as const), detail: result ? "Not recorded" : busy ? "Idle" : "Not recorded" }),
  };

  return { lead, specialists, approval, spec };
}

function TeamMark({ data }: NodeProps<TeamNode>) {
  const Glyph = ICON[data.icon];
  const running = data.status === "running";
  const shown = data.tools.slice(0, 3);
  return (
    <div className="flex w-40 flex-col items-center gap-2">
      <div className="relative">
        <Handle className="-left-1!" id="in" isConnectable={false} position={Position.Left} type="target" />
        <IconTile
          className={cn("bg-card dark:bg-card [--icon-tile-icon-size:--spacing(6)]", STATUS_RING[data.status], running && "ring-[5px] ring-info/25")}
          size="xl"
          variant="outline"
        >
          <Glyph />
        </IconTile>
        <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-1/2 rounded-full bg-card">
          <Badge className="border-2 border-card px-0" radius="full" variant={STATUS_BADGE[data.status]}>
            {running ? <Spinner aria-hidden="true" aria-label={undefined} className="size-3" role="presentation" /> : STATUS_ICON[data.status]}
            <span className="sr-only">{STATUS_LABEL[data.status]}</span>
          </Badge>
        </span>
        <Handle className="-right-1!" id="out" isConnectable={false} position={Position.Right} type="source" />
      </div>
      <div className="flex w-full min-w-0 flex-col items-center text-center">
        <span className="w-full truncate text-sm font-medium">{data.title}</span>
        <span className={cn("w-full truncate text-xs tabular-nums", STATUS_TONE[data.status])}>{data.detail}</span>
      </div>
      {shown.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1">
          {shown.map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
          {data.tools.length > shown.length ? <Badge variant="outline">+{data.tools.length - shown.length}</Badge> : null}
        </div>
      ) : null}
    </div>
  );
}

const nodeTypes = { team: TeamMark };
const ROW = 130;

function buildGraph(run: NonNullable<ReturnType<typeof deriveTeamRun>>) {
  const middle = ((SPECIALISTS.length - 1) * ROW) / 2;
  const node = (id: string, x: number, y: number, data: TeamNodeData): TeamNode => ({ id, type: "team", position: { x, y }, data });
  const nodes: TeamNode[] = [
    node("lead", 0, middle, run.lead),
    ...SPECIALISTS.map((specialist, index) => node(specialist.id, 280, index * ROW, run.specialists[index])),
    node("approval", 560, middle, run.approval),
    node("spec", 840, middle, run.spec),
  ];
  const statusOf = (id: string) => nodes.find((item) => item.id === id)!.data.status;
  const edge = (source: string, target: string): Edge => {
    const running = statusOf(target) === "running";
    return { id: `${source}-${target}`, source, target, type: "smoothstep", animated: running, style: running ? { stroke: "var(--info)" } : undefined };
  };
  const edges: Edge[] = [
    ...SPECIALISTS.map((specialist) => edge("lead", specialist.id)),
    ...SPECIALISTS.map((specialist) => edge(specialist.id, "approval")),
    edge("approval", "spec"),
  ];
  return { nodes, edges };
}

export function TeamRunView({ events, status }: { readonly events: readonly StreamEvent[]; readonly status: string }) {
  const run = useMemo(() => deriveTeamRun(events, status), [events, status]);
  const graph = useMemo(() => (run ? buildGraph(run) : null), [run]);
  const counts = graph
    ? (Object.keys(STATUS_LABEL) as RunStatus[])
        .map((key) => ({ key, count: graph.nodes.filter((node) => node.data.status === key).length }))
        .filter((item) => item.count > 0)
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <Frame className="min-h-0 flex-1" dense>
        <FrameHeader className="min-w-0 flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Team run</FrameTitle>
            <FrameDescription>The Lead, its five specialists and the approval gate, live from the current turn.</FrameDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {counts.map((item) => (
              <Badge className="tabular-nums" key={item.key} variant={STATUS_BADGE[item.key]}>
                {item.count} {STATUS_LABEL[item.key].toLowerCase()}
              </Badge>
            ))}
          </div>
        </FrameHeader>
        <FramePanel className="flex min-h-0 flex-1 flex-col p-0">
          {graph ? (
            <FlowCanvas edges={graph.edges} elementsSelectable={false} nodes={graph.nodes} nodeTypes={nodeTypes} />
          ) : (
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WorkflowIcon />
                </EmptyMedia>
                <EmptyTitle>No run yet</EmptyTitle>
                <EmptyDescription>
                  Ask in the chat to start one, for example: Personalize a retention activation for Retencion Prioritaria members: offer, channel and day, ready for my approval.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
