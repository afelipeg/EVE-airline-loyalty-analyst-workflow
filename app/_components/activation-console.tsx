"use client";

import type { EveDynamicToolPart } from "eve/react";
import { CheckCircle2Icon, CircleDashedIcon, MinusCircleIcon, ShieldCheckIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { Frame, FrameFooter, FrameHeader, FrameTitle, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Trace, TraceDescription, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import type { AgentInputResponse } from "./agent-message";

// The human-in-the-loop surface for record_activation_spec, after ReUI's
// agent-activity-1 (a run that stops at an approval gate), c-trace-5 (rows
// that flip from pending to applied once approved) and agent-activity-5 (a
// done/skipped outcome per row). It only renders eve's own approval request
// and the tool's result; the decision always goes back through eve.

type Row = { readonly memberId: string; readonly offer?: string; readonly channel?: string | null; readonly sendWeekday?: string | null };
type Outcome = {
  readonly specId: string;
  readonly name: string;
  readonly rows: readonly Row[];
  readonly dropped: readonly { readonly memberId: string; readonly status: string; readonly reason: string }[];
  readonly raskAtRiskCoveredMxn: number;
};

const mxn = new Intl.NumberFormat("en-US", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export function ActivationConsole({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const input = (part.input ?? {}) as { name?: string; rows?: Row[] };
  const rows = input.rows ?? [];
  const request = part.toolMetadata?.eve?.inputRequest;
  const response = part.toolMetadata?.eve?.inputResponse;
  const outcome = part.state === "output-available" ? (part.output as Outcome | undefined) : undefined;
  const denied = part.state === "output-denied" || (response && /deny|reject/i.test(response.optionId ?? response.text ?? ""));
  const waiting = request && !response && !outcome;

  return (
    <Frame>
      <FrameHeader className="flex flex-row items-center justify-between gap-3">
        <FrameTitle className="flex items-center gap-2 text-sm">
          <ShieldCheckIcon className="size-4" aria-hidden="true" />
          {input.name ?? "Activation spec"}
        </FrameTitle>
        <Badge
          size="sm"
          variant={outcome ? "success-light" : denied ? "destructive-light" : waiting ? "warning-light" : "outline"}
        >
          {outcome ? "Approved · not sent" : denied ? "Denied" : waiting ? "Awaiting your approval" : "Preparing"}
        </Badge>
      </FrameHeader>

      {outcome ? (
        <FramePanel className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge size="sm" variant="success-light">{outcome.rows.length} done</Badge>
            <Badge size="sm" variant="outline">{outcome.dropped.length} skipped</Badge>
            <span className="text-muted-foreground">
              {mxn.format(outcome.raskAtRiskCoveredMxn)} RASK at risk covered · {outcome.specId}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {outcome.rows.map((row) => (
              <Item key={row.memberId} size="sm" className="px-0 py-1">
                <ItemMedia>
                  <CheckCircle2Icon className="size-4 text-success" aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-mono text-xs">{row.memberId}</ItemTitle>
                  <ItemDescription className="text-xs">
                    {row.offer} · {row.channel} · {row.sendWeekday ?? "any day"}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
            {outcome.dropped.map((row) => (
              <Item key={row.memberId} size="sm" className="px-0 py-1">
                <ItemMedia>
                  <MinusCircleIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-mono text-xs">{row.memberId}</ItemTitle>
                  <ItemDescription className="text-xs">
                    Skipped ({row.status}): {row.reason}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </div>
        </FramePanel>
      ) : (
        <FramePanel>
          <Trace className="text-sm">
            {rows.map((row) => (
              <TraceLine key={row.memberId} status={denied ? "error" : "pending"}>
                <TraceIcon>{denied ? <XCircleIcon /> : <CircleDashedIcon />}</TraceIcon>
                <TraceTitle className="font-mono text-xs">{row.memberId}</TraceTitle>
                <TraceDescription>{row.offer}</TraceDescription>
              </TraceLine>
            ))}
          </Trace>
        </FramePanel>
      )}

      {waiting ? (
        <FrameFooter className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {rows.length} members · consent, holdout and frequency cap are re-checked on approval. Nothing is sent.
          </span>
          <div className="flex gap-2">
            {request.options?.map((option) => (
              <Button
                disabled={!canRespond}
                key={option.id}
                onClick={() => void onInputResponses([{ optionId: option.id, requestId: request.requestId }])}
                size="sm"
                type="button"
                variant={option.style === "danger" ? "outline" : "default"}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </FrameFooter>
      ) : null}
    </Frame>
  );
}
