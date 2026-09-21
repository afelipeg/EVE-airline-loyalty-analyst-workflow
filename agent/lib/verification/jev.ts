// Minimal TypeSafe System One client: plain fetch against the HTTP API, no SDK
// dependency. Server-side only; TYPESAFE_API_KEY never leaves this process.

export type NoulQuestion = {
  readonly type: "noul";
  readonly instructions: string;
  readonly criteria: { readonly true: string; readonly false: string };
};

export type ChoiceQuestion<O extends string> = {
  readonly type: "choice";
  readonly instructions: string;
  readonly criteria: Record<O, string>;
};

export type ChoiceAnswer<O extends string> = {
  readonly choice: O;
  readonly probabilities: Record<O, number>;
  readonly confidence: number;
};

export const hasJevKey = (): boolean => Boolean(process.env.TYPESAFE_API_KEY);

async function ask(state: unknown, questions: Record<string, unknown>): Promise<Record<string, Record<string, unknown>>> {
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
  return ((await response.json()) as { answers: Record<string, Record<string, unknown>> }).answers;
}

export async function askNouls<K extends string>(
  state: unknown,
  questions: Record<K, NoulQuestion>,
): Promise<Record<K, number>> {
  const answers = await ask(state, questions);
  const out = {} as Record<K, number>;
  for (const key of Object.keys(questions) as K[]) out[key] = answers[key].noul as number;
  return out;
}

export async function askChoice<O extends string>(state: unknown, question: ChoiceQuestion<O>): Promise<ChoiceAnswer<O>> {
  const answers = await ask(state, { q: question });
  return answers.q as unknown as ChoiceAnswer<O>;
}

// Order-preserving map with bounded concurrency, so a sweep doesn't burst the API.
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
