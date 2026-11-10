/**
 * Who may call the bot's small HTTP API, and what it will accept.
 *
 * The API listens only on this machine, but a web page open in the browser can still send requests to it — a wildcard
 * CORS header (what it used to send) let *any* site do that, and the one write it offers replaces the Payit list. So the
 * browser is only told to allow Haus's own pages, and a body that isn't a list of Payit is refused.
 */

/** The pages the web app is served from: its public site, and the local dev server. */
const ALLOWED_ORIGINS = [
  'https://rakeeen-uxdesign.github.io',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

/** Whether a request from a page at `origin` may be answered (no Origin header = not from a browser page). */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.some((rule) => (rule instanceof RegExp ? rule.test(origin) : rule === origin));
}

/** The most Payit one list may hold. */
export const MAX_SUBSCRIPTIONS = 500;

const isText = (v) => typeof v === 'string' && v.length <= 200;
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Whether `body` is a list of Payit as the web app sends them (`Subscription` in src/domain/finance/types.ts). */
export function isSubscriptionList(body) {
  return Array.isArray(body) && body.length <= MAX_SUBSCRIPTIONS && body.every((s) =>
    s !== null && typeof s === 'object'
    && isText(s.id) && isText(s.name) && isNumber(s.cost) && isNumber(s.renewalDay)
    && isText(s.reminderTime) && isText(s.bank) && isNumber(s.intervalMonths)
    && (s.startDate === undefined || isText(s.startDate)));
}
