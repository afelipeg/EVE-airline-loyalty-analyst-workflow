// Jev scope check, run only on figures the numeric check already found in a
// tool output: does the reply attribute the figure to the population and entity
// the tool computed it over? Motivated by a live reply that quoted a 100% share
// from a segment-filtered rollup as "100% of the whole base" (it was 23.0%).
//
// Jev does not compare scopes itself (asked that way it answered "matches"
// almost always). It only reads the claim: two Choices over the same state pick
// which population and which entity the claim names, from options built here
// out of the tool call. Code then compares those picks with the source.
import { askChoice, type ChoiceQuestion } from "./jev.js";
import type { EvidenceCall, FigureResult } from "./numbers.js";

// Act on a pick only when P >= 0.7. Probabilities, not confidence: confidence
// measures how concentrated the distribution is, not correctness.
export const SCOPE_THRESHOLD = 0.7;

export type ScopeFlag = "differs" | "unclear" | null;

export type ScopeResult = {
  readonly figure: string;
  readonly claim: string;
  readonly population?: { readonly actual: "filtered" | "whole_base"; readonly picked: string; readonly p: number };
  readonly entity?: { readonly actual: string; readonly picked: string; readonly p: number };
  readonly flag: ScopeFlag;
};

type Row = Record<string, unknown>;
const ENTITY_KEYS = ["segment", "route", "memberId", "tier"] as const;

function at(root: unknown, path: string): unknown {
  return path
    .split(/\.|\[(\d+)\]/)
    .filter(Boolean)
    .reduce<unknown>((node, key) => (node as Row | undefined)?.[key], root);
}

const entityOf = (row: unknown): string | undefined => {
  for (const key of ENTITY_KEYS) {
    const value = (row as Row | undefined)?.[key];
    if (typeof value === "string") return value;
  }
  return undefined;
};

const entityKind = (row: unknown): string =>
  ENTITY_KEYS.find((key) => typeof (row as Row | undefined)?.[key] === "string") ?? "entity";

export async function checkScope(figure: FigureResult, calls: readonly EvidenceCall[]): Promise<ScopeResult> {
  const match = figure.match!;
  const call = calls[match.call];
  const output = call.output as { rollup?: { matchedMembers?: number; totalMembers?: number; scope?: string } } | null;
  const base: ScopeResult = { figure: figure.figure, claim: figure.sentence, flag: null };

  // Entity: the row that holds the value, and its sibling rows as options.
  const rowPath = match.path.replace(/\.[^.[\]]+$/, "");
  const arrayPath = rowPath.replace(/\[\d+\]$/, "");
  const actualEntity = entityOf(at(call.output, rowPath));
  const siblings = Array.isArray(at(call.output, arrayPath))
    ? [...new Set((at(call.output, arrayPath) as unknown[]).map(entityOf).filter((e): e is string => Boolean(e)))]
    : [];

  // Population: only askable when the call was filtered to a subset.
  const matched = output?.rollup?.matchedMembers;
  const total = output?.rollup?.totalMembers;
  const filtered = match.path.startsWith("rollup.") && matched !== undefined && total !== undefined && matched < total;
  const filters = JSON.stringify(call.input ?? {});

  const questions: Record<string, ChoiceQuestion<string>> = {};
  if (filtered) {
    questions.population = {
      type: "choice",
      instructions: "Over which population does `claim` say `figure` is measured?",
      criteria: {
        filtered: output?.rollup?.scope ?? `Only the subset selected by the filters ${filters} (${matched} of ${total} members).`,
        whole_base: `The figure is presented as a share or total of all ${total} members (the whole base, program, or network), even if the claim also mentions the subset's size.`,
        unclear: "`claim` does not say which population the figure covers.",
      },
    };
  }
  if (actualEntity && siblings.length > 1) {
    questions.entity = {
      type: "choice",
      instructions: "Which entity does `claim` attribute `figure` to?",
      // Name the kind: Spanish prose like "RASK en riesgo" otherwise reads as
      // the "En Riesgo" segment.
      criteria: {
        ...Object.fromEntries(
          siblings.map((e) => [e, `The figure is about the ${entityKind(at(call.output, rowPath))} named "${e}".`]),
        ),
        unclear: "`claim` names none of these.",
      },
    };
  }
  if (Object.keys(questions).length === 0) return base;

  const state = { claim: figure.sentence, figure: figure.figure };
  const entries = Object.entries(questions);
  const answers = await Promise.all(entries.map(([, q]) => askChoice(state, q)));
  const picks = Object.fromEntries(entries.map(([id], i) => [id, answers[i]]));

  let flag: ScopeFlag = null;
  const result: { -readonly [K in keyof ScopeResult]: ScopeResult[K] } = { ...base };
  if (picks.population) {
    const p = picks.population.probabilities[picks.population.choice];
    result.population = { actual: "filtered", picked: picks.population.choice, p };
    if (p >= SCOPE_THRESHOLD && picks.population.choice === "whole_base") flag = "differs";
    else if (p >= SCOPE_THRESHOLD && picks.population.choice === "unclear") flag ??= "unclear";
  }
  if (picks.entity && actualEntity) {
    const p = picks.entity.probabilities[picks.entity.choice];
    result.entity = { actual: actualEntity, picked: picks.entity.choice, p };
    if (p >= SCOPE_THRESHOLD && picks.entity.choice !== actualEntity && picks.entity.choice !== "unclear") flag = "differs";
  }
  result.flag = flag;
  return result;
}
