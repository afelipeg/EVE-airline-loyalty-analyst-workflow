// Eval-side helpers for measuring Jev. The client itself is the runtime one in
// agent/lib/verification, so evals measure exactly what the hook runs.

export { askChoice, askNouls, hasJevKey, mapLimit, type NoulQuestion } from "#lib/verification/jev.js";

// Candidate decision thresholds logged side by side, so a threshold is chosen
// from this data rather than assumed.
export const THRESHOLDS = [0.5, 0.6, 0.7] as const;

export type Metrics = {
  readonly n: number;
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
};

// `label` true means the violation/unsupported condition holds; `p` is Jev's
// probability of yes. The threshold is a starting point to tune, not a verdict.
export function binaryMetrics(
  rows: readonly { readonly label: boolean; readonly p: number }[],
  threshold = 0.5,
): Metrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (const { label, p } of rows) {
    const predicted = p >= threshold;
    if (predicted && label) tp++;
    else if (predicted) fp++;
    else if (label) fn++;
    else tn++;
  }
  const ratio = (a: number, b: number) => (b === 0 ? 1 : Math.round((a / b) * 1000) / 1000);
  return {
    n: rows.length,
    accuracy: ratio(tp + tn, rows.length),
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
  };
}
