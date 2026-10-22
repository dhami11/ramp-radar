import express from 'express';
import type { OnramperClient } from '../onramper/client';
import { DeliveryLog } from '../transactions/deliveryLog';
import type { TransactionStore } from '../transactions/store';
import { errorHandler, requestContext } from './middleware';
import { checkoutRouter } from './routes/checkout';
import { demoRouter } from './routes/demo';
import { inboxRouter } from './routes/inbox';
import { quotesRouter } from './routes/quotes';
import { webhooksRouter } from './routes/webhooks';

export interface AppDeps {
  client: OnramperClient;
  store: TransactionStore;
  webhookSecret: string;
  deliveries?: DeliveryLog;
  quoteCacheMs?: number;
  demoDelayMs?: number;
}

export function createApp(deps: AppDeps): express.Express {
  const { client, store, webhookSecret: secret } = deps;
  const deliveries = deps.deliveries ?? new DeliveryLog();

  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode: client.mode });
  });

  app.use(quotesRouter({ client, cacheMs: deps.quoteCacheMs }));
  app.use(checkoutRouter({ client }));
  app.use(webhooksRouter({ store, deliveries, secret }));
  app.use(inboxRouter({ store, deliveries }));
  if (client.mode === 'mock') app.use(demoRouter({ secret, delayMs: deps.demoDelayMs }));

  app.use(errorHandler);
  return app;
}
