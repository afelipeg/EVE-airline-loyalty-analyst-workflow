import type { ReactNode } from "react";
import { Frame, FramePanel } from "@/components/reui/frame";

export function ViewShell({
  title,
  description,
  actions,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

export function StatStrip({ children }: { readonly children: ReactNode }) {
  return <Frame className="grid grid-cols-2 gap-2 lg:grid-cols-4">{children}</Frame>;
}

export function Stat({ label, value, hint }: { readonly label: string; readonly value: string; readonly hint?: string }) {
  return (
    <FramePanel className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tracking-tight tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </FramePanel>
  );
}

export const formatInt = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const formatMxn = (value: number) => `$${formatInt(value)}`;
export const formatPct = (value: number) => `${value.toFixed(1)}%`;
