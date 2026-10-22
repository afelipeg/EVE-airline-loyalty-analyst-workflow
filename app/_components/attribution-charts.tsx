"use client";

import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, Rectangle, XAxis, YAxis, type BarShapeProps } from "recharts";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { getEngagementByWeek, getEngagementVsRask } from "@/agent/lib/cdp/attribution";
import { formatInt } from "./view-shell";

// Three ReUI chart blocks adapted to the attribution data (the demo data,
// ranges and playback controls are gone):
//   RaskBridge       from chart-21 (waterfall on a Recharts ComposedChart)
//   EngagementSlope  from chart-51 (slope chart on a Recharts LineChart)
//   EngagementTrend  from chart-23 (multi-line with a metric switch)
// Every figure comes from the server; the UI only formats and lays out.

export type EngagementWeek = ReturnType<typeof getEngagementByWeek>[number];
export type EngagementRow = ReturnType<typeof getEngagementVsRask>[number];
export type BridgeChannel = { readonly channel: string; readonly raskMxn: number };

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  push: "Push",
  in_app: "In-app",
  web_organic: "Web organic",
  app_organic: "App organic",
  direct_web: "Direct web",
  direct_app: "Direct app",
  call_center: "Call center",
  ota: "OTA",
};
export const channelLabel = (channel: string) => CHANNEL_LABEL[channel] ?? channel;

const rask = (value: number) => value.toFixed(4);

// ---------------------------------------------------------------- RASK bridge

type BridgeStep = { readonly key: string; readonly label: string; readonly from: number; readonly to: number; readonly range: [number, number]; readonly total: boolean };

const BRIDGE_CONFIG = {
  step: { label: "Channel contribution", color: "var(--primary)" },
  total: { label: "Window RASK", color: "var(--success)" },
} satisfies ChartConfig;

function BridgeBar(props: BarShapeProps) {
  const step = props.payload as BridgeStep;
  return <Rectangle {...props} fill={step.total ? "var(--color-total)" : "var(--color-step)"} radius={2} />;
}
const renderBridgeBar = (props: BarShapeProps) => <BridgeBar {...props} />;

export function RaskBridge({ channels, windowRaskMxn, networkRaskMxn }: { readonly channels: readonly BridgeChannel[]; readonly windowRaskMxn: number; readonly networkRaskMxn: number }) {
  let running = 0;
  const steps: BridgeStep[] = channels.map((item) => {
    const from = running;
    running += item.raskMxn;
    return { key: item.channel, label: channelLabel(item.channel), from, to: running, range: [from, running], total: false };
  });
  steps.push({ key: "window", label: "Window RASK", from: 0, to: windowRaskMxn, range: [0, windowRaskMxn], total: true });

  return (
    <Frame dense spacing="default" className="@container w-full">
      <FrameHeader className="flex-col gap-0.5">
        <FrameTitle>RASK bridge</FrameTitle>
        <FrameDescription>From zero to the window RASK, one step per channel under the selected model.</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="overflow-x-auto">
          <ChartContainer
            aria-label="RASK bridge: each channel's contribution stacking up to the window RASK"
            className="aspect-auto h-72 w-full min-w-2xl"
            config={BRIDGE_CONFIG}
            initialDimension={{ width: 800, height: 288 }}
          >
            <ComposedChart accessibilityLayer barCategoryGap="30%" data={steps} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis axisLine={false} dataKey="label" interval={0} tickLine={false} tickMargin={10} />
              <YAxis axisLine={false} tickFormatter={(value: number) => value.toFixed(2)} tickLine={false} tickMargin={8} width={44} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-52"
                    formatter={(_value, _name, item) => {
                      const step = item.payload as BridgeStep;
                      return (
                        <div className="flex flex-1 flex-col gap-1">
                          <span className="font-medium">{step.label}</span>
                          <span className="flex justify-between gap-4 text-muted-foreground">
                            {step.total ? "Window RASK" : "Contribution"}
                            <span className="font-mono font-medium text-foreground tabular-nums">{rask(step.to - step.from)} MXN</span>
                          </span>
                          {step.total ? null : (
                            <span className="flex justify-between gap-4 text-muted-foreground">
                              Running total
                              <span className="font-mono font-medium text-foreground tabular-nums">{rask(step.to)} MXN</span>
                            </span>
                          )}
                        </div>
                      );
                    }}
                    hideIndicator
                    hideLabel
                  />
                }
                cursor={false}
                isAnimationActive={false}
              />
              <Bar dataKey="range" isAnimationActive={false} maxBarSize={28} shape={renderBridgeBar} />
            </ComposedChart>
          </ChartContainer>
        </div>
      </FramePanel>
      <FrameFooter className="text-xs text-muted-foreground tabular-nums">
        Window RASK {rask(windowRaskMxn)} MXN · network RASK {rask(networkRaskMxn)} MXN (reference). Channel steps are rounded to 4 decimals, so the last step can differ from the total by rounding.
      </FrameFooter>
    </Frame>
  );
}

// ------------------------------------------------------------- Engagement slope

const MOVE_COLOR = { up: "var(--success)", down: "var(--destructive)", hold: "var(--muted-foreground)" } as const;
type Move = keyof typeof MOVE_COLOR;
const moveOf = (row: EngagementRow): Move => (row.raskRank < row.engagementRank ? "up" : row.raskRank > row.engagementRank ? "down" : "hold");

const SLOPE_MARGIN = { top: 8, right: 150, bottom: 8, left: 170 };

export function EngagementSlope({ rows }: { readonly rows: readonly EngagementRow[] }) {
  const [active, setActive] = useState<string | null>(null);
  const data = [
    { x: 0, ...Object.fromEntries(rows.map((row) => [row.channel, row.engagementRank])) },
    { x: 1, ...Object.fromEntries(rows.map((row) => [row.channel, row.raskRank])) },
  ];
  const detail = (row: EngagementRow) =>
    `${channelLabel(row.channel)}: ${formatInt(row.engagements)} engagements, RASK ${rask(row.raskMxn)} MXN, ${row.raskPerEngagementMxn.toFixed(6)} MXN per engagement`;
  const shown = rows.find((row) => row.channel === active);

  return (
    <Frame dense spacing="default" className="@container w-full">
      <FrameHeader className="flex-col gap-0.5">
        <FrameTitle>Engagement vs RASK</FrameTitle>
        <FrameDescription>Each channel ranked by engagements on the left and by attributed RASK on the right.</FrameDescription>
      </FrameHeader>
      <FramePanel>
        <div className="overflow-x-auto">
          <ChartContainer
            aria-label="Channels ranked by engagements on the left and by RASK on the right"
            className="aspect-auto h-72 w-full min-w-xl"
            config={{}}
            initialDimension={{ width: 720, height: 288 }}
            onMouseLeave={() => setActive(null)}
          >
            <LineChart data={data} margin={SLOPE_MARGIN}>
              <XAxis dataKey="x" domain={[0, 1]} hide type="number" />
              <YAxis domain={[0.5, rows.length + 0.5]} hide reversed type="number" />
              {rows.map((row) => {
                const color = MOVE_COLOR[moveOf(row)];
                const quiet = active !== null && active !== row.channel;
                const handlers = { onMouseEnter: () => setActive(row.channel), onClick: () => setActive(row.channel) };
                return (
                  <Line
                    activeDot={false}
                    dataKey={row.channel}
                    dot={({ cx, cy, index }) => {
                      if (cx == null || cy == null) return <g key={index} />;
                      const left = index === 0;
                      return (
                        <g className={quiet ? "opacity-25" : undefined} key={`${row.channel}-${index}`} {...handlers}>
                          <title>{detail(row)}</title>
                          <circle cx={cx} cy={cy} fill={left ? "var(--background)" : color} r={4} stroke={color} strokeWidth={1.5} />
                          <text
                            className="text-xs"
                            dominantBaseline="central"
                            textAnchor={left ? "end" : "start"}
                            x={left ? cx - 10 : cx + 10}
                            y={cy}
                          >
                            <tspan className="fill-muted-foreground tabular-nums">#{left ? row.engagementRank : row.raskRank} </tspan>
                            <tspan className="fill-foreground font-medium">{channelLabel(row.channel)}</tspan>
                            <tspan className="fill-muted-foreground tabular-nums" dx={6}>
                              {left ? formatInt(row.engagements) : rask(row.raskMxn)}
                            </tspan>
                          </text>
                        </g>
                      );
                    }}
                    isAnimationActive={false}
                    key={row.channel}
                    legendType="none"
                    onMouseEnter={() => setActive(row.channel)}
                    stroke={color}
                    strokeOpacity={quiet ? 0.1 : 0.8}
                    strokeWidth={active === row.channel ? 3 : 2}
                    type="linear"
                  />
                );
              })}
            </LineChart>
          </ChartContainer>
        </div>
      </FramePanel>
      <FrameFooter className="text-xs text-muted-foreground tabular-nums">
        <span aria-live="polite">{shown ? detail(shown) : "Green: ranks higher on RASK than on engagement. Red: lower. Hover a line for the figures."}</span>
      </FrameFooter>
    </Frame>
  );
}

// ------------------------------------------------------------ Engagement trend

type Metric = "sends" | "opens" | "clicks";
const METRICS: readonly { readonly value: Metric; readonly label: string }[] = [
  { value: "sends", label: "Sends" },
  { value: "opens", label: "Opens" },
  { value: "clicks", label: "Clicks" },
];

const TREND_CONFIG = {
  email: { label: "Email", color: "var(--primary)" },
  push: { label: "Push", color: "var(--info)" },
  in_app: { label: "In-app", color: "var(--success)" },
  web: { label: "Web sessions", color: "var(--warning)" },
  app: { label: "App sessions", color: "var(--muted-foreground)" },
} satisfies ChartConfig;
type SeriesKey = keyof typeof TREND_CONFIG;

export function EngagementTrend({ weeks }: { readonly weeks: readonly EngagementWeek[] }) {
  const [metric, setMetric] = useState<Metric>("sends");
  const data = weeks.map((week) => ({
    weekStart: week.weekStart,
    email: week.email[metric],
    push: week.push[metric],
    in_app: week.in_app[metric],
    web: week.webSessions,
    app: week.appSessions,
  }));
  const totals = (Object.keys(TREND_CONFIG) as SeriesKey[]).map((key) => ({ key, total: data.reduce((sum, row) => sum + row[key], 0) }));

  return (
    <Frame dense spacing="default" className="@container w-full">
      <FrameHeader className="min-w-0 flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Engagement over time</FrameTitle>
          <FrameDescription>Weekly campaign {metric} by channel, plus resolved web and app sessions.</FrameDescription>
        </div>
        <ToggleGroup
          aria-label="Campaign metric"
          multiple={false}
          onValueChange={(value: string[]) => value[0] && setMetric(value[0] as Metric)}
          size="sm"
          spacing={0}
          value={[metric]}
          variant="outline"
        >
          {METRICS.map((item) => (
            <ToggleGroupItem key={item.value} value={item.value}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FrameHeader>
      <FramePanel>
        <div className="overflow-x-auto">
          <ChartContainer
            aria-label="Weekly engagement by channel"
            className="aspect-auto h-72 w-full min-w-xl"
            config={TREND_CONFIG}
            initialDimension={{ width: 720, height: 288 }}
          >
            <LineChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis axisLine={false} dataKey="weekStart" tickFormatter={(value: string) => value.slice(5)} tickLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tickMargin={8} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} cursor={false} isAnimationActive={false} />
              {(Object.keys(TREND_CONFIG) as SeriesKey[]).map((key) => (
                <Line
                  activeDot={{ r: 3 }}
                  dataKey={key}
                  dot={false}
                  isAnimationActive={false}
                  key={key}
                  stroke={`var(--color-${key})`}
                  strokeDasharray={key === "web" || key === "app" ? "4 3" : undefined}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>
      </FramePanel>
      <FrameFooter className="flex-row flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {totals.map(({ key, total }) => (
          <span className="flex items-center gap-1.5 tabular-nums" key={key}>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: `var(--color-${key})` }} />
            {TREND_CONFIG[key].label} {formatInt(total)}
          </span>
        ))}
      </FrameFooter>
    </Frame>
  );
}
