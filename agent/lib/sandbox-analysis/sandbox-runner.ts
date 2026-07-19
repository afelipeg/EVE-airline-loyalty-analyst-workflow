import type { SandboxSession } from "eve/sandbox";

import { buildPythonCommand, quoteShell, type SandboxPaths } from "./sandbox-paths";
import type { InputRow } from "./schema";
import type { ChartSelector, RunSegmentationOutput, SegmentationResult } from "./types";

type SandboxRunInput = {
  readonly askMillions: number;
  readonly chart: ChartSelector;
  readonly fallback: SegmentationResult;
  readonly paths: SandboxPaths;
  readonly rows: readonly InputRow[];
  readonly routes: readonly InputRow[];
  readonly sandbox: SandboxSession;
  readonly title: string;
};

export async function runSegmentationInSandbox({
  askMillions,
  chart,
  fallback,
  paths,
  rows,
  routes,
  sandbox,
  title,
}: SandboxRunInput): Promise<RunSegmentationOutput> {
  await sandbox.run({ command: `mkdir -p ${quoteShell(paths.dir)}` });
  await sandbox.writeTextFile({
    path: paths.input,
    content: JSON.stringify({ askMillions, chart, rows, routes, title }, null, 2),
  });

  const command = buildPythonCommand(sandbox.resolvePath(paths.dir));
  const commandResult = await sandbox.run({ command });
  const output = await readSandboxJson<SegmentationResult>(sandbox, paths.output, fallback);
  const reportMarkdown = await sandbox.readTextFile({ path: paths.report });

  return {
    ...output,
    ...(reportMarkdown === null ? {} : { reportMarkdown }),
    sandbox: {
      used: true,
      id: sandbox.id,
      command,
      filesWritten: paths.filesWritten,
      artifactRoot: paths.root,
      inputPath: paths.workspace.input,
      scriptPath: paths.workspace.script,
      outputPath: paths.workspace.output,
      chartPath: paths.workspace.chart,
      reportPath: paths.workspace.report,
      note: "Python executed inside the Eve sandbox and wrote segmentation artifacts under /workspace.",
      stdout: commandResult.stdout ?? "",
      stderr: commandResult.stderr ?? "",
    },
  };
}

export function withSandboxFailure(
  fallback: SegmentationResult,
  error: unknown,
): RunSegmentationOutput {
  return {
    ...fallback,
    sandbox: {
      used: false,
      reason:
        error instanceof Error ? error.message : "Sandbox execution failed before producing output.",
    },
  };
}

async function readSandboxJson<T>(
  sandbox: SandboxSession,
  path: string,
  fallback: T,
): Promise<T> {
  const text = await sandbox.readTextFile({ path });
  if (text === null) {
    throw new Error(`Sandbox did not produce ${path}.`);
  }

  return JSON.parse(text) as T;
}
