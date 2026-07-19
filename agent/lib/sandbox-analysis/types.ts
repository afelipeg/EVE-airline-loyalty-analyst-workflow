export type ChartSelector =
  | "value_churn_scatter"
  | "rask_by_segment"
  | "rpk_by_route"
  | "loadfactor_by_route";

export type SegmentCount = {
  readonly segment: string;
  readonly members: number;
  readonly raskAtRiskMxn: number;
};

export type RetentionTarget = {
  readonly memberId: string;
  readonly valueScore: number;
  readonly churnRisk: number;
  readonly raskAtRiskMxn: number;
  readonly segment: string;
};

export type SegmentationResult = {
  readonly title: string;
  readonly memberCount: number;
  readonly segments: readonly SegmentCount[];
  readonly totalRaskAtRiskMxn: number;
  readonly loadFactor: number;
  readonly topRetentionTargets: readonly RetentionTarget[];
  readonly takeaway: string;
};

export type SandboxSuccess = {
  readonly artifactRoot: string;
  readonly chartPath: string;
  readonly command: string;
  readonly filesWritten: readonly string[];
  readonly id: string;
  readonly inputPath: string;
  readonly note: string;
  readonly outputPath: string;
  readonly reportPath: string;
  readonly scriptPath: string;
  readonly stderr: string;
  readonly stdout: string;
  readonly used: true;
};

export type SandboxFailure = {
  readonly reason: string;
  readonly used: false;
};

export type RunSegmentationOutput = SegmentationResult & {
  readonly reportMarkdown?: string;
  readonly sandbox: SandboxSuccess | SandboxFailure;
};
