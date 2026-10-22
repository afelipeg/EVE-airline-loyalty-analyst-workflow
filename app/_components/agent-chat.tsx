"use client";

import { useEveAgent } from "eve/react";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import {
  AlertCircleIcon,
  ArrowUpIcon,
  BotIcon,
  CalendarClockIcon,
  Layers3Icon,
  LogOutIcon,
  MessageSquareIcon,
  PanelRightIcon,
  PlaneIcon,
  PlayIcon,
  SparklesIcon,
  TerminalSquareIcon,
  WorkflowIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { AgentMessage } from "./agent-message";
import { JevPanel, useJevReports } from "./jev-panel";
import { MetricsPanel, snapshot } from "./metrics-panel";
import { RunTimeline, type StreamEvent } from "./run-timeline";

const AGENT_NAME = "Loyalty Analyst";
const MODEL_LABEL = "claude-sonnet-5 · AI Gateway";

const suggestions = [
  "Which Oro & Platino members on MEX–JFK are at churn risk, and which offer recovers the most RASK per peso?",
  "How much RASK is at risk from high-value members who haven't flown in 90+ days — and the reactivation plan?",
  "Weekly loyalty report: RASK-at-risk, load-factor by hub, and the 3 highest-ROI retention offers.",
];

const stackMoments = [
  { label: "Eve", value: "filesystem agent", icon: Layers3Icon },
  { label: "AI Gateway", value: "model routing", icon: SparklesIcon },
  { label: "Sandbox", value: "isolated Python", icon: TerminalSquareIcon },
  { label: "Subagents", value: "5 specialist analysts", icon: BotIcon },
  { label: "Workflow", value: "durable sessions", icon: WorkflowIcon },
  { label: "Vercel Connect", value: "Slack bot auth", icon: MessageSquareIcon },
];

type AgentStatus = ReturnType<typeof useEveAgent>["status"];
type InspectorTab = "jev" | "run" | "metrics";

export function AgentChat({ userEmail }: { readonly userEmail: string }) {
  const agent = useEveAgent();
  const isMobile = useIsMobile();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
  const events = agent.events as readonly StreamEvent[];
  const jev = useJevReports(events, agent.status === "ready");
  // Docked beside the chat on desktop (open by default); a sheet on phones
  // (closed by default, so the chat stays visible).
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorSheetOpen, setInspectorSheetOpen] = useState(false);
  const showInspector = isMobile ? inspectorSheetOpen : inspectorOpen;
  const toggleInspector = () => (isMobile ? setInspectorSheetOpen : setInspectorOpen)((open) => !open);
  const [tab, setTab] = useState<InspectorTab>("jev");

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || isBusy) return;
    await agent.send({ message });
  };

  const sendSuggestion = async (text: string) => {
    if (isBusy) return;
    await agent.send({
      message: text,
      clientContext: {
        demo: "Loyalty Analyst Eve Agent Stack walkthrough",
        currentWeek: snapshot.currentWeek,
        previousWeek: snapshot.previousWeek,
      },
    });
  };

  const inspector = (
    <Inspector
      events={events}
      isBusy={isBusy}
      jev={jev}
      onTabChange={setTab}
      tab={tab}
    />
  );

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar
        isBusy={isBusy}
        onSuggestion={sendSuggestion}
        status={agent.status}
        userEmail={userEmail}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-1 data-vertical:h-4 data-vertical:self-center" />
          <h1 className="min-w-0 truncate text-sm font-semibold">Live eve session</h1>
          <Badge variant="outline" size="sm" className="hidden md:inline-flex">
            {MODEL_LABEL}
          </Badge>
          <div className="ms-auto flex items-center gap-2">
            <StatusBadge status={agent.status} />
            <Button
              aria-label={showInspector ? "Hide inspector" : "Show inspector"}
              aria-pressed={showInspector}
              onClick={toggleInspector}
              size="icon-sm"
              variant="ghost"
            >
              <PanelRightIcon />
            </Button>
          </div>
        </header>

        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel minSize="40">
            <div className="flex h-full min-h-0 flex-col">
              {agent.error ? (
                <Alert variant="destructive" className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-3xl">
                  <AlertCircleIcon />
                  <AlertTitle>Request failed</AlertTitle>
                  <AlertDescription>{agent.error.message}</AlertDescription>
                </Alert>
              ) : null}

              {isEmpty ? (
                <ThreadStart isBusy={isBusy} onSuggestion={sendSuggestion} />
              ) : (
                <MessageScrollerProvider autoScroll>
                  <MessageScroller className="min-h-0 flex-1">
                    <MessageScrollerViewport>
                      <MessageScrollerContent
                        aria-busy={isBusy}
                        className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6"
                      >
                        {agent.data.messages.map((message, index) => (
                          <MessageScrollerItem className="[content-visibility:visible]" key={message.id} messageId={message.id}>
                            <AgentMessage
                              canRespond={!isBusy}
                              isStreaming={
                                agent.status === "streaming" &&
                                index === agent.data.messages.length - 1
                              }
                              message={message}
                              onInputResponses={(inputResponses) =>
                                agent.send({ inputResponses })
                              }
                            />
                          </MessageScrollerItem>
                        ))}
                        {agent.status === "submitted" ? (
                          <MessageScrollerItem className="[content-visibility:visible]">
                            <Marker className="ps-10">
                              <MarkerIcon>
                                <Spinner />
                              </MarkerIcon>
                              <MarkerContent className="shimmer">{AGENT_NAME} is working</MarkerContent>
                            </Marker>
                          </MessageScrollerItem>
                        ) : null}
                      </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton
                      className="bottom-4 rounded-full shadow-sm"
                      size="icon-sm"
                      variant="outline"
                    />
                  </MessageScroller>
                </MessageScrollerProvider>
              )}

              <Composer isBusy={isBusy} onSend={send} onStop={agent.stop} />
            </div>
          </ResizablePanel>
          {inspectorOpen && !isMobile ? (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize="34" minSize="24" maxSize="50">
                {inspector}
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </SidebarInset>

      {isMobile ? (
        <Sheet open={inspectorSheetOpen} onOpenChange={setInspectorSheetOpen}>
          <SheetContent className="w-full p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>Inspector</SheetTitle>
            </SheetHeader>
            {inspector}
          </SheetContent>
        </Sheet>
      ) : null}
    </SidebarProvider>
  );
}

function AppSidebar({
  isBusy,
  onSuggestion,
  status,
  userEmail,
}: {
  readonly isBusy: boolean;
  readonly onSuggestion: (text: string) => void;
  readonly status: AgentStatus;
  readonly userEmail: string;
}) {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <PlaneIcon className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-start leading-tight">
                <span className="truncate text-sm font-semibold">{AGENT_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">Club Premier · Vercel eve</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Ask</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled={isBusy}
                  onClick={() => onSuggestion(suggestions[2])}
                  tooltip="Weekly report"
                >
                  <CalendarClockIcon />
                  <span>Weekly report</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {suggestions.slice(0, 2).map((suggestion) => (
                <SidebarMenuItem key={suggestion}>
                  <SidebarMenuButton
                    className="h-auto items-start py-2"
                    disabled={isBusy}
                    onClick={() => onSuggestion(suggestion)}
                    tooltip={suggestion}
                  >
                    <PlayIcon className="mt-0.5" />
                    <span className="line-clamp-3 whitespace-normal">{suggestion}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agent stack</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stackMoments.map((moment) => (
                <SidebarMenuItem key={moment.label}>
                  <SidebarMenuButton className="pointer-events-none" tooltip={moment.label}>
                    <moment.icon />
                    <span className="truncate">{moment.label}</span>
                    <span className="ms-auto truncate text-xs text-muted-foreground">{moment.value}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sign out">
              <LogOutIcon />
              <span className="grid min-w-0 flex-1 text-start leading-tight">
                <span className="truncate text-xs">{userEmail}</span>
                <span className="truncate text-xs text-muted-foreground">Sign out · {status}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThreadStart({
  isBusy,
  onSuggestion,
}: {
  readonly isBusy: boolean;
  readonly onSuggestion: (text: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Ask the Loyalty Analyst about the two-week dataset</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            It queries deterministic loyalty data, runs a sandboxed analysis step, delegates to specialist subagents
            when needed, and returns a summary framed on RASK and load factor against the fixed ASK.
          </p>
        </div>
        <Frame stacked>
          {suggestions.map((suggestion) => (
            <FramePanel className="p-0" key={suggestion}>
              <button
                className="flex w-full items-start gap-3 px-4 py-3 text-start text-sm transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
                disabled={isBusy}
                onClick={() => onSuggestion(suggestion)}
                type="button"
              >
                <PlayIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {suggestion}
              </button>
            </FramePanel>
          ))}
        </Frame>
      </div>
    </div>
  );
}

function Composer({
  isBusy,
  onSend,
  onStop,
}: {
  readonly isBusy: boolean;
  readonly onSend: (text: string) => Promise<void>;
  readonly onStop: () => void;
}) {
  const [text, setText] = useState("");

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text.trim() || isBusy) return;
    void onSend(text);
    setText("");
  };

  // Enter sends, Shift+Enter breaks the line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-2 px-4 pb-3 sm:px-6">
      <form onSubmit={submit}>
        <InputGroup>
          <InputGroupTextarea
            aria-label="Message the Loyalty Analyst"
            className="max-h-48 min-h-16"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about RASK, load factor, churn risk, or offers..."
            value={text}
          />
          <InputGroupAddon align="block-end">
            <span className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</span>
            {isBusy ? (
              <InputGroupButton aria-label="Stop generating" className="ms-auto" onClick={onStop} size="icon-sm" variant="outline">
                <span aria-hidden="true" className="size-2.5 rounded-xs bg-foreground" />
              </InputGroupButton>
            ) : (
              <InputGroupButton aria-label="Send message" className="ms-auto" disabled={!text.trim()} size="icon-sm" type="submit" variant="default">
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Synthetic dataset. The analyst produces recommendations, never sends offers.
      </p>
    </div>
  );
}

function Inspector({
  events,
  isBusy,
  jev,
  onTabChange,
  tab,
}: {
  readonly events: readonly StreamEvent[];
  readonly isBusy: boolean;
  readonly jev: ReturnType<typeof useJevReports>;
  readonly onTabChange: (tab: InspectorTab) => void;
  readonly tab: InspectorTab;
}) {
  return (
    <Tabs
      className="flex h-full min-h-0 flex-col gap-0 bg-sidebar/40"
      onValueChange={(value) => onTabChange(value as InspectorTab)}
      value={tab}
    >
      <div className="flex h-12 shrink-0 items-center border-b px-3">
        <TabsList variant="line">
          <TabsTrigger value="jev">Jev</TabsTrigger>
          <TabsTrigger value="run">
            Run
            <Badge size="xs" variant="outline" className="ms-1 tabular-nums">
              {events.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <TabsContent value="jev">
          <JevPanel entries={jev} />
        </TabsContent>
        <TabsContent value="run">
          <RunTimeline events={events} isBusy={isBusy} />
        </TabsContent>
        <TabsContent value="metrics">
          <MetricsPanel />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function StatusBadge({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  return (
    <Badge
      className="uppercase"
      size="sm"
      variant={status === "error" ? "destructive-light" : isLive ? "primary-light" : "outline"}
    >
      {isLive ? <Spinner className="size-3" /> : null}
      {status}
    </Badge>
  );
}
