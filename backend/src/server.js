import express from 'express';
import { getSubscriptions, replaceSubscriptions } from './features/subscriptions.js';
import { isAllowedOrigin, isSubscriptionList } from './lib/webApi.js';

// The small HTTP API the web app talks to: it pushes Payit edits here so reminders stay current.
// It is reachable from this machine only, and only Haus's own pages may call it (src/lib/webApi.js).

/** Starts listening; `onListening` runs once the port is open. */
export function startServer(port, onListening) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) return res.sendStatus(403);
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      // Chrome asks before letting a public page talk to a server on this machine.
      res.header('Access-Control-Allow-Private-Network', 'true');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.post('/api/subscriptions/sync', (req, res) => {
    if (!isSubscriptionList(req.body)) return res.status(400).json({ status: 'error', message: 'Expected a list of Payit' });
    replaceSubscriptions(req.body);
    console.log(`🔄 Synced & saved ${req.body.length} Payit from the app`);
    res.json({ status: 'ok', count: getSubscriptions().length });
  });

  // Only this machine: the bot is a local helper, nothing on the network needs to reach it.
  return app.listen(port, '127.0.0.1', onListening);
}
