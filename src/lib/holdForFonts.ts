/**
 * The page's own fonts (General Sans, Geist Mono) are `font-display: swap`: the first paint uses a stand-in and the real font
 * replaces it a moment later, so every title changes width and redraws — a visible tremor on opening, and again whenever a weight
 * that had not been used yet is asked for. While those weights load the page is held transparent (`html.fonts-pending`, see
 * global.css), so the first thing shown is already in the right letters. It never waits longer than `maxMs`: a slow font
 * network must not hold the page back, the swap just happens then, as before.
 */
const WEIGHTS = ['900 1em "General Sans"', '700 1em "General Sans"', '500 1em "General Sans"', '400 1em "General Sans"', '700 1em "Geist Mono"', '500 1em "Geist Mono"'];

export function holdForFonts(maxMs = 1200, root: HTMLElement = document.documentElement, fonts: FontFaceSet | undefined = document.fonts): void {
  if (!fonts) return;
  root.classList.add('fonts-pending');
  const release = () => root.classList.remove('fonts-pending');
  const loaded = Promise.all(WEIGHTS.map((w) => fonts.load(w).catch(() => [])));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, maxMs));
  Promise.race([loaded, timeout]).then(release, release);
}
