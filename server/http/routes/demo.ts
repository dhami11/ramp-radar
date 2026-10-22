import { Router } from 'express';
import { newDemoTransactionId, runScenario } from '../../demo/scenario';
import { log } from '../../lib/logger';
import { rateLimit } from '../middleware';

/**
 * Mock mode only. Replays the messy delivery scenario against this server's
 * own webhook endpoint over real HTTP, so it goes through signature checks.
 */
export function demoRouter({ secret, delayMs = 700 }: { secret: string; delayMs?: number }): Router {
  const router = Router();

  router.post('/api/demo/webhooks', rateLimit({ limit: 5, windowMs: 60_000 }), (req, res) => {
    const transactionId = newDemoTransactionId();
    const url = `http://127.0.0.1:${req.socket.localPort}/webhooks/onramper`;

    runScenario({ url, secret, transactionId, delayMs }).catch((error: unknown) =>
      log('error', 'demo scenario failed', { transactionId, error: String(error) }),
    );
    res.status(202).json({ transactionId });
  });

  return router;
}
