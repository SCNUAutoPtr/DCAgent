// ShortID display helpers. Pure and dependency-free (the frontend imports values from here).

const PREFIX = 'E-';
const MIN_DIGITS = 5;

/** 1 -> "E-00001", 941306 -> "E-941306" */
export function formatShortId(n: number): string {
  const s = String(n);
  return `${PREFIX}${s.length < MIN_DIGITS ? s.padStart(MIN_DIGITS, '0') : s}`;
}

/** "E-00001", "00001", "1" -> 1; throws on anything else. */
export function parseShortId(text: string): number {
  const m = /^(?:E-)?(\d+)$/i.exec(text.trim());
  if (!m) throw new Error(`invalid shortId: ${text}`);
  const n = Number(m[1]);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`invalid shortId: ${text}`);
  return n;
}

export const MAX_RANGE = 10_000;

/** "1-5, 8, E-00010-E-00012" -> [1,2,3,4,5,8,10,11,12]; sorted, unique, at most MAX_RANGE values. */
export function parseRangeExpr(expr: string): number[] {
  const out = new Set<number>();
  for (const part of expr.split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = /^((?:E-)?\d+)\s*-\s*((?:E-)?\d+)$/i.exec(part);
    if (m) {
      const a = parseShortId(m[1]);
      const b = parseShortId(m[2]);
      if (a > b) throw new Error(`invalid range: ${part}`);
      if (b - a + 1 + out.size > MAX_RANGE) throw new Error(`range too large (max ${MAX_RANGE})`);
      for (let i = a; i <= b; i++) out.add(i);
    } else {
      out.add(parseShortId(part));
    }
    if (out.size > MAX_RANGE) throw new Error(`range too large (max ${MAX_RANGE})`);
  }
  return [...out].sort((x, y) => x - y);
}
