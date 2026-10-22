"use client";

import { useMemo, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, Handle, Position, getSmoothStepPath, useStore, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { GaugeIcon, MegaphoneIcon, PlaneIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { IconTile } from "@/components/reui/icon-tile";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AttributionModel, getRaskDrivers } from "@/agent/lib/cdp/attribution";
import { cn } from "cn";
import { channelLabel } from "./attribution-charts";
import { MODELS } from "./attribution-view";
import { FlowCanvas } from "./flow-canvas";

// After ReUI flow-4 (Growth Impact Map): metric cards in a left-to-right map
// with a pill on each link. The demo data, inspector editing, relink and the
// "correlation" wording are gone. Edge pills are attributed shares of the window
// RASK, not correlations; levers are shown as drivers with no pill.

export type RaskDrivers = ReturnType<typeof getRaskDrivers>;

type Kind = "north_star" | "lever" | "campaign";
type DriverNodeData = {
  kind: Kind;
  title: string;
  subtitle: string;
  value: string;
  note: string;
  facts: readonly { readonly label: string; readonly value: string }[];
};
type DriverNode = Node<DriverNodeData, "driver">;
type ShareEdge = Edge<{ caption?: string }, "share">;

const rask = (value: number) => `${value.toFixed(4)} MXN`;

const KIND_ICON = { north_star: PlaneIcon, lever: GaugeIcon, campaign: MegaphoneIcon } as const;
const KIND_LABEL = { north_star: "North star", lever: "Lever", campaign: "Campaign" } as const;

function DriverCard({ data, selected }: NodeProps<DriverNode>) {
  const Icon = KIND_ICON[data.kind];
  const star = data.kind === "north_star";
  return (
    <div className="relative">
      <Frame
        className={cn(
          "w-64 bg-muted [--frame-panel-header-px-adjust:--spacing(-1)] [--frame-panel-header-py-adjust:--spacing(-0.5)] [--frame-panel-px-adjust:--spacing(-1)] [--frame-panel-py-adjust:--spacing(-1.5)]",
          selected && "ring-[3px] ring-primary/25 dark:ring-primary/40",
        )}
        data-selected={selected || undefined}
        dense
        spacing="default"
      >
        <FrameHeader className="flex-row items-center gap-2.5">
          <IconTile size="sm" variant="outline">
            {star ? <TrendingUpIcon /> : <Icon />}
          </IconTile>
          <div className="flex min-w-0 flex-col">
            <FrameTitle className="truncate leading-4">{data.title}</FrameTitle>
            <FrameDescription className="truncate text-xs leading-4">{data.subtitle}</FrameDescription>
          </div>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-1">
          <span className={cn("truncate font-semibold tabular-nums", star ? "text-base" : "text-sm")}>{data.value}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">{data.note}</span>
        </FramePanel>
      </Frame>
      {data.kind === "north_star" ? <Handle id="in" isConnectable={false} position={Position.Left} type="target" /> : <Handle id="out" isConnectable={false} position={Position.Right} type="source" />}
    </div>
  );
}

// Same 1px smooth-step wire as the block's impact edge; the pill carries the
// attributed share, or nothing for a lever.
function ShareEdgeView({ data, id, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY }: EdgeProps<ShareEdge>) {
  const zoom = useStore((state) => state.transform[2]);
  const [path, labelX, labelY] = getSmoothStepPath({ borderRadius: 12, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ strokeWidth: 1 / zoom }} />
      {data?.caption ? (
        <EdgeLabelRenderer>
          <div className="absolute" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
            <Badge className="bg-card tabular-nums dark:bg-card" variant="outline">
              {data.caption}
            </Badge>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const nodeTypes = { driver: DriverCard };
const edgeTypes = { share: ShareEdgeView };
const ROW = 110;

function buildGraph(drivers: RaskDrivers) {
  const sources: DriverNode[] = [
    ...drivers.levers.map(
      (lever): DriverNode => ({
        id: lever.id,
        type: "driver",
        position: { x: 0, y: 0 },
        data: { kind: "lever", title: lever.label, subtitle: KIND_LABEL.lever, value: `${lever.value} ${lever.unit}`, note: "Network driver of RASK", facts: [{ label: lever.label, value: `${lever.value} ${lever.unit}` }] },
      }),
    ),
    ...drivers.campaigns.map(
      (campaign): DriverNode => ({
        id: campaign.id,
        type: "driver",
        position: { x: 0, y: 0 },
        data: {
          kind: "campaign",
          title: campaign.name,
          subtitle: `${KIND_LABEL.campaign} · ${channelLabel(campaign.channel)}`,
          value: rask(campaign.raskMxn),
          note: `${campaign.revenuePerPesoCost.toFixed(1)}x revenue per peso of cost`,
          facts: [
            { label: "Channel", value: channelLabel(campaign.channel) },
            { label: "Attributed RASK", value: rask(campaign.raskMxn) },
            { label: "Share of window RASK", value: `${campaign.shareOfWindowRaskPct.toFixed(1)}%` },
            { label: "Revenue per peso of cost", value: `${campaign.revenuePerPesoCost.toFixed(1)}x` },
          ],
        },
      }),
    ),
  ].map((node, index) => ({ ...node, position: { x: 0, y: index * ROW } }));

  const star: DriverNode = {
    id: "rask",
    type: "driver",
    position: { x: 460, y: ((sources.length - 1) * ROW) / 2 },
    data: {
      kind: "north_star",
      title: "RASK",
      subtitle: "Network revenue per available seat-km",
      value: rask(drivers.northStar.raskMxn),
      note: `Window ${rask(drivers.northStar.windowRaskMxn)} · ASK fixed: ${drivers.fixedAsk.askMillions} M km`,
      facts: [
        { label: "Network RASK", value: rask(drivers.northStar.raskMxn) },
        { label: "Window RASK", value: rask(drivers.northStar.windowRaskMxn) },
        { label: "ASK (fixed)", value: `${drivers.fixedAsk.askMillions} M km` },
        ...drivers.channels.map((channel) => ({ label: channelLabel(channel.channel), value: `${rask(channel.raskMxn)} · ${channel.revenueSharePct.toFixed(1)}% of revenue` })),
      ],
    },
  };

  const edges: ShareEdge[] = [
    ...drivers.levers.map((lever): ShareEdge => ({ id: `${lever.id}-rask`, source: lever.id, target: "rask", type: "share", data: {} })),
    ...drivers.campaigns.map((campaign): ShareEdge => ({ id: `${campaign.id}-rask`, source: campaign.id, target: "rask", type: "share", data: { caption: `attributed share ${campaign.shareOfWindowRaskPct.toFixed(1)}%` } })),
  ];
  return { nodes: [...sources, star], edges };
}

export function RaskDriversView({ drivers }: { readonly drivers: Readonly<Record<AttributionModel, RaskDrivers>> }) {
  const [model, setModel] = useState<AttributionModel>("position_based");
  const [selectedId, setSelectedId] = useState<string>("rask");
  const graph = useMemo(() => buildGraph(drivers[model]), [drivers, model]);
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[graph.nodes.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <Frame className="min-h-0 flex-1" dense>
        <FrameHeader className="min-w-0 flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>RASK drivers</FrameTitle>
            <FrameDescription>Levers and campaigns feeding network RASK. Pills are attributed shares of the window RASK, not correlations.</FrameDescription>
          </div>
          <ToggleGroup
            aria-label="Attribution model"
            multiple={false}
            onValueChange={(value: string[]) => value[0] && setModel(value[0] as AttributionModel)}
            size="sm"
            spacing={0}
            value={[model]}
            variant="outline"
          >
            {MODELS.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </FrameHeader>
        <FramePanel className="flex min-h-0 flex-1 flex-col p-0">
          <FlowCanvas
            edges={graph.edges}
            edgeTypes={edgeTypes}
            nodes={graph.nodes.map((node) => ({ ...node, selected: node.id === selected.id }))}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
          />
        </FramePanel>
        <FrameFooter className="flex-row flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{selected.data.title}</span>
          {selected.data.facts.map((fact) => (
            <span key={fact.label}>
              {fact.label}: {fact.value}
            </span>
          ))}
        </FrameFooter>
      </Frame>
    </div>
  );
}
