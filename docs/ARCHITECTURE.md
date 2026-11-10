# Haus — Architecture

Personal life-dashboard PWA (water, focus/Pomodoro, finance — the day's rhythm taken from the
real prayer times) for a single user. React + TypeScript + Vite, Firebase (Firestore + Auth),
deployed to GitHub Pages. A companion Discord bot (`backend/`) sends reminders.

This document explains **how the code is organized and why**, so it stays this way
as it grows — whether the next change is made by Hamed, by Claude, or by any other
agent. Read this before adding a file, and see `CLAUDE.md` for the short version.

## The layers

```
src/
  app/        the shell — routing, providers, ErrorBoundary, top-level layout (Water, Focus and Finance
              are lazy routes: they load on first visit, which keeps Recharts out of the first screen)
  data/       Firestore + sign-in + device-auth. The ONLY place that talks to Firebase (`data/auth.ts` is how
              the rest of the app signs in and out — never import `firebase/auth` elsewhere).
  domain/     business rules as pure functions + types. No React, no Firestore, no DOM.
  features/   one folder per screen/capability — the React layer
  ui/         design-system primitives (Card, Button, Modal, …) — no business logic
  lib/        framework-agnostic helpers with no Haus rules baked in
  constants/  static data (the Focus week's seed, the salary in finance.json, …)
  styles/     global.css — design tokens live here (see "Design system" below)
  assets/     files the app imports and Vite fingerprints (the task-done sound; `scripts/` renders it)
```

**The dependency direction only ever points one way:**

```
app  →  features  →  ui
              ↓
           domain  ←  data
              ↑
             lib
```

- `domain/` never imports from `features/`, `ui/`, or `data/`. It's the one layer
  that's safe to read in isolation and safe to unit test without touching React.
- `data/` never imports from `features/`. Components ask `data/` for state; `data/`
  doesn't know which screen is asking.
- `features/<name>/` may import `domain/`, `data/`, `ui/`, and `lib/` — but never
  reaches into *another* feature's folder. If two features need the same thing,
  that thing belongs in `domain/`, `ui/`, or `lib/`, not borrowed from a sibling.
- `ui/` never imports `domain/` or `data/` — it only knows about props.

## Why this shape (in plain terms)

Before this refactor, everything lived in `components/` + `hooks/` grouped by *kind*
(all components together, all hooks together), and business logic — reset rollovers,
prayer-time math, deposit splitting — was written inline inside 1000+ line React
components, indistinguishable from rendering code and impossible to unit test.

Grouping by **feature** instead of by kind means opening `features/finance/` shows
everything about finance in one place. Pulling business rules into `domain/` as pure
functions means:
- they can be unit tested without rendering anything or touching Firestore
- they can't accidentally depend on render timing, refs, or effect order
- reading `domain/finance/subscriptions.ts` tells you the actual business rule
  without wading through JSX

## Rules

### 1. No business logic in components
If a computation doesn't need `useState`, a ref, or a DOM/Firestore call, it doesn't
belong inside a component or hook body. Extract it to `domain/<area>/`, write it as
a plain function, and give it a test. The component calls the function; it doesn't
recompute the rule inline. (See `domain/finance/subscriptions.ts` or
`domain/devotion/prayer.ts` for the pattern.)

### 2. Time-dependent logic takes `now` as a parameter
Never call `new Date()` inside a pure function. Take `now: Date = new Date()` as
the last parameter instead — the default preserves real behavior, and tests pass a
fixed date. Every function in `domain/` follows this.

### 3. Nothing outside `data/` imports `firebase/*`
If a feature needs Firestore-backed state, it uses `useFirebaseSync` (or a future
`data/` primitive) — never `doc()`/`onSnapshot()`/`getFirestore()` directly.

### 4. Imports use the `@/` alias, never `../../..`
`@/features/finance/useFinance`, not `../../hooks/useFinance`. This is what makes
moving a file safe: a file's own imports never break when *it* moves, only when
something *it imports* moves — and that's a greppable, mechanical fix.

### 5. One feature never reaches into another feature's folder
Cross-feature needs go through `domain/`, `ui/`, or `lib/`. If `features/water/`
needs something from `features/finance/`, that's a sign the thing should live in
`domain/` instead.

### 6. Split a file before it crosses ~300–400 lines
Pull out anything presentational and closure-free (icons, small display
components, constant tables) into `features/<name>/components/`. Pull out anything
computational into `domain/`. What's left should be mostly state wiring and JSX
composition. (`Home.tsx` and `Finance.tsx` are still catching up on this — see the
open items below.)

### 7. Name things by what they mean, not how they're stored
`focusMinutesThisWeek`, not `fmw`. `subMatchesFilter`, not `check2`. A reader
should understand a name without opening the function body.

### 8. Every pure function in `domain/` gets tests
Not exhaustive property-testing — a handful of cases that pin the real behavior
(the normal case, the boundary, the one weird edge the comments warn about). See
`domain/day.test.ts` for the shape: one `describe` per function, cases named after
what they prove.

## Where new things go

| Adding… | Goes in |
|---|---|
| A new screen/feature | `features/<name>/` — its own folder, own hook if it needs state wiring |
| A business rule (splitting, scheduling, eligibility, formatting specific to Haus) | `domain/<area>/<thing>.ts` + a test file next to it |
| A generic helper with no Haus-specific rule (date math, a fetch wrapper) | `lib/` |
| A reusable visual primitive used by 2+ features | `ui/` |
| Firestore-backed state | `data/useFirebaseSync` from inside a feature hook |
| A constant data table | `constants/` |

## Design system

Tokens (color, the aluminum textures, card and button shapes, motion, dark mode) live in
`src/styles/global.css` as CSS custom properties. `ui/` components consume those
tokens — they don't hardcode colors. When the visual design changes, it changes in `global.css` + `ui/`, and every
feature inherits it automatically instead of being edited screen by screen.

**Colour classes.** The runtime palette in `global.css` (`--ink`, `--paper`, `--paper-dark`,
`--bg`, `--sepia`, `--rust`, `--forest`, `--ink-faded`) is exposed to Tailwind through an
`@theme inline` block, so `text-ink/40`, `border-ink/10`, `bg-paper-dark`, `text-forest`…
all work and follow dark mode on their own. Add a new palette colour in both places
(the `:root` / `.dark-theme` variables, then the `@theme inline` line).

**Switchers.** `ui/Tabs.tsx` is page-level navigation (plain labels, a sliding line
under the current one); `ui/FilterSelect.tsx` narrows a list or chart (a button
that opens a short list that scrolls inside itself; `FilterMulti` in the same file keeps several
choices at once). `ui/Form.tsx`'s `SelectMenu` is the same dropdown for a form field (never a native
`<select>`), and `ui/Avatar.tsx` is a person's round photo. Don't hand-roll a boxed segmented control again.

**Tooltips.** A hover hint is `data-tip="…"` on any element — never the native `title` attribute. One
`ui/TooltipLayer.tsx`, mounted once in `App`, draws it as a dark mono chip; it tracks the pointer's position
(not hover events), so it also works on disabled buttons.

**Theme.** `lib/theme.ts` owns dark/light: `main.tsx` applies the saved choice before
the first render (so every route starts in it), and `setTheme()` switches and saves.

**Icons** come in two kinds. Hand-drawn icons (the sections, the dock's arrow, sign-in, banks
and buckets) are generated by `scripts/illustrations/` into `src/ui/sketchIcons.data.ts` and drawn
by `ui/Sketch.tsx`, with a line boil. Plain UI icons are in `src/ui/icons.tsx`, the only file that
imports from `@hugeicons/core-free-icons` (raw path data — we render the paths ourselves). Three
exported constants define their look — `ICON_STROKE_WIDTH` (2), `ICON_STROKE_LINECAP`
(`'round'`), `ICON_STROKE_LINEJOIN` (`'round'`) — a light touch
of the hand-drawn style that stays out of the way of a control, with no SVG filter (it can flash dark
when an icon is redrawn). Features import plain icons from
`@/ui/icons` as `Icon<Name>`, never straight from an icon library, so the library, the stroke and
the line ends are each a one-file answer. New plain icon → add it to `icons.tsx` first.

**Retro** is used in exactly two places, on purpose. Finance › Thndr is dressed as an amber-phosphor
terminal (the `.retro-crt` panel in `global.css`, with its own local colours — it stays a dark screen in
both themes). The Focus timer's third face (`ui/RulerTimer.tsx`) is a tick ruler in the Focus accent with
dot-matrix digits and a glow; its tick/slide logic is `domain/focus/ruler.ts`. The ruler is plain HTML
moved by one `transform` per animation frame — no filters or SVG masks, which is what keeps it smooth.

A hand-drawn SVG that isn't generated by `scripts/illustrations/` still imports these same three constants
instead of hardcoding its own numbers. Genuine exceptions, with their own hand-tuned stroke unrelated to this
system: the Pomodoro focus ring (scales with its own size), Recharts `ReferenceLine`/chart internals, the
`MonthFingerprint` ray weight (encodes a data value, not a fixed style), and `CustomCursor`'s shape outline.

## Work: projects, tasks and comments

The work side (`features/work/`, routes `/work`, `/work/tasks`, `/work/projects`, `/work/projects/:id`) is the Notion setup
Hamed ran his work from, now shared with guests project by project: **projects** (each for a client, with a status, priority, lead and date),
**tasks** (a title, status To do / Doing / Done / Dropped, priority, a date, a project, who it is for, tags, a description
and comments) and notes. Notion's sprints and the git field are left out.

- **Data.** Each project and task is its own Firestore document (`work_projects`, `work_tasks`, and a task's `comments`
  subcollection), listened to once by `WorkProvider` in `data/useWork.tsx` and read through `useWork()`. A project's
  **client** is in its own document (`work_projects_private`), so it can stay the owner's when projects are shared.
- **Rules of the work, as pure functions in `domain/work/`** (with tests): today's tasks and the other day filters, ordering,
  grouping by status, what moving a task to another column does (stamps `doneAt`), the month grid (the week starts on
  Saturday), a project's progress (finished over all, not counting dropped), grouping by client or status, and a project's
  span on the timeline. "Today" is the device's calendar day, as in Notion.
- **Screens.** Tasks as a board (cards are dragged between columns with `@dnd-kit`; touch works by pressing and holding),
  a table or a calendar; filters by day (Today follows the date by itself, or pick one), status, project and a search.
  Projects as cards (a column per client), a table grouped by status, or a timeline. The Home dock has a Tasks card
  (today's open tasks, with a tick to finish each).
- **Notes** (`/work/notes`, Hamed's alone) are pages of Markdown in `work_notes`, each optionally about a project, listed by
  recency or by project and shown on a project's page. The page (`NoteEditor`, TipTap, loaded only when a note is opened) is
  Notion-like: "/" for blocks, the usual Markdown shortcuts, a small toolbar, and every block reads in its own direction
  (`dir="auto"`) so Arabic and English can follow each other. Markdown is what is stored (the imported notes too); a
  change is saved 800ms after typing stops, and when the page or tab is left. `domain/work/notes.ts` has the list rules.
- **Importing Notion.** `node backend/scripts/import-notion.js "<export folder>"` reads a Notion Markdown & CSV export
  (`backend/src/lib/notionImport.js`, tested) and says what it found; `--write` imports it. Ids come from the export and
  anything already in Haus is left alone, so it can be run again. Notion leaves comments out of its exports, and a task's
  page text is what is left after the template's own furniture is stripped (the banner, rules).
- **Sharing with guests.** A project has `memberUids` (the guests on it) and `guestsSeeAll` (a member sees every task of it,
  or only their own). Each task carries `viewerUids` — the guests who may see it, from `viewersOf` in `domain/work/sharing.ts`
  — and `firestore.rules` lets a guest read a project they are a member of and a task that lists them, nothing else. A guest's
  queries ask for exactly that (`array-contains` their uid). A guest can add a task for themself (in a project they are on,
  or none) and change the tasks that are theirs, never a task's project, who it is for, or who may see it; they never see a
  project's client (it is in its own owner-only document). Changing a project's sharing rewrites its tasks' viewers
  (`setSharing`). A guest writes their own uid, name and photo to `guest_profiles/{uid}` when they sign in; Hamed's app joins
  these to the invitations by email, so he can pick them by name.

## The Discord bot (`backend/`)

Separate package, not part of the web build. `bot.js` only wires things together and schedules them;
the work lives in small modules: `src/features/` (`subscriptions` — the Payit reminders, honouring each plan's
billing cycle; `cleanup`; `finance`/`water`/`focus` — the Discord panels; `focusNotifications` — the focus
timer's messages; `report`), `src/lib/` (`alerts`,
Firestore and prayer-time helpers) and `src/server.js` (the small HTTP API the web app calls).
Their pure parts are tested from the root `npm run test:run`.

`backend/src/slack/` is the same control panel (hub, Water, Focus, Finance) for Slack: `/firmus` or
`/firmus water|focus|finance` (the command's name in the Slack app's settings, so it keeps its old spelling until
that is renamed there too), over Socket Mode (no public URL). `views.js` draws the Block Kit cards from the same
readers the Discord cards use (`readState`, `readFocusState`, `readFinanceSummary`…); `app.js` routes the buttons and
the amount form. Cards are ephemeral and edited in place. It starts only when `SLACK_BOT_TOKEN` (xoxb-),
`SLACK_APP_TOKEN` (xapp-) are in `backend/.env`; only `SLACK_OWNER_USER_ID` may use it, and only in the channel
`SLACK_CONTROL_CHANNEL_ID` (matched by id — Slack hides a private channel's name). A card deletes itself a minute
after the last press, except Focus.

**Late glass.** Water closes at Maghrib (the day is archived, the counter zeroed). A glass drunk after that is added to
the day that just closed: `domain/water.ts` (`archivedDayKey`, `applyLateGlass`) on the web, ported to
`backend/src/lib/lateGlass.js` for both bots. If the Maghrib reset hasn't run yet it goes on the live counter, because
the reset overwrites that day's history entry.

`backend/src/features/report/` builds the **daily report**
(at Maghrib — `bot.js` checks each minute against today's Maghrib from the prayer API): `collect.js` reads the dashboard values from Firestore, `data.js` turns them into
the report (pure — the finance, focus and subscription rules are ported by hand from `src/domain/`, and
tested from the root with `npm run test:run`), `render.js` draws the PDF, `send.js` posts it. Try it without
sending anything: `npm run report:preview` (writes a PDF to the temp folder); `npm run report:send` sends it
now. Anything in `data.js` that mirrors `src/domain/` must be changed in both places — except the salary, which both
read from `src/constants/finance.json`.

**Running it.** `backend/` is started by the launchd agent `~/Library/LaunchAgents/com.haus.bot.plist` (`start.sh`,
kept alive, log in `~/Library/Logs/haus-bot.log`). Its plist holds the absolute path of `backend/start.sh`, so if the
project folder is moved or renamed, edit the path there and run `launchctl bootout` / `bootstrap` again. Restart it with
`launchctl kickstart -k gui/$(id -u)/com.haus.bot`;
don't run `start.sh` by hand while the agent is loaded — that starts a second copy. The community Discord bot (a separate
project) has its own agent, `com.bommy.bot`; both log in with the same Discord application.

## Access: the owner and invited guests

Signing in with Google is not enough to get in. There are two kinds of people:

- **The owner** (Hamed): one fixed Firebase uid (`constants/owner.ts`; `firestore.rules` names the same one).
- **A guest**: a Google account the owner invited — a document in `members/{lower-case email}` with `active: true`.
  The owner manages them from the header menu ("Guests", `features/home/components/GuestsModal.tsx`; data side in
  `data/useMembers.ts`). Anyone else who signs in sees "Not invited" (`features/auth/NoAccess.tsx`) and nothing is loaded.

`domain/access.ts` decides the role (`roleOf`) and the name a guest is greeted by (`firstNameOf`, the first word of their
Google name). `AuthProvider` resolves it, then sets the **data scope** (`data/dataScope.ts`) before any screen that reads
values is shown, and shows a fresh tree whenever the person changes. The scope decides where `useFirebaseSync` keeps a
value: the owner's stay in `dashboard/{key}` (exactly as before, so the bots still read them); a guest's go in
`users/{uid}/data/{key}`, with their localStorage keys prefixed. A guest sees Water, Focus and Time — no Finance (the route
isn't even registered for them). Screens receive who is looking as a `viewer` prop (a feature never imports another).

**Fingerprint for the owner, a code for a guest.** Touch ID is Hamed's alone. An invited guest signs in with Google and
sees `GuestCodeGate`: it asks (`guest_requests/{uid}`), Hamed's screen (`GuestCodeBanner`, owner only) answers with a
one-time 8-digit code in `guest_codes/{uid}` — a document only he can read — shown for five minutes, and he tells it to the
guest. The guest types it; `firestore.rules` itself compares it to the stored code (a rule can read a document the
requester can't) and only then lets the guest create `guest_approvals/{uid}`. From then on every guest rule requires that
approval (`isApprovedGuest`), valid 30 days (`GUEST_APPROVAL_DAYS` in `domain/access.ts` and the rules — change both).
Switching a guest off in the Guests list cuts them off at once. `AuthProvider` exposes this as `approved`.

**`firestore.rules` is the real lock; the screens only follow it.** Everything is denied unless a rule allows it: the owner
reads and writes `dashboard/*`, the work collections, his fingerprint record and device code; an approved guest only their own
`users/{uid}/data/*`; only the owner reads or writes `members`. Publish with `node backend/scripts/deploy-rules.js` (the bot's service account; the ruleset it
replaces is remembered, `--rollback` puts it back). The rules have no automated tests yet — the service account may not run
Google's rules evaluator, and the local emulator needs Java; add them with the next collections.

## The website holds no secrets

Everything compiled into the site is public, so nothing secret is a `VITE_` variable. When the app needs
Discord to say something, it writes an event to Firestore and the bot posts it: the focus timer writes
`focus_notification` (`usePomodoro`), and `backend/src/features/focusNotifications.js` turns it into a message
through the webhook in `backend/.env`. The one key the site does still carry is the gold API's
(`VITE_GOLD_API_KEY`), because the app is what fetches gold prices — see below.

## Gold prices

The web app is the only thing that calls the gold API. `app/GoldPriceRefresher.tsx` (mounted once, next to
`DailyResetManager`) checks whether a Fajr or Maghrib has passed since the last fetch
(`domain/finance/goldRefresh.ts`) and, if so, fetches once and stores the prices in Firestore (`gold_prices`).
Everything else only reads that document — the Finance screens through `useGoldPrices`, the Discord bot
straight from Firestore — so the prices stay put between refreshes and the API sees two calls a day. A refresh
missed because the app was closed happens the next time it is open.

## Testing & commands

```
npm run dev        # local dev server
npm run build       # production build — esbuild, so it catches resolution errors
                     # but not type errors
npm run typecheck    # tsc --noEmit (strict + no unused locals/params) — keep it at 0
npm test             # vitest, watch mode
npm run test:run     # vitest, single run — use this one in CI / before committing
```

There is no React-rendering test setup yet (no Testing Library). `domain/` tests run
in plain Node (`environment: 'node'` in `vite.config.ts`) because none of that code
touches the DOM. Add `@testing-library/react` + a `jsdom` environment only when a
`features/` hook or component genuinely needs a rendered test — don't add it
speculatively.

## Open items (known, deliberately deferred)

- `Home.tsx` (~970 lines) still mixes state wiring, modals and JSX composition in one file. Its
  presentational, closure-free pieces are split out (`features/home/components/`); splitting the stateful
  parts further is higher-risk and is best done alongside a visual change rather than as a separate pass.
  (Finance is already split into one component per tab.)

## Tasks in several projects, dates and drafts

- A task has `projectIds` (every project it is in) and `projectId` (always the first — what older code and the bot read).
  `normalizeTask` fills one from the other. Who may see it (`viewerUids`) is the **union** of what each of its projects
  allows (`viewersOf` in `domain/work/sharing.ts`), recomputed when its projects, its assignee or a project's sharing
  change. A guest only ever learns the names of projects they are a member of (they can read no other), so a task shared
  into a second project does not reveal that project's name to them.
- **Guests cannot put a task in several projects**: `firestore.rules` lets a guest write `projectId` but not `projectIds`,
  so `useWork.addTask` leaves `projectIds` off a guest's write. Likewise `endDate` is only sent when set.
- A task or project has a start (`date`) and an end (`endDate`). A task covers every day from start to end, so it shows
  under "Today" while today is inside it and is overdue only after its last day (`coversDay`, `lastDayOf`, `isOverdue`).
- `lib/draftMemory.ts` keeps an unsaved **new** task or project in localStorage for ten minutes, and the form offers it
  again ("Picked up where you left off" / "Start over").
- Dropdowns (`SelectMenu`, `SelectMulti` in `ui/Form.tsx`) are found by typing in the field itself; a long
  `FilterSelect`/`FilterMulti` gets a search box.

## One sound, no scrollbars, cards that ease

- **The sound.** The only one in the system is the chime a finished task makes: `lib/sound.ts` plays
  `assets/sounds/task-done.wav`, called from `useWork.updateTask` when a task's status becomes `done` (so the tick, a drag
  to Done, the editor and the Home card all make it). The file is rendered by `scripts/sound/build_task_done.py` (pure
  Python; its header explains each choice and every number can be tuned). `localStorage.haus_sound = 'off'` silences it.
  (The focus timer has no sounds; they were tried and removed.)
- **No scrollbars.** `global.css` hides every scrollbar (`*`); everything still scrolls. Don't add a custom one.
- **Cards ease to their height.** Content that grows or shrinks (a filtered list, a column gaining a card) is wrapped in
  `ui/AutoHeight`, which animates the height on the system's spring instead of jumping. It clips, so popovers go outside it.

## A task for several people, and whose tasks to show

- A task has `assigneeUids`: everyone it is for, Hamed as `OWNER_KEY` ('owner') and guests by uid. `assigneeUid`/`assignee`
  stay as the first of them (older code and the bot read those). `normalizeTask` fills the list for older tasks (their guest,
  or Hamed). A guest the task is for sees it (`viewersOf`) and may change it (`isMineAsGuest`; `firestore.rules` checks
  `assigneeUids` too). Only Hamed writes `assigneeUids`; a guest's own task is just for them.
- **Whose tasks to show** — "Mine" or "Everyone" (what the viewer can see) — is one remembered choice, `data/useWhoseTasks`,
  used by the Tasks home, All tasks and the Tasks card on Home (and its "due today" count), through `filterTasks({ forMe })`.

## Speed, and what was removed

- **Loading.** The big libraries (Firebase, framer-motion, React) are separate files (`vite.config.ts` `manualChunks`), so they
  are cached between deploys and parsed side by side; Charts (Recharts) and the notes editor (TipTap) load only when their
  page opens. The two fonts the system uses (General Sans, Geist Mono) are `<link>`ed in `index.html` — not `@import`ed from the
  CSS, which made the page wait for the CSS before it even asked for them. Fonts nothing used (Inter, DM Sans, Playfair,
  Scheherazade) and Firebase Analytics are gone.
- **Rendering.** Home's clock state (`now`) changes only when the minute turns or five seconds pass, not every second:
  Home is large, and a render a second was felt. A popover that closes on an outside click or Escape uses `ui/useDismiss`.
- **Shared, not copied.** Finishing or moving a task goes through `useWork().setTaskStatus` / `toggleTaskDone` (permission
  check and stamps in one place); a row of choice buttons is `ui/Form`'s `ChooseRow`.

## Home is a wiring file

`features/home/Home.tsx` (about 270 lines) only connects the pieces; each has its own file beside it. **Logic**: `useGreeting`
(the header phrase and its fade), `useDailySnapshot` (daily history + the one-line journal), `useCardSelection` (which card the big
card shows, and the 30 s manual hold), `useZenMode`, `useDockTouch` (hover/press shared by the dock and the big card), `useAvatar`,
`useNow`. The pure parts — the week's pattern, the journal line — are `domain/dailyJournal.ts`, tested. **Parts**: `HomeHeader`,
`Dock` (+ `dockCards.ts`, the data for its cards), `BigCard`, `FingerprintModal`; the card bodies stay in `components/`.
