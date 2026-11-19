/** Rounds and formats an amount as Egyptian pounds: 1234.5 → "1,235 EGP". */
export function formatEGP(n: number): string {
  return `${Math.round(n).toLocaleString('en-EG')} EGP`;
}

/**
 * What a money field keeps of what was typed: Arabic digits (٠١٢٣٤٥٦٧٨٩, and the Persian ۰۱۲…) become 0–9, the Arabic decimal and
 * thousands marks (٫ ٬ ،) become . and ,, and anything that can't be part of a sum (letters in either script) is dropped.
 */
export function normalizeAmountText(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, '.')
    .replace(/[\u066C\u060C]/g, ',')
    .replace(/[^0-9+\-*/×÷x().,\s−–]/gi, '');
}

/**
 * An amount typed as arithmetic: "1+1" → 2, "250*3-40" → 710, "(100+50)/3" → 50, "1,200" → 1200.
 * Understands + − × ÷ * /, brackets, decimals and a leading sign. NaN when the text isn't a
 * complete sum (empty, "1+", "abc") — callers treat that like any unparsable number.
 * A small parser on purpose: the text is never handed to `eval`.
 */
export function evalAmount(text: string): number {
  const src = normalizeAmountText(text).replace(/[,\s]/g, '').replace(/[−–]/g, '-').replace(/[×x]/gi, '*').replace(/÷/g, '/');
  if (src === '') return NaN;
  let i = 0;
  const peek = () => src[i];

  const number = (): number => {
    const start = i;
    while (i < src.length && /[0-9.]/.test(src[i])) i++;
    const token = src.slice(start, i);
    return /^(\d+\.?\d*|\.\d+)$/.test(token) ? parseFloat(token) : NaN;
  };
  const factor = (): number => {
    if (peek() === '-') { i++; return -factor(); }
    if (peek() === '+') { i++; return factor(); }
    if (peek() === '(') {
      i++;
      const inner = expression();
      if (peek() !== ')') return NaN;
      i++;
      return inner;
    }
    return number();
  };
  const term = (): number => {
    let value = factor();
    while (peek() === '*' || peek() === '/') {
      const op = src[i++];
      const right = factor();
      value = op === '*' ? value * right : value / right;
    }
    return value;
  };
  function expression(): number {
    let value = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[i++];
      const right = term();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  }

  const result = expression();
  return i === src.length && Number.isFinite(result) ? Math.round(result * 1e6) / 1e6 : NaN;
}
