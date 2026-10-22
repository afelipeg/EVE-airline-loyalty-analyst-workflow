import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { getDashboardSnapshot } from "@/agent/lib/aeromexico-data";

export const snapshot = getDashboardSnapshot();

export function MetricsPanel() {
  return (
    <Frame stacked>
      {snapshot.comparisons.map((comparison) => (
        <MetricTile key={comparison.metric} comparison={comparison} />
      ))}
    </Frame>
  );
}

function MetricTile({
  comparison,
}: {
  readonly comparison: (typeof snapshot.comparisons)[number];
}) {
  const positive = comparison.absoluteChange >= 0;

  return (
    <FramePanel>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{labelForMetric(comparison.metric)}</p>
        <Badge size="sm" variant={positive ? "success-light" : "destructive-light"}>
          {comparison.percentChange === null
            ? "n/a"
            : `${positive ? "+" : ""}${comparison.percentChange.toFixed(1)}%`}
        </Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="font-mono text-2xl font-semibold">
          {formatValue(comparison.metric, comparison.current.value)}
        </span>
        <span className="text-xs text-muted-foreground">
          was {formatValue(comparison.metric, comparison.previous.value)}
        </span>
      </div>
    </FramePanel>
  );
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
