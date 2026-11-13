# Haus

(The system's name is Haus — a house, the one place everything of Hamed's is run from. The site is served by GitHub Pages at `https://haus.rakeeeen.com/` (a custom domain, so it is served from the root — `base` in `vite.config.ts` must stay `'/'` and `public/CNAME` must keep the domain; Pages' Source must be "GitHub Actions", otherwise it serves the raw source and the page is blank); the Firebase project is still `rakeeen-home` — a Firebase project's ID can't be renamed.)

Personal life-dashboard for Hamed — water, focus/Pomodoro and finance, with the day's
rhythm taken from the real prayer times. React + TypeScript + Vite + Firebase (Firestore + Auth), deployed
to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`. A companion
Discord bot lives in `backend/` (Payit reminders, the Discord panels and the daily PDF
report — not deployed by the same workflow, run separately).

**Read `docs/ARCHITECTURE.md` before adding or moving a file.** This file is the
short version; that one explains the layers and the reasoning.

## Commands

```
npm run dev         # local dev server (http://localhost:5173/)
npm run build         # production build — esbuild-based; this is the real smoke test
npm run test:run       # vitest, single run
npm run typecheck       # tsc --noEmit — strict, no unused locals/params; must stay at 0 errors
```

`npm run build` (esbuild) catches resolution errors but not type errors, so run
`typecheck` as well before calling something done. The project has no eslint setup.

## The five rules that matter most

1. **No business logic inside components.** If it doesn't need `useState`/a
   ref/a DOM or Firestore call, it's a pure function — put it in `domain/<area>/`
   with a test, and call it from the component.
2. **Time-dependent functions take `now: Date = new Date()`** as their last
   param — never call `new Date()` inside pure logic. This is what makes them
   testable without mocking the clock.
3. **Only `src/data/` imports `firebase/*`.** Everything else uses
   `useFirebaseSync` (or asks for a `data/` primitive).
4. **Imports use the `@/` alias** (`@/features/finance/useFinance`), never
   `../../..`. Never import across feature folders — shared logic goes in
   `domain/`, `ui/`, or `lib/`.
5. **Before changing behavior or UI, know what "unchanged" looks like.** Most
   refactors in this codebase are meant to be invisible — run the build, run the
   tests, and actually load the page (see "Local verification" below) before
   calling something done.

## Local verification (do this before saying a change is finished)

1. `npm run build` — must be clean.
2. `npm run test:run` — must pass.
3. Load the app locally and look at the page(s) you touched. Auth is behind
   Google sign-in; for local UI checks without a real login, `useAuth.tsx` has
   historically been temporarily patched with a `localStorage`-gated dev bypass
   (`__dev_skip_auth`) — add it, verify, then **remove it before committing**.
   Don't leave it in.

## Things that look like bugs but are load-bearing

- `getLogicalDate()` (`domain/day.ts`) rolls the "day" at 04:00, not midnight —
  water and the daily snapshot use this. Focus sessions use `getPomoLogicalDate()`
  instead, which is the real calendar day (no rollback).
- `useFirebaseSync`'s `setValue` is `useCallback`-memoized on purpose — an
  earlier version recreated it every render, which made a consumer's `useEffect`
  re-run constantly and contributed to a Firestore client crash
  (`INTERNAL ASSERTION FAILED`). Don't remove the memoization.
- `src/data/firebase.ts` forces `experimentalForceLongPolling` — that's the actual
  fix for the crash above. Don't revert it "to try WebSockets".
- `useFirebaseSync` opens **one** Firestore listener per document (`data/sharedDoc.ts`, which also shares lists via `watchQuery`), however
  many components use the value, and keeps it 10 minutes after the last one leaves. Every listener is a billed read when it opens (and, for a guest, the rules' `get()`s
  too); the free plan allows 50,000 reads a day. Don't call `onSnapshot` for a `dashboard/{key}` value yourself.
- Hamed's tasks, projects, project clients and notes are **read by their changes only** (`data/deltaSync.ts`): a new session reads what
  changed since the newest `updatedAt` the device holds, not every document. So **every write to those collections must stamp
  `updatedAt`**, and a deletion leaves a marker (`markDeleted`, `<collection>_deleted/{id}`, allowed by firestore.rules). A
  write that skips either is seen only at the weekly full read. The bot reads tasks the same way (`watchChangesSince`). The Firestore
  cache is never trimmed (`CACHE_SIZE_UNLIMITED`) because this relies on it.
- A write of what a `useFirebaseSync` value already holds is skipped (once Firestore has shown the document): each write is a billed
  read for every other open screen. To see where reads go, type `hausReads()` in the browser console (`data/readMeter.ts`; set
  `localStorage.hausMeter = '1'` and reload to also count every document the server sends); the bot logs its own every hour (`📊`).
- To measure reads or try a rules change without spending real reads: the local emulator (`npx firebase emulators:start --only firestore
  --project demo-haus`, Java from Homebrew: `JAVA_HOME=/opt/homebrew/opt/openjdk`). `npm run test:rules` runs the rules tests there.
- The Pomodoro checkpoint is written once a minute, not every few seconds: it carries `at` (when its numbers were true) and every
  reader (the tab, the Discord bot — `backend/src/lib/timer.js`) carries a running timer forward with `advanceTimer`. Writes are
  limited too (20,000 a day); don't shorten the heartbeat.
- The hand-drawn icons' "line boil" has **no CSS animation per icon**: `ui/boilClock.ts` is one timer that sets `data-boil-a/b/c`
  on `<html>`, and the CSS shows the matching redraw of every icon. Without a clock (reduced motion, hidden tab, `paused`) each
  icon shows its first redraw, still. The clocks' second hands are redrawn at most 12 times a second (the minute and hour hands only
  once they have moved a quarter of a degree). The stopwatch hand, the coin and the masked-value spinners stay smooth: stepping them
  measured no difference and looked choppy.
- The page's texture is `body::before` (fixed layer), not the body's `background-attachment: fixed`, and `.text-silver` has its
  own layer (`will-change: transform`): that keeps scrolling and the icons' redraws from repainting the whole page.

## Icon system

Two kinds of icons, on purpose:

- **Hand-drawn icons** (the four sections, the dock's arrow, sign-in's lock and fingerprint,
  Finance's banks and buckets, Focus's hourglass face) are drawn in Anthropic's spirit: a thick ink line with a hand's
  tremor over a flat paper shape set a little off it, and a "line boil" (three redraws flicked
  through four times a second). They're generated: edit `scripts/illustrations/shapes.py`, run
  `python3 scripts/illustrations/build.py`, which writes `src/ui/sketchIcons.data.ts`. Render them
  with `ui/Sketch.tsx` (`Boil`, `SketchSvg`). Paper is `--icon-paper`, ink is `currentColor`.
- **Plain UI icons** (play, pause, plus, log out, sun/moon…) live in `src/ui/icons.tsx`, the
  **only** file allowed to import from `@hugeicons/core-free-icons`. They get a light touch of
  the same style, kept light because they're controls: round ends and joins, and no SVG filter (it
  can flash dark when the icon is redrawn). Three constants are the whole system:
  `ICON_STROKE_WIDTH` (2), `ICON_STROKE_LINECAP` (`'round'`), `ICON_STROKE_LINEJOIN` (`'round'`).
  Features import them from `@/ui/icons` (`Icon<Name>`), never from an icon library directly.
  New plain icon → add it to `icons.tsx` first.

A hand-drawn SVG that isn't generated still **imports these same three constants** instead of
hardcoding its own numbers. Genuine exceptions with their own hand-tuned stroke: the Pomodoro
focus ring (scales with its own size), Recharts chart internals, the `MonthFingerprint` ray
weight (encodes a data value), and `CustomCursor`'s shape outline.

## Don't

- Don't add a new top-level folder under `src/` without updating
  `docs/ARCHITECTURE.md`.
- Don't import an icon from any icon library directly in a feature file —
  add it to `src/ui/icons.tsx` (plain) or `scripts/illustrations` (hand-drawn).
- Don't hardcode `strokeLinecap`/`strokeLinejoin`/a stroke-width number on any
  hand-drawn icon-like SVG — import `ICON_STROKE_LINECAP` /
  `ICON_STROKE_LINEJOIN` / `ICON_STROKE_WIDTH` from `@/ui/icons` instead.
- Don't put a Firestore call inside a `features/` component — go through
  `useFirebaseSync`.
- Don't reach into another feature's folder (`features/water/` importing from
  `features/finance/`) — promote the shared thing to `domain/`, `ui/`, or `lib/`.
- Don't hand-roll a boxed tab/segmented control or a day/month/year button group —
  use `ui/Tabs` (navigation) or `ui/FilterSelect` (filtering a list or chart).
- Don't use the browser's native `title="…"` for a hover hint — put `data-tip="…"` on the element
  (`ui/TooltipLayer.tsx` draws it in the app's own style); an icon-only button also needs an `aria-label`.
- Don't put a secret in a `VITE_` variable: it is compiled into the website's public JavaScript, whatever
  GitHub Secrets does for the repo. Anything that must stay secret (a webhook, a token) is used by the bot —
  the app writes an event to Firestore and the bot acts on it (see the focus timer's Discord messages).
- Don't commit with a dev-auth bypass still active, or with `.env.local` /
  secrets in the diff.
