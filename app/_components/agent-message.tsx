"use client";

import type {
  EveAuthorizationPart,
  EveDynamicToolPart,
  EveMessage,
  EveMessagePart,
} from "eve/react";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import {
  BrainIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  KeyRoundIcon,
  SparklesIcon,
  TerminalSquareIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { CodeBlock } from "@/components/reui/code-block/code-block";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { cn } from "@/lib/utils";

const streamdownPlugins = { cjk, code, math, mermaid };

export type AgentInputResponse = {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
};

export function AgentMessage({
  canRespond,
  isStreaming,
  message,
  onInputResponses,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly message: EveMessage;
  readonly onInputResponses: (
    responses: readonly AgentInputResponse[],
  ) => void | Promise<void>;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );
  const isUser = message.role === "user";

  return (
    <Message
      align={isUser ? "end" : "start"}
      data-optimistic={message.metadata?.optimistic ? "true" : undefined}
    >
      {isUser ? null : (
        <MessageAvatar className="size-8 translate-y-0! self-start bg-primary/10 text-primary">
          <SparklesIcon className="size-3.5" aria-hidden="true" />
        </MessageAvatar>
      )}
      <MessageContent className="min-w-0">
        <Bubble variant={isUser ? "muted" : "ghost"} className={isUser ? undefined : "w-full min-w-0"}>
          <BubbleContent className="min-w-0 space-y-3">
            {message.parts.map((part, index) => (
              <AgentMessagePart
                canRespond={canRespond}
                isLatestPart={index === message.parts.length - 1}
                isMessageStreaming={isStreaming}
                key={partKey(part, index)}
                onInputResponses={onInputResponses}
                part={part}
                showCaret={
                  isStreaming &&
                  message.role === "assistant" &&
                  index === lastTextIndex
                }
              />
            ))}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function AgentMessagePart({
  canRespond,
  isLatestPart,
  isMessageStreaming,
  onInputResponses,
  part,
  showCaret,
}: {
  readonly canRespond: boolean;
  readonly isLatestPart: boolean;
  readonly isMessageStreaming: boolean;
  readonly onInputResponses: (
    responses: readonly AgentInputResponse[],
  ) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      return (
        <Streamdown
          caret="block"
          className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          isAnimating={showCaret}
          plugins={streamdownPlugins}
        >
          {part.text}
        </Streamdown>
      );
    case "reasoning": {
      const thinking = isMessageStreaming && isLatestPart && part.state === "streaming";
      return (
        <Trace>
          <TraceCollapsible defaultOpen>
            <TraceCollapsibleTrigger>
              <TraceLine status={thinking ? "running" : undefined}>
                <TraceIcon>
                  <BrainIcon />
                </TraceIcon>
                <TraceTitle>{thinking ? "Thinking" : "Reasoning"}</TraceTitle>
              </TraceLine>
            </TraceCollapsibleTrigger>
            <TraceCollapsibleContent className="whitespace-pre-wrap text-xs">{part.text}</TraceCollapsibleContent>
          </TraceCollapsible>
        </Trace>
      );
    }
    case "authorization":
      return <AuthorizationPrompt part={part} />;
    case "dynamic-tool":
      return (
        <div className="space-y-3">
          <SandboxChart output={part.output} toolName={part.toolName} />
          <Trace>
            <TraceCollapsible
              defaultOpen={
                part.state === "approval-requested" ||
                part.state === "approval-responded"
              }
            >
              <TraceCollapsibleTrigger>
                <TraceLine status={toolLineStatus(part.state)}>
                  <TraceIcon>
                    <WrenchIcon />
                  </TraceIcon>
                  <TraceTitle>{part.toolName}</TraceTitle>
                  <TraceDescription>{TOOL_STATE_LABELS[part.state]}</TraceDescription>
                </TraceLine>
              </TraceCollapsibleTrigger>
              <TraceCollapsibleContent className="space-y-3">
                <ToolJson label="Input" value={part.input} />
                <InputRequestActions
                  canRespond={canRespond}
                  part={part}
                  onInputResponses={onInputResponses}
                />
                <SandboxArtifactSummary
                  output={part.output}
                  toolName={part.toolName}
                />
                {part.errorText ? (
                  <p className="text-destructive text-xs">{part.errorText}</p>
                ) : (
                  <ToolJson label="Output" value={withoutChartSvg(part.output)} />
                )}
              </TraceCollapsibleContent>
            </TraceCollapsible>
          </Trace>
        </div>
      );
  }
}

const TOOL_STATE_LABELS: Record<EveDynamicToolPart["state"], string> = {
  "approval-requested": "Awaiting approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

function toolLineStatus(state: EveDynamicToolPart["state"]) {
  if (state === "output-error" || state === "output-denied") return "error";
  if (state === "input-available" || state === "input-streaming") return "running";
  return undefined;
}

// The chart renders as an image above the trace; its SVG markup would only
// flood the JSON block.
function withoutChartSvg(output: unknown): unknown {
  const record = asRecord(output);
  if (!record || !("chartSvg" in record)) return output;
  const { chartSvg: _chartSvg, ...rest } = record;
  return rest;
}

function ToolJson({ label, value }: { readonly label: string; readonly value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <CodeBlock
      code={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      label={label}
      language="json"
      wrap
    />
  );
}

function AuthorizationPrompt({
  part,
}: {
  readonly part: EveAuthorizationPart;
}) {
  const isAuthorized =
    part.state === "completed" && part.outcome === "authorized";
  const isCompleted = part.state === "completed";
  const Icon = isAuthorized
    ? CheckCircleIcon
    : isCompleted
      ? XCircleIcon
      : KeyRoundIcon;
  const instructions = part.authorization?.instructions;
  const shouldShowInstructions =
    instructions !== undefined && instructions !== part.description;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-3",
        isAuthorized
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isCompleted
            ? "border-destructive/30 bg-destructive/5"
            : "border-blue-500/30 bg-blue-500/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
            isAuthorized
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : isCompleted
                ? "bg-destructive/10 text-destructive"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-300",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-sm">{authorizationTitle(part)}</p>
          <p className="text-muted-foreground text-sm">
            {authorizationDescription(part)}
          </p>
          {shouldShowInstructions ? (
            <p className="text-muted-foreground text-sm">{instructions}</p>
          ) : null}
          {part.state === "required" && part.authorization?.userCode ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Code</span>
              <code className="rounded-md bg-background px-2 py-1 font-mono">
                {part.authorization.userCode}
              </code>
            </div>
          ) : null}
          {part.state === "required" && part.authorization?.url ? (
            <Button
              nativeButton={false}
              render={<a href={part.authorization.url} rel="noreferrer" target="_blank" />}
              size="sm"
            >
              <ExternalLinkIcon className="size-4" />
              Sign in with {part.displayName}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SandboxChart({
  output,
  toolName,
}: {
  readonly output: EveDynamicToolPart["output"];
  readonly toolName: string;
}) {
  if (toolName !== "segment_members") {
    return null;
  }

  // The tool returns the raw SVG in `chartSvg` (excluded from the model output
  // by design — see sandbox-runner.ts). Render it inline as an <img> data URI
  // so the chart shows in the chat instead of only its file path in the panel.
  const record = asRecord(output);
  const chartSvg = readString(record?.chartSvg);
  if (!chartSvg) {
    return null;
  }

  const title = readString(record?.title);
  return (
    <figure className="overflow-hidden rounded-md border border-border bg-white">
      <img
        alt={title ?? "Sandbox-generated segment chart"}
        className="block h-auto w-full"
        src={`data:image/svg+xml;utf8,${encodeURIComponent(chartSvg)}`}
      />
      {title ? (
        <figcaption className="border-t border-border bg-background px-3 py-2 text-muted-foreground text-xs">
          {title}
        </figcaption>
      ) : null}
    </figure>
  );
}

function SandboxArtifactSummary({
  output,
  toolName,
}: {
  readonly output: EveDynamicToolPart["output"];
  readonly toolName: string;
}) {
  if (toolName !== "segment_members") {
    return null;
  }

  const record = asRecord(output);
  const sandbox = asRecord(record?.sandbox);
  if (sandbox?.used === false) {
    // Surface a swallowed sandbox failure. Without this the tool returns tables
    // but no chartSvg, so the chart silently vanishes and only a server-side
    // console.error records why. Make the failure visible instead.
    const reason =
      readString(sandbox.reason) ??
      "The Eve sandbox did not produce a chart for this run.";
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <XCircleIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">
              Eve sandbox unavailable — chart not generated
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{reason}</p>
          </div>
        </div>
      </div>
    );
  }
  if (sandbox?.used !== true) {
    return null;
  }

  const filesWritten = readStringArray(sandbox.filesWritten);
  const command = readString(sandbox.command);
  const sandboxId = readString(sandbox.id);
  const stdout = readString(sandbox.stdout);

  return (
    <div className="rounded-md border border-accent-blue/30 bg-accent-blue/5 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue">
          <TerminalSquareIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-sm">Python ran in the Eve sandbox</p>
            {sandboxId ? (
              <code className="rounded-sm bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {sandboxId}
              </code>
            ) : null}
          </div>
          {command ? (
            <code className="mt-2 block truncate rounded-sm bg-background/80 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {command}
            </code>
          ) : null}
          {filesWritten.length > 0 ? (
            <div className="mt-3 grid gap-1.5">
              {filesWritten.map((path) => (
                <div
                  className="flex min-w-0 items-center gap-2 rounded-sm bg-background/65 px-2 py-1 text-xs"
                  key={path}
                >
                  <FileCodeIcon className="size-3.5 shrink-0 text-accent-blue" />
                  <span className="truncate font-mono text-muted-foreground">
                    {path}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {stdout ? (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {stdout}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function authorizationTitle(part: EveAuthorizationPart): string {
  if (part.state === "required") {
    return `Connect ${part.displayName}`;
  }
  if (part.outcome === "authorized") {
    return `${part.displayName} connected`;
  }
  return `${part.displayName} authorization ${formatAuthorizationOutcome(part.outcome)}`;
}

function authorizationDescription(part: EveAuthorizationPart): string {
  if (part.state === "required") {
    return part.description;
  }
  if (part.outcome === "authorized") {
    return `${part.displayName} connected.`;
  }
  const tail = part.reason !== undefined ? ` (${part.reason})` : "";
  return `${part.displayName} authorization ${formatAuthorizationOutcome(part.outcome)}${tail}.`;
}

function formatAuthorizationOutcome(
  outcome: NonNullable<EveAuthorizationPart["outcome"]>,
): string {
  switch (outcome) {
    case "authorized":
      return "authorized";
    case "declined":
      return "declined";
    case "failed":
      return "failed";
    case "timed-out":
      return "timed out";
  }
}

function InputRequestActions({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (
    responses: readonly AgentInputResponse[],
  ) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  if (!inputRequest) {
    return null;
  }

  const inputResponse = part.toolMetadata?.eve?.inputResponse;
  const selectedOption = inputRequest.options?.find(
    (option) => option.id === inputResponse?.optionId,
  );

  return (
    <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
      <p className="text-muted-foreground text-sm">{inputRequest.prompt}</p>
      {inputResponse ? (
        <p className="font-medium text-sm">
          Responded:{" "}
          {selectedOption?.label ??
            inputResponse.text ??
            inputResponse.optionId}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inputRequest.options?.map((option) => (
            <Button
              disabled={!canRespond}
              key={option.id}
              onClick={() => {
                void onInputResponses([
                  {
                    optionId: option.id,
                    requestId: inputRequest.requestId,
                  },
                ]);
              }}
              size="sm"
              type="button"
              variant={option.style === "danger" ? "destructive" : "default"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function partKey(part: EveMessagePart, index: number): string {
  switch (part.type) {
    case "authorization":
      return `authorization:${part.turnId}:${part.stepIndex}:${part.name}`;
    case "dynamic-tool":
      return part.toolCallId;
    default:
      return `${part.type}:${index}`;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
