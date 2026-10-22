"use client";

import { Background, BackgroundVariant, ReactFlow, type Edge, type Node, type ReactFlowProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "cn";

// From the ReUI flow-3 / flow-4 canvas: React Flow paints from its own --xy-*
// variables, so mapping them onto the shadcn tokens makes the canvas follow the
// active style and dark mode. Read-only: no drag, connect or delete.
const FLOW_THEME = [
  "[--xy-background-color:transparent]",
  "[--xy-background-pattern-color:var(--border)]",
  "[--xy-edge-stroke:color-mix(in_oklab,var(--muted-foreground)_45%,transparent)]",
  "[--xy-edge-stroke-selected:var(--primary)]",
  "[--xy-edge-stroke-width:1]",
  "[--xy-edge-label-background-color:var(--card)]",
  "[--xy-edge-label-color:var(--muted-foreground)]",
  "[--xy-handle-background-color:var(--primary)]",
  "[--xy-handle-border-color:var(--card)]",
  "[--xy-controls-button-background-color:var(--card)]",
  "[--xy-controls-button-background-color-hover:var(--muted)]",
  "[--xy-controls-button-border-color:var(--border)]",
  "[--xy-controls-button-color:var(--foreground)]",
  "[--xy-controls-button-color-hover:var(--foreground)]",
  "[--xy-controls-box-shadow:none]",
  "[--xy-attribution-background-color:transparent]",
].join(" ");

export const FIT_VIEW_OPTIONS = { padding: 0.1, maxZoom: 1 };

export function FlowCanvas<N extends Node, E extends Edge>({ className, children, ...props }: ReactFlowProps<N, E> & { className?: string }) {
  return (
    <div className={cn("relative min-h-0 flex-1 bg-muted/30", FLOW_THEME, className)}>
      <ReactFlow<N, E>
        attributionPosition="bottom-center"
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        maxZoom={2}
        minZoom={0.25}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
        zoomOnDoubleClick={false}
        {...props}
      >
        <Background gap={24} size={2} variant={BackgroundVariant.Dots} />
        {children}
      </ReactFlow>
    </div>
  );
}
