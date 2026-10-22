import { Router, type Response } from 'express';
import type { Delivery, ErrorResponse, InboxResponse, TransactionDetailResponse } from '../../../shared/api';
import type { DeliveryLog } from '../../transactions/deliveryLog';
import type { TransactionStore } from '../../transactions/store';

export function inboxRouter({ store, deliveries }: { store: TransactionStore; deliveries: DeliveryLog }): Router {
  const router = Router();

  router.get('/api/inbox', (_req, res: Response<InboxResponse>) => {
    res.json({ transactions: store.list(), deliveries: deliveries.list(), counts: deliveries.counts() });
  });

  // Server-sent events: one `delivery` event per webhook, as it is handled.
  router.get('/api/inbox/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');

    const send = (delivery: Delivery) => res.write(`event: delivery\ndata: ${JSON.stringify(delivery)}\n\n`);
    // Comment lines keep proxies from closing an idle connection.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
    deliveries.on('delivery', send);

    req.on('close', () => {
      clearInterval(heartbeat);
      deliveries.off('delivery', send);
    });
  });

  router.get('/api/transactions/:id', (req, res: Response<TransactionDetailResponse | ErrorResponse>) => {
    const found = store.get(req.params.id);
    if (!found) return res.status(404).json({ error: `No transaction ${req.params.id}` });
    res.json(found);
  });

  return router;
}
