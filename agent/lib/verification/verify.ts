// Composes the reply checks: deterministic numbers first, then Jev scope on the
// percentages that passed (where scope errors were seen live), then the four
// policy Nouls per paragraph (t2 showed dense multi-violation text dilutes a
// whole-reply check). Jev steps are skipped without TYPESAFE_API_KEY.
import { askNouls, hasJevKey, mapLimit } from "./jev.js";
import { checkNumbers, type EvidenceCall, type NumberReport } from "./numbers.js";
import { POLICY_CHECKS, POLICY_QUESTIONS, POLICY_THRESHOLDS, policyScores, type PolicyCheck } from "./policy.js";
import { checkScope, type ScopeResult } from "./scope.js";

const MAX_SCOPE_CHECKS = 8;

export type PolicyFlag = { readonly paragraph: string; readonly check: PolicyCheck; readonly p: number };

export type VerifyReport = {
  readonly pass: boolean;
  readonly numbers: Pick<NumberReport, "pass" | "misses" | "unknownIds"> & { readonly checkedCount: number };
  readonly scope: readonly ScopeResult[];
  readonly policy: readonly PolicyFlag[];
  readonly jev: boolean;
};

export async function verifyReply(text: string, calls: readonly EvidenceCall[]): Promise<VerifyReport> {
  const numbers = checkNumbers(text, calls);
  const jev = hasJevKey();

  const shares = numbers.checked.filter((f) => f.match && f.isPercent).slice(0, MAX_SCOPE_CHECKS);
  const scope = jev ? await mapLimit(shares, 4, (f) => checkScope(f, calls)) : [];

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40 && !p.startsWith("|"));
  const answers = jev
    ? await mapLimit(paragraphs, 4, async (p) => policyScores(await askNouls({ text: p }, POLICY_QUESTIONS)))
    : [];
  const policy = answers.flatMap((a, i) =>
    POLICY_CHECKS
      .filter((check) => a[check] >= POLICY_THRESHOLDS[check])
      .map((check) => ({ paragraph: paragraphs[i], check, p: a[check] })),
  );

  return {
    pass: numbers.pass && scope.every((s) => s.flag === null) && policy.length === 0,
    numbers: { pass: numbers.pass, misses: numbers.misses, unknownIds: numbers.unknownIds, checkedCount: numbers.checked.length },
    scope,
    policy,
    jev,
  };
}
