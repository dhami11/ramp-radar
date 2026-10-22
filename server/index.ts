import { createPrivateKey } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { loadConfig } from './config';
import { createApp } from './http/app';
import { log } from './lib/logger';
import { createLiveClient, createMockClient } from './onramper/client';
import { TransactionStore } from './transactions/store';

const config = loadConfig();

const client = config.ONRAMPER_API_KEY
  ? createLiveClient({
      apiKey: config.ONRAMPER_API_KEY,
      baseUrl: config.ONRAMPER_API_URL,
      privateKey: config.ONRAMPER_SIGNING_KEY_FILE
        ? createPrivateKey(readFileSync(config.ONRAMPER_SIGNING_KEY_FILE, 'utf8'))
        : undefined,
    })
  : createMockClient();

if (client.mode === 'live' && config.ONRAMPER_WEBHOOK_SECRET === 'dev-webhook-secret') {
  log('warn', 'using the default webhook secret with a live API key');
}

const store = new TransactionStore(config.DB_PATH);
const app = createApp({ client, store, webhookSecret: config.ONRAMPER_WEBHOOK_SECRET });

// Serve the built UI when present (npm run build); in development Vite serves it.
const webDist = resolve('dist/web');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api|\/webhooks).*/, (_req, res) => res.sendFile(resolve(webDist, 'index.html')));
}

const server = app.listen(config.PORT, () => {
  log('info', 'listening', { url: `http://localhost:${config.PORT}`, mode: client.mode });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log('info', 'shutting down', { signal });
    server.closeAllConnections();
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
}
