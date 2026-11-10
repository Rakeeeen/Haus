/** Whether the text is Arabic (or another right-to-left script) — the first letter that is a letter decides, as `dir="auto"` does. */
export function isRtlText(text: string): boolean {
  const letter = text.match(/\p{L}/u)?.[0];
  return letter !== undefined && /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(letter);
}
