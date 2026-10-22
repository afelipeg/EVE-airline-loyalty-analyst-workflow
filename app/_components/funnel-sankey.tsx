"use client";

import { useState } from "react";
import { Sankey, type SankeyLinkProps, type SankeyNode, type SankeyNodeProps } from "recharts";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import type { getChannelFunnel } from "@/agent/lib/cdp/attribution";

// Adapted from ReUI block chart-49 (Recharts Sankey on a Frame). The demo's
// ranges, motion and faces are gone; nodes and links come from getChannelFunnel().
// Layout only: stage counts are the server's, the drop-off nodes are the
// difference between two consecutive stages.

type Funnel = ReturnType<typeof getChannelFunnel>;
type Tone = "flow" | "converted" | "dropped";
type FlowNode = { name: string; amount: number; tone: Tone; note: string };
type FlowLink = { source: number; target: number; value: number };
type Hover = { type: "node" | "link"; index: number } | null;
type LaidOutNode = SankeyNode & FlowNode;

const CHANNEL_LABEL: Record<string, string> = { email: "Email", push: "Push", in_app: "In-app" };

const CHART_CONFIG = {
  flow: { label: "Engaged", color: "var(--foreground)" },
  converted: { label: "Converted", color: "var(--success)" },
  dropped: { label: "Drop-off", color: "var(--destructive)" },
} satisfies ChartConfig;

const MARGIN = { top: 8, right: 150, bottom: 8, left: 100 };
const LINK_OPACITY = { on: 0.3, rest: 0.14, off: 0.05 };

const formatCount = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });
const formatRate = (part: number, whole: number) => (whole === 0 ? "0%" : `${((part / whole) * 100).toFixed(1)}%`);

function buildFlow(funnel: Funnel) {
  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const node = (item: FlowNode) => nodes.push(item) - 1;
  const link = (source: number, target: number, value: number) => {
    if (value > 0) links.push({ source, target, value });
  };

  for (const { channel, sent, opened, clicked, converted } of funnel) {
    const label = CHANNEL_LABEL[channel] ?? channel;
    const intoConverted = Math.min(converted, clicked);
    const fromNoClick = Math.min(converted - intoConverted, opened - clicked);

    const sentNode = node({ name: label, amount: sent, tone: "flow", note: "sent" });
    const openedNode = node({ name: "Opened", amount: opened, tone: "flow", note: formatRate(opened, sent) });
    const notOpened = node({ name: "Not opened", amount: sent - opened, tone: "dropped", note: formatRate(sent - opened, sent) });
    const clickedNode = node({ name: "Clicked", amount: clicked, tone: "flow", note: formatRate(clicked, opened) });
    const noClick = node({ name: "No click", amount: opened - clicked, tone: "dropped", note: formatRate(opened - clicked, opened) });
    const convertedNode = node({ name: "Converted", amount: converted, tone: "converted", note: "last touch" });
    const noConversion = node({ name: "No conversion", amount: clicked - intoConverted, tone: "dropped", note: formatRate(clicked - intoConverted, clicked) });

    link(sentNode, openedNode, opened);
    link(sentNode, notOpened, sent - opened);
    link(openedNode, clickedNode, clicked);
    link(openedNode, noClick, opened - clicked);
    link(clickedNode, convertedNode, intoConverted);
    link(clickedNode, noConversion, clicked - intoConverted);
    link(noClick, convertedNode, fromNoClick);
  }

  // Sankey needs every node to carry a link; drop the ones a zero count left out.
  const used = new Set(links.flatMap((item) => [item.source, item.target]));
  const remap = new Map<number, number>();
  const kept = nodes.filter((_, index) => used.has(index));
  nodes.forEach((_, index) => used.has(index) && remap.set(index, remap.size));
  return {
    nodes: kept,
    links: links.map((item) => ({ ...item, source: remap.get(item.source)!, target: remap.get(item.target)! })),
  };
}

export function FunnelSankey({ funnel }: { readonly funnel: Funnel }) {
  const [hover, setHover] = useState<Hover>(null);
  const { nodes, links } = buildFlow(funnel);

  const linkOpacity = (index: number) =>
    !hover ? LINK_OPACITY.rest : hover.type === "link" ? (hover.index === index ? LINK_OPACITY.on : LINK_OPACITY.off) : links[index].source === hover.index || links[index].target === hover.index ? LINK_OPACITY.on : LINK_OPACITY.off;

  const renderNode = ({ x, y, width, height, index, payload }: SankeyNodeProps) => {
    const item = payload as LaidOutNode;
    const first = item.depth === 0;
    const labelX = first ? x - 10 : x + width + 10;
    return (
      <g>
        <rect fill={`var(--color-${item.tone})`} height={Math.max(height, 2)} rx={2} width={width} x={x} y={y} />
        <text
          className="pointer-events-none text-xs"
          dominantBaseline="middle"
          paintOrder="stroke"
          stroke="var(--frame-panel-bg, var(--background))"
          strokeLinejoin="round"
          strokeWidth={4}
          textAnchor={first ? "end" : "start"}
          x={labelX}
          y={y + height / 2 - 7}
        >
          <tspan className="fill-foreground font-medium">{item.name}</tspan>
          <tspan className="fill-muted-foreground tabular-nums" dy={15} x={labelX}>
            {formatCount(item.amount)}
            {first ? "" : ` · ${item.note}`}
          </tspan>
        </text>
        <rect
          fill="transparent"
          height={Math.max(height, 2)}
          onMouseEnter={() => setHover({ type: "node", index })}
          onMouseLeave={() => setHover(null)}
          width={width + 4}
          x={x}
          y={y}
        />
      </g>
    );
  };

  const renderLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index }: SankeyLinkProps) => {
    const tone = nodes[links[index].target].tone;
    const d = `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
    return (
      <path
        className="transition-colors"
        d={d}
        fill="none"
        onMouseEnter={() => setHover({ type: "link", index })}
        onMouseLeave={() => setHover(null)}
        opacity={linkOpacity(index)}
        stroke={`var(--color-${tone})`}
        strokeWidth={Math.max(linkWidth, 1)}
      />
    );
  };

  const readout = (() => {
    if (hover?.type === "link") {
      const item = links[hover.index];
      return `${nodes[item.source].name} → ${nodes[item.target].name}: ${formatCount(item.value)}`;
    }
    if (hover?.type === "node") {
      const item = nodes[hover.index];
      return `${item.name}: ${formatCount(item.amount)}${item.note === "sent" ? " sent" : ` (${item.note})`}`;
    }
    return "Hover a node or flow for its count.";
  })();

  return (
    <Frame dense spacing="default" className="@container w-full">
      <FrameHeader className="min-w-0 flex-col gap-0.5">
        <FrameTitle>Channel funnel</FrameTitle>
        <FrameDescription>Sent, opened, clicked and converted per channel, with the drop-off at each step.</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="overflow-x-auto">
          <ChartContainer
            aria-label="Channel funnel: sent, opened, clicked and converted for email, push and in-app"
            className="aspect-auto h-96 w-full min-w-2xl"
            config={CHART_CONFIG}
            initialDimension={{ width: 800, height: 384 }}
            role="img"
          >
            <Sankey
              align="left"
              data={{ nodes, links }}
              link={renderLink}
              linkCurvature={0.5}
              margin={MARGIN}
              node={renderNode}
              nodePadding={22}
              nodeWidth={4}
              nameKey="name"
              sort={false}
              verticalAlign="top"
            />
          </ChartContainer>
        </div>
        <ul className="sr-only">
          {links.map((item) => (
            <li key={`${item.source}-${item.target}`}>
              {nodes[item.source].name} to {nodes[item.target].name}: {formatCount(item.value)}
            </li>
          ))}
        </ul>
      </FramePanel>
      <FrameFooter className="text-xs text-muted-foreground">
        <span aria-live="polite">{readout}</span>
      </FrameFooter>
    </Frame>
  );
}
