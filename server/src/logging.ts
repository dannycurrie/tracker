import { RequestHandler } from 'express';

export interface RequestLogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  /** Periods returned, for successful metrics requests. */
  periodCount?: number;
}

export type LogSink = (entry: RequestLogEntry) => void;

export const stdoutSink: LogSink = (entry) => {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
};

/** One structured line per request. Never logs headers, query values or bodies. */
export function requestLogger(sink: LogSink): RequestHandler {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      sink({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n),
        ...(typeof res.locals.periodCount === 'number' && { periodCount: res.locals.periodCount }),
      });
    });
    next();
  };
}
