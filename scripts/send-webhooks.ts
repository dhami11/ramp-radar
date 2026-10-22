// Replays a messy webhook sequence against a running server:
// normal progress, a redelivery, a late out-of-order event, and a forged request.
import { runScenario } from '../server/demo/scenario';

const url = process.env.WEBHOOK_URL ?? `http://localhost:${process.env.PORT ?? 8787}/webhooks/onramper`;
const secret = process.env.ONRAMPER_WEBHOOK_SECRET || 'dev-webhook-secret';

console.log(`Replaying a messy delivery to ${url}\n`);
await runScenario({
  url,
  secret,
  delayMs: 400,
  onStep: ({ label, httpStatus, outcome }) => console.log(`${label.padEnd(26)} -> ${httpStatus} ${outcome}`),
});
