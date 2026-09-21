// Deterministic numeric check (threshold 1.0): every figure in a reply must
// exist in this turn's tool outputs, modulo display format — thousands
// separators, % <-> fraction, "M" units, and rounding to the displayed
// precision. Member IDs must exist as IDs. Catches derived figures (sums,
// gaps, ratios computed in prose) and mis-rounding; it cannot tell whether a
// figure that exists is attributed to the right population — see scope.ts.

export type EvidenceCall = { readonly tool: string; readonly input?: unknown; readonly output: unknown };

export type KnownNumber = { readonly value: number; readonly call: number; readonly path: string };

export type Figure = {
  readonly figure: string;
  readonly value: number;
  readonly decimals: number;
  readonly isPercent: boolean;
  readonly sentence: string;
};

export type FigureResult = Figure & { readonly match?: KnownNumber };

export type NumberReport = {
  readonly pass: boolean;
  readonly checked: readonly FigureResult[];
  readonly misses: readonly FigureResult[];
  readonly unknownIds: readonly string[];
};

const MEMBER_ID = /CP\d{8}/g;
const RATIO_FIELD = /(pct|share|factor|rate)[^.[]*(\[\d+\])?$/i;

export function collectKnown(calls: readonly EvidenceCall[]): { numbers: KnownNumber[]; ids: Set<string> } {
  const numbers: KnownNumber[] = [];
  const ids = new Set<string>();
  const walk = (value: unknown, call: number, path: string) => {
    if (typeof value === "number") numbers.push({ value, call, path });
    else if (typeof value === "string") {
      for (const id of value.match(MEMBER_ID) ?? []) ids.add(id);
      for (const n of value.replace(/,(?=\d{3})/g, "").match(/\d+(?:\.\d+)?/g) ?? []) {
        numbers.push({ value: Number(n), call, path });
      }
    } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, call, `${path}[${i}]`));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, call, path ? `${path}.${k}` : k);
    }
  };
  calls.forEach((c, i) => walk(c.output, i, ""));
  return { numbers, ids };
}

// Figures a reader would take as data. Skips list markers, 4-digit years,
// threshold citations (">= 60"), identifiers with digits (rpk12m, CP IDs), and
// bare integers below 10 (counts like "top 5" or "2 segments" are too often
// prose to judge by string match).
export function extractFigures(text: string): Figure[] {
  const figures: Figure[] = [];
  const sentences = text
    .replace(MEMBER_ID, " ")
    .replace(/^\s*(?:#+\s*)?\d+\.\s/gm, " ")
    .replace(/(?:≥|≤|>=|<=|>|<)\s*\d+(?:\.\d+)?/g, " ")
    .split(/(?<=[.!?])\s+|\n+/);

  const pattern = /(?<![A-Za-z0-9_.,])([-−])?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(%|x|×|M\b)?(?![A-Za-z0-9])/g;
  for (const sentence of sentences) {
    for (const m of sentence.matchAll(pattern)) {
      const [raw, sign, int, frac = "", unit] = m;
      const value = Number(`${sign ? "-" : ""}${int.replace(/,/g, "")}${frac ? `.${frac}` : ""}`);
      const plainInt = !frac && !unit && !int.includes(",");
      if (plainInt && Math.abs(value) < 10) continue;
      if (plainInt && /^(19|20)\d{2}$/.test(int)) continue;
      figures.push({ figure: raw.trim(), value, decimals: frac.length, isPercent: unit === "%", sentence: sentence.trim() });
    }
  }
  return figures;
}

export function checkNumbers(text: string, calls: readonly EvidenceCall[]): NumberReport {
  const { numbers, ids } = collectKnown(calls);
  const tolerance = (decimals: number) => 0.5 * 10 ** -decimals + 1e-9;

  const checked = extractFigures(text).map((f): FigureResult => {
    const tol = tolerance(f.decimals);
    // A percentage only matches a ratio field; against ~40 KB of output any
    // bare "71" would otherwise be found somewhere.
    const pool = f.isPercent ? numbers.filter((k) => RATIO_FIELD.test(k.path)) : numbers;
    const scale = f.figure.endsWith("M") ? 1e6 : 1;
    // Same number (in millions when written "1.12M"), or a fraction shown as a
    // percentage (0.8788 -> 87.9).
    const match =
      pool.find((k) => Math.abs(k.value - f.value) <= tol) ??
      pool.find((k) => scale > 1 && Math.abs(k.value - f.value * scale) <= tol * scale) ??
      pool.find((k) => Math.abs(k.value * 100 - f.value) <= tol);
    return match ? { ...f, match } : f;
  });
  const unknownIds = [...new Set(text.match(MEMBER_ID) ?? [])].filter((id) => !ids.has(id));
  const misses = checked.filter((f) => !f.match);
  return { pass: misses.length === 0 && unknownIds.length === 0, checked, misses, unknownIds };
}
