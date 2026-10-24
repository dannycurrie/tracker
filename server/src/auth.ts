import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { ApiError, sendError } from './errors';

export function requireApiKey(apiKey: string): RequestHandler {
  const expected = digest(apiKey);

  return (req, res, next) => {
    const match = req.get('authorization')?.match(/^Bearer\s+(\S+)\s*$/i);
    // Compare fixed-length digests so neither the key nor its length leaks via timing.
    if (!match || !timingSafeEqual(digest(match[1]), expected)) {
      sendError(res, new ApiError(401, 'unauthorized', 'Missing or invalid API key'));
      return;
    }
    next();
  };
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
