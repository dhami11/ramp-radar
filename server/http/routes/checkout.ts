import { createHash, randomUUID } from 'node:crypto';
import express, { Router, type Response } from 'express';
import type { CheckoutResponse, ErrorResponse } from '../../../shared/api';
import type { OnramperClient } from '../../onramper/client';
import type { CheckoutIntentBody } from '../../onramper/types';
import { rateLimit } from '../middleware';
import { checkoutRequestSchema, firstIssue } from '../schemas';

export function checkoutRouter({ client }: { client: OnramperClient }): Router {
  const router = Router();

  router.post(
    '/api/checkout',
    rateLimit({ limit: 10, windowMs: 60_000 }),
    express.json({ limit: '10kb' }),
    async (req, res: Response<CheckoutResponse | ErrorResponse>) => {
      const parsed = checkoutRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });
      const input = parsed.data;

      const intent: CheckoutIntentBody = {
        onramp: input.onramp,
        source: input.fiat,
        destination: input.crypto,
        amount: input.amount,
        type: 'buy',
        paymentMethod: input.paymentMethod,
        network: input.network,
        wallet: { address: input.walletAddress },
        // Onramper binds the session to the buyer's IP, but only ever receives its hash.
        endUserIpHash: createHash('sha256')
          .update(req.ip ?? '')
          .digest('hex'),
        platform: 'web',
        // Our order reference; Onramper echoes it on every webhook for this transaction.
        partnerContext: `rr_${randomUUID()}`,
      };

      const { session, signature } = await client.createCheckoutIntent(intent);
      // The resume token is a credential and already embedded in the redirect URL; don't hand it out separately.
      res.json({
        mode: client.mode,
        partnerContext: intent.partnerContext,
        session: { redirectUrl: session.redirectUrl, sessionId: session.sessionId },
        signature,
      });
    },
  );

  return router;
}
