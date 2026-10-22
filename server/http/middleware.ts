import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { ErrorResponse } from '../../shared/api';
import { log } from '../lib/logger';
import { OnramperError } from '../onramper/client';

/** Gives every request a correlation ID (keeping the caller's, if sent) and logs it on completion. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.get('x-request-id') ?? randomUUID();
  const startedAt = performance.now();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    log('info', 'request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Math.round(performance.now() - startedAt),
    });
  });
  next();
}

/** Fixed-window limit per client IP. In memory, so it applies per process. */
export function rateLimit({ limit, windowMs }: { limit: number; windowMs: number }) {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response<ErrorResponse>, next: NextFunction) => {
    const now = Date.now();
    // Drop finished windows once the map gets large, so it can't grow without bound.
    if (windows.size > 10_000) {
      for (const [ip, window] of windows) if (window.resetAt <= now) windows.delete(ip);
    }

    const key = req.ip ?? 'unknown';
    const window = windows.get(key);
    if (!window || window.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++window.count > limit) {
      res.setHeader('Retry-After', Math.ceil((window.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests, try again shortly' });
    }
    next();
  };
}

/** Body-parser errors carry a 4xx status (malformed JSON, payload too large). */
const clientErrorStatus = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
};

export function errorHandler(error: unknown, _req: Request, res: Response<ErrorResponse>, _next: NextFunction): void {
  const requestId = res.locals.requestId as string | undefined;

  if (error instanceof OnramperError) {
    log('warn', 'upstream error', { requestId, status: error.status, error: error.message });
    res.status(502).json({ error: error.message, requestId });
    return;
  }

  const status = clientErrorStatus(error);
  if (status) {
    res.status(status).json({ error: status === 413 ? 'Request body too large' : 'Malformed request body', requestId });
    return;
  }

  log('error', 'unhandled error', { requestId, error: error instanceof Error ? error.stack : String(error) });
  res.status(500).json({ error: 'Something went wrong on our side', requestId });
}
