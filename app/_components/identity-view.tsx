"use client";

import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@/components/reui/frame";
import type { getIdentitySummary } from "@/agent/lib/cdp/identity";
import { Stat, StatStrip, ViewShell, formatInt, formatPct } from "./view-shell";

export type IdentitySummary = ReturnType<typeof getIdentitySummary>;

const SOURCE_LABEL: Record<string, string> = {
  web: "Web events",
  app: "App events",
  esp_sends: "ESP sends",
  ancillary_orders: "Ancillary orders",
};

export function IdentityView({ summary }: { readonly summary: IdentitySummary }) {
  const { funnel, bySource, guardrails } = summary;
  const sharedIds = [...guardrails.sharedDevices, ...guardrails.sharedCookies];

  return (
    <ViewShell
      description={`Deterministic identity resolution over the last ${summary.window.days} days. Rule order: member_id, pnr, email_hash, phone, device, cookie.`}
      title="Identity resolution"
    >
      <StatStrip>
        <Stat label="Records" value={formatInt(funnel.records)} />
        <Stat label="Resolved" value={formatPct(funnel.resolvedSharePct)} hint={`${formatInt(funnel.resolvedRecords)} records`} />
        <Stat label="CRM profiles" value={formatInt(funnel.crmProfiles)} />
        <Stat label="With digital activity" value={formatInt(funnel.profilesWithDigitalActivity)} />
      </StatStrip>

      <Frame stacked>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>By source</FrameTitle>
          <FrameDescription>Records resolved to a member, and the rule that matched them.</FrameDescription>
        </FrameHeader>
        {bySource.map((row) => (
          <FramePanel className="flex flex-col gap-2" key={row.source}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{SOURCE_LABEL[row.source] ?? row.source}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatInt(row.resolved)} of {formatInt(row.records)} resolved · {formatPct(row.resolvedSharePct)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {Object.entries(row.byRule).map(([rule, count]) => (
                <Badge className="tabular-nums" key={rule} variant="outline">
                  {rule} {formatInt(count)}
                </Badge>
              ))}
              {row.blockedByGuardrail > 0 ? (
                <Badge className="tabular-nums" variant="warning-light">
                  {formatInt(row.blockedByGuardrail)} blocked by guardrail
                </Badge>
              ) : null}
            </div>
          </FramePanel>
        ))}
      </Frame>

      <Frame>
        <FrameHeader className="flex-col gap-0.5">
          <FrameTitle>Guardrails</FrameTitle>
          <FrameDescription>An over-merge is a breach, not a bug: ambiguous identifiers are blocked, never guessed.</FrameDescription>
        </FrameHeader>
        <FramePanel className="flex flex-col gap-2">
          <Alert variant={sharedIds.length > 0 ? "warning" : "success"}>
            {sharedIds.length > 0 ? <AlertTriangleIcon /> : <CheckCircle2Icon />}
            <AlertTitle>Shared devices and cookies: {sharedIds.length}</AlertTitle>
            <AlertDescription>
              {sharedIds.length > 0
                ? sharedIds.map((item) => `${item.id} (${item.memberIds.join(", ")})`).join("; ") +
                  ". Never used to link anonymous activity."
                : "No device or cookie was signed in by more than one member."}
            </AlertDescription>
          </Alert>
          <Alert variant={guardrails.blockedEmails > 0 ? "warning" : "success"}>
            {guardrails.blockedEmails > 0 ? <AlertTriangleIcon /> : <CheckCircle2Icon />}
            <AlertTitle>Blocked emails: {guardrails.blockedEmails}</AlertTitle>
            <AlertDescription>
              {guardrails.blockedEmails > 0 ? guardrails.blockedEmailReasons.join("; ") : "No email was blocked."}
            </AlertDescription>
          </Alert>
          <Alert variant={guardrails.pnrEmailConflicts > 0 ? "info" : "success"}>
            {guardrails.pnrEmailConflicts > 0 ? <InfoIcon /> : <CheckCircle2Icon />}
            <AlertTitle>PNR and email conflicts: {guardrails.pnrEmailConflicts}</AlertTitle>
            <AlertDescription>The PNR owner wins when an order email points at a different member.</AlertDescription>
          </Alert>
          <Alert variant={guardrails.overMerges > 0 ? "destructive" : "success"}>
            {guardrails.overMerges > 0 ? <AlertTriangleIcon /> : <CheckCircle2Icon />}
            <AlertTitle className="flex items-center gap-2">
              Over-merges
              <Badge variant={guardrails.overMerges > 0 ? "destructive-light" : "success-light"}>{guardrails.overMerges}</Badge>
            </AlertTitle>
            <AlertDescription>Devices or cookies held by two member clusters. The target is zero.</AlertDescription>
          </Alert>
        </FramePanel>
      </Frame>
    </ViewShell>
  );
}
