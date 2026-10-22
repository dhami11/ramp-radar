import express, { Router, type Response } from 'express';
import type { ErrorResponse } from '../../../shared/api';
import { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER, webhookEventSchema } from '../../onramper/webhook';
import type { DeliveryLog } from '../../transactions/deliveryLog';
import type { RecordOutcome, TransactionStore } from '../../transactions/store';
import { firstIssue } from '../schemas';

export function webhooksRouter(deps: { store: TransactionStore; deliveries: DeliveryLog; secret: string }): Router {
  const { store, deliveries, secret } = deps;
  const router = Router();

  // Raw body on purpose: the HMAC covers the exact bytes Onramper sent, so nothing may parse them first.
  router.post(
    '/webhooks/onramper',
    express.raw({ type: '*/*', limit: '64kb' }),
    (req, res: Response<{ outcome: RecordOutcome } | ErrorResponse>) => {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      if (!verifyWebhookSignature(rawBody, req.get(WEBHOOK_SIGNATURE_HEADER), secret)) {
        deliveries.add({ result: 'rejected', httpStatus: 401 });
        return res.status(401).json({ error: 'Signature does not match' });
      }

      let json: unknown;
      try {
        json = JSON.parse(rawBody.toString('utf8'));
      } catch {
        deliveries.add({ result: 'invalid', httpStatus: 400 });
        return res.status(400).json({ error: 'Body is not valid JSON' });
      }

      const parsed = webhookEventSchema.safeParse(json);
      if (!parsed.success) {
        deliveries.add({ result: 'invalid', httpStatus: 400 });
        return res.status(400).json({ error: firstIssue(parsed.error) });
      }

      const event = parsed.data;
      const outcome = store.record(event);
      deliveries.add({ result: outcome, httpStatus: 200, transactionId: event.transactionId, status: event.status });

      // 200 for duplicates and stale events too: they were handled, so the sender should stop retrying.
      res.json({ outcome });
    },
  );

  return router;
}
