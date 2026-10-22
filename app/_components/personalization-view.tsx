"use client";

import { useMemo, useState } from "react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { MessageSquareIcon } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Filters } from "@/components/reui/filters/filters";
import { createFilterQuery } from "@/components/reui/filters/filters-query";
import type { FilterField, FilterNode, FilterQuery, FilterRule } from "@/components/reui/filters/filters-types";
import type { MemberPlan, PlanStatus, planMembers } from "@/agent/lib/cdp/personalization";
import { Stat, StatStrip, ViewShell, formatInt, formatMxn } from "./view-shell";

type Plans = ReturnType<typeof planMembers>;
export type PersonalizationData = Plans;

const SEGMENTS = ["Retencion Prioritaria", "En Riesgo", "Embajadores", "Base"] as const;

const STATUS: Record<PlanStatus, { readonly label: string; readonly variant: "success-light" | "info-light" | "destructive-light" | "warning-light" }> = {
  ready: { label: "Ready", variant: "success-light" },
  holdout_control: { label: "Holdout", variant: "info-light" },
  no_consent: { label: "No consent", variant: "destructive-light" },
  frequency_capped: { label: "Frequency capped", variant: "warning-light" },
};

const CHANNEL_LABEL: Record<string, string> = { email: "Email", push: "Push", in_app: "In-app" };

// Faceted filters over the plan rows (ReUI Filters, as in its c-filters-7
// table example). The query is a plain tree compiled to a row predicate here.
const FIELDS: FilterField[] = [
  { id: "name", label: "Member", type: "text" },
  { id: "status", label: "Status", type: "select", options: (Object.keys(STATUS) as PlanStatus[]).map((value) => ({ value, label: STATUS[value].label })) },
  { id: "tier", label: "Tier", type: "select", options: ["Titanio", "Platino", "Oro", "Plata", "Clasico"].map((value) => ({ value, label: value })) },
  { id: "segment", label: "Segment", type: "select", options: SEGMENTS.map((value) => ({ value, label: value })) },
  { id: "channel", label: "Channel", type: "select", options: Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label })) },
];

function matchesRule(plan: MemberPlan, rule: FilterRule): boolean {
  const actual = String(plan[rule.path[0] as keyof MemberPlan] ?? "");
  const value = rule.value;
  // A rule still being edited, or an empty pick list, constrains nothing.
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return true;
  const result = (() => {
    switch (rule.operator) {
      case "contains":
        return actual.toLowerCase().includes(String(value).toLowerCase());
      case "not_contains":
        return !actual.toLowerCase().includes(String(value).toLowerCase());
      case "is":
        return actual === String(value);
      case "is_not":
        return actual !== String(value);
      case "is_any_of":
        return (value as string[]).includes(actual);
      case "is_none_of":
        return !(value as string[]).includes(actual);
      default:
        return true;
    }
  })();
  return rule.negated ? !result : result;
}

function matches(plan: MemberPlan, node: FilterNode): boolean {
  if (node.type === "rule") return matchesRule(plan, node);
  return node.combinator === "and" ? node.rules.every((child) => matches(plan, child)) : node.rules.some((child) => matches(plan, child));
}

const columns: ColumnDef<DataGridFeatures, MemberPlan>[] = [
  {
    id: "member",
    accessorKey: "name",
    header: "Member",
    cell: ({ row }) => (
      <div className="flex flex-col leading-tight">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.memberId}</span>
      </div>
    ),
  },
  { id: "tier", accessorKey: "tier", header: "Tier" },
  { id: "segment", accessorKey: "segment", header: "Segment" },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant={STATUS[row.original.status].variant}>{STATUS[row.original.status].label}</Badge>,
  },
  { id: "channel", accessorKey: "channel", header: "Channel", cell: ({ row }) => (row.original.channel ? CHANNEL_LABEL[row.original.channel] : "-") },
  { id: "weekday", accessorKey: "sendWeekday", header: "Day", cell: ({ row }) => row.original.sendWeekday ?? "-" },
  {
    id: "rask",
    accessorKey: "raskAtRiskMxn",
    header: "RASK at risk",
    meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    cell: ({ row }) => `${formatMxn(row.original.raskAtRiskMxn)} MXN`,
  },
  { id: "reason", accessorKey: "reason", header: "Reason", meta: { cellClassName: "min-w-72 whitespace-normal text-xs text-muted-foreground" } },
];

function PlanGrid({ plans }: { readonly plans: readonly MemberPlan[] }) {
  const table = useTable({
    features: dataGridFeatures,
    data: plans as MemberPlan[],
    columns,
    getRowId: (row) => row.memberId,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <DataGrid recordCount={plans.length} table={table} tableLayout={{ dense: true, headerBackground: true, width: "auto" }}>
      <DataGridContainer>
        <DataGridScrollArea orientation="horizontal">
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
      <DataGridPagination sizes={[10, 25, 50]} />
    </DataGrid>
  );
}

export function PersonalizationView({
  data,
  isBusy,
  onPlanSegment,
}: {
  readonly data: PersonalizationData;
  readonly isBusy: boolean;
  readonly onPlanSegment: (segment: string) => void;
}) {
  const [query, setQuery] = useState<FilterQuery>(() => createFilterQuery());
  const { summary } = data;
  const plans = useMemo(
    () => [...data.plans].sort((a, b) => b.raskAtRiskMxn - a.raskAtRiskMxn).filter((plan) => matches(plan, query)),
    [data.plans, query],
  );

  return (
    <ViewShell
      description="Channel and day decisioning per member from identity-resolved activity. It decides where an offer may go; it never sends."
      title="Personalization"
    >
      <StatStrip>
        <Stat label="Ready" value={formatInt(summary.ready)} hint={`${formatMxn(summary.readyRaskAtRiskMxn)} MXN RASK at risk`} />
        <Stat label="Holdout" value={formatInt(summary.holdoutControl)} />
        <Stat label="No consent" value={formatInt(summary.noConsent)} />
        <Stat label="Frequency capped" value={formatInt(summary.frequencyCapped)} />
      </StatStrip>

      <Frame>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>Ready members by channel</FrameTitle>
          <FrameDescription>Where the next activation would go.</FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-wrap items-center gap-2">
          {summary.byChannel.map((item) => (
            <Badge className="tabular-nums" key={item.channel} variant="outline">
              {CHANNEL_LABEL[item.channel] ?? item.channel} {formatInt(item.members)}
            </Badge>
          ))}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>Plan a segment with the team</FrameTitle>
          <FrameDescription>Opens the chat and asks the specialists for an offer, channel and day, ready for your approval.</FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-wrap items-center gap-2">
          {SEGMENTS.map((segment) => (
            <Button disabled={isBusy} key={segment} onClick={() => onPlanSegment(segment)} size="sm" variant="outline">
              <MessageSquareIcon />
              Ask the team to plan {segment}
            </Button>
          ))}
        </FramePanel>
      </Frame>

      <Frame dense>
        <FrameHeader className="min-w-0 flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <FrameTitle>Member plans</FrameTitle>
            <FrameDescription>
              {formatInt(plans.length)} of {formatInt(summary.members)} members, highest RASK at risk first.
            </FrameDescription>
          </div>
        </FrameHeader>
        <FramePanel className="border-b p-3">
          <Filters fields={FIELDS} onQueryChange={setQuery} query={query} showClear />
        </FramePanel>
        <FramePanel className="p-0">
          <PlanGrid key={JSON.stringify(query)} plans={plans} />
        </FramePanel>
      </Frame>
    </ViewShell>
  );
}
