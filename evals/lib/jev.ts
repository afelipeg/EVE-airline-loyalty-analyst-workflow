// Minimal TypeSafe System One client for evals: plain fetch against the HTTP
// API, so measuring Jev adds no dependency to the app. The key stays in the
// eval process (TYPESAFE_API_KEY) and is never sent anywhere but TypeSafe.

export type NoulQuestion = {
  readonly type: "noul";
  readonly instructions: string;
  readonly criteria: { readonly true: string; readonly false: string };
};

export const hasJevKey = (): boolean => Boolean(process.env.TYPESAFE_API_KEY);

export async function askNouls<K extends string>(
  state: unknown,
  questions: Record<K, NoulQuestion>,
): Promise<Record<K, number>> {
  // Retry 429/5xx with backoff: a sweep of ~200 requests hit a transient 503.
  let response: Response;
  for (let attempt = 1; ; attempt++) {
    response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, model: "jev-latest", questions }),
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
  }
  if (!response.ok) throw new Error(`TypeSafe ${response.status}: ${await response.text()}`);

  const body = (await response.json()) as { answers: Record<string, { noul: number }> };
  const out = {} as Record<K, number>;
  for (const key of Object.keys(questions) as K[]) out[key] = body.answers[key].noul;
  return out;
}

// Order-preserving map with bounded concurrency, so a dataset sweep doesn't
// burst the API.
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

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
