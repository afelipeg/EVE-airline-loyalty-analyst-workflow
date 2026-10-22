"use client";

import { useState } from "react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/reui/badge";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AttributionModel, getAttribution, getChannelFunnel, getHoldoutLift } from "@/agent/lib/cdp/attribution";
import { EngagementSlope, EngagementTrend, RaskBridge, channelLabel, type EngagementRow, type EngagementWeek } from "./attribution-charts";
import { FunnelSankey } from "./funnel-sankey";
import { Stat, StatStrip, ViewShell, formatInt, formatMxn, formatPct } from "./view-shell";

type Attribution = ReturnType<typeof getAttribution>;
type Campaign = Attribution["byCampaign"][number];
export type AttributionData = {
  readonly byModel: Readonly<Record<AttributionModel, Attribution>>;
  readonly funnel: ReturnType<typeof getChannelFunnel>;
  readonly holdout: ReturnType<typeof getHoldoutLift>;
  readonly engagementByWeek: readonly EngagementWeek[];
  readonly engagementVsRask: Readonly<Record<AttributionModel, readonly EngagementRow[]>>;
};

export const MODELS: readonly { readonly value: AttributionModel; readonly label: string }[] = [
  { value: "position_based", label: "Position-based" },
  { value: "linear", label: "Linear" },
  { value: "last_touch", label: "Last touch" },
];

const right = { headerClassName: "text-right", cellClassName: "text-right tabular-nums" };

const campaignColumns: ColumnDef<DataGridFeatures, Campaign>[] = [
  { id: "name", accessorKey: "name", header: "Campaign" },
  { id: "channel", accessorKey: "channel", header: "Channel", cell: ({ row }) => <Badge variant="outline">{channelLabel(row.original.channel)}</Badge> },
  { id: "sends", accessorKey: "sends", header: "Sends", meta: right, cell: ({ row }) => formatInt(row.original.sends) },
  { id: "open", accessorKey: "openRatePct", header: "Open", meta: right, cell: ({ row }) => formatPct(row.original.openRatePct) },
  { id: "click", accessorKey: "clickRatePct", header: "Click", meta: right, cell: ({ row }) => formatPct(row.original.clickRatePct) },
  { id: "revenue", accessorKey: "attributedRevenueMxn", header: "Attributed revenue", meta: right, cell: ({ row }) => formatMxn(row.original.attributedRevenueMxn) },
  { id: "cost", accessorKey: "costMxn", header: "Cost", meta: right, cell: ({ row }) => formatMxn(row.original.costMxn) },
  { id: "roi", accessorKey: "revenuePerPesoCost", header: "Revenue per peso", meta: right, cell: ({ row }) => `${row.original.revenuePerPesoCost.toFixed(1)}x` },
];

function CampaignTable({ campaigns }: { readonly campaigns: readonly Campaign[] }) {
  const table = useTable({ features: dataGridFeatures, data: campaigns as Campaign[], columns: campaignColumns, manualPagination: true, getRowId: (row) => row.campaignId });
  return (
    <DataGrid recordCount={campaigns.length} table={table} tableLayout={{ dense: true, headerBackground: true, width: "auto" }}>
      <DataGridContainer>
        <DataGridScrollArea orientation="horizontal">
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}

export function AttributionView({ data }: { readonly data: AttributionData }) {
  const [model, setModel] = useState<AttributionModel>("position_based");
  const attribution = data.byModel[model];
  const { totals, window } = attribution;
  const { holdout } = data;

  return (
    <ViewShell
      actions={
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
      }
      description={`Window ${window.start} to ${window.end}, ${window.lookbackDays}-day touch lookback. RASK is attributed revenue over the fixed network ASK.`}
      title="Attribution"
    >
      <StatStrip>
        <Stat label="Conversions" value={formatInt(totals.conversions)} hint={`${formatInt(totals.conversionsWithResolvedTouch)} with a resolved touch`} />
        <Stat label="Revenue" value={`${formatMxn(totals.revenueMxn)} MXN`} />
        <Stat label="Window RASK" value={`${totals.windowRaskMxn.toFixed(4)} MXN`} hint={`Network RASK ${totals.networkRaskMxn.toFixed(4)} MXN`} />
        <Stat label="Share of network RASK" value={formatPct(totals.windowShareOfNetworkRaskPct)} />
      </StatStrip>

      <FunnelSankey funnel={data.funnel} />

      <RaskBridge channels={attribution.byChannel} networkRaskMxn={totals.networkRaskMxn} windowRaskMxn={totals.windowRaskMxn} />

      <Frame>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>RASK by channel</FrameTitle>
          <FrameDescription>Credited conversions, revenue and RASK under the {MODELS.find((item) => item.value === model)?.label.toLowerCase()} model.</FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4">
          {attribution.byChannel.map((row) => (
            <div className="flex flex-col gap-1.5" key={row.channel}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
                <span className="font-medium">{channelLabel(row.channel)}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {row.conversions.toFixed(2)} conversions · {formatMxn(row.revenueMxn)} MXN · RASK {row.raskMxn.toFixed(4)} MXN · {formatPct(row.revenueSharePct)}
                </span>
              </div>
              <Progress aria-label={`${channelLabel(row.channel)} share of revenue`} value={row.revenueSharePct} />
            </div>
          ))}
        </FramePanel>
      </Frame>

      <EngagementSlope rows={data.engagementVsRask[model]} />

      <EngagementTrend weeks={data.engagementByWeek} />

      <Frame dense>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>Campaigns</FrameTitle>
          <FrameDescription>Engagement, attributed revenue and cost per campaign.</FrameDescription>
        </FrameHeader>
        <FramePanel className="p-0">
          <CampaignTable campaigns={attribution.byCampaign} />
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>Holdout lift</FrameTitle>
          <FrameDescription>Treated members against the control group kept out of every activation.</FrameDescription>
        </FrameHeader>
        <FramePanel className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {([
            ["Treated", holdout.treated],
            ["Holdout", holdout.holdout],
          ] as const).map(([label, group]) => (
            <div className="flex flex-col gap-0.5" key={label}>
              <span className="text-xs text-muted-foreground">{label} · {formatInt(group.members)} members</span>
              <span className="text-xl font-semibold tracking-tight tabular-nums">{formatMxn(group.revenuePerMemberMxn)} MXN</span>
              <span className="text-xs text-muted-foreground tabular-nums">per member · {group.conversionsPerMember.toFixed(2)} conversions</span>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Revenue per member lift</span>
            <div>
              <Badge variant={holdout.revenuePerMemberLiftPct === null ? "outline" : holdout.revenuePerMemberLiftPct >= 0 ? "success-light" : "warning-light"}>
                {holdout.revenuePerMemberLiftPct === null ? "n/a" : formatPct(holdout.revenuePerMemberLiftPct)}
              </Badge>
            </div>
          </div>
        </FramePanel>
        <FrameFooter className="text-xs text-muted-foreground">{holdout.caveat}</FrameFooter>
      </Frame>

      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {attribution.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </ViewShell>
  );
}
