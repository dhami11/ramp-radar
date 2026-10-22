import { z } from 'zod';

const schema = z.object({
  ONRAMPER_API_KEY: z.string().trim().optional(),
  ONRAMPER_API_URL: z.url().default('https://api-stg.onramper.com'),
  ONRAMPER_SIGNING_KEY_FILE: z.string().optional(),
  ONRAMPER_WEBHOOK_SECRET: z.string().min(8).default('dev-webhook-secret'),
  PORT: z.coerce.number().int().positive().default(8787),
  DB_PATH: z.string().default('data/ramp-radar.db'),
});

export type Config = z.infer<typeof schema> & { mode: 'live' | 'mock' };

/** Reads and validates the environment once at startup; empty values count as unset. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = schema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return { ...result.data, mode: result.data.ONRAMPER_API_KEY ? 'live' : 'mock' };
}
