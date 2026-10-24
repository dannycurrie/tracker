import express, { ErrorRequestHandler, Express } from 'express';
import { requireApiKey } from './auth';
import { Config, ConfigResult } from './config';
import { ApiError, sendError } from './errors';
import { LogSink, requestLogger, stdoutSink } from './logging';
import { MetricRow, MetricsStore } from './store';
import { parseWindow } from './window';

export interface AppDeps {
  config: ConfigResult;
  makeStore: (config: Config) => MetricsStore;
  log?: LogSink;
}

export function createApp({ config, makeStore, log = stdoutSink }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestLogger(log));
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  if (!config.ok) {
    console.error(`Server misconfigured: ${config.problems.join('; ')}`);
    app.use((_req, res) => {
      sendError(res, new ApiError(500, 'server_misconfigured', 'The server is not configured'));
    });
    return app;
  }

  const { timezone, apiKey } = config.config;
  const store = makeStore(config.config);

  app.get('/v1/metrics', requireApiKey(apiKey), async (req, res) => {
    const { from, to } = parseWindow(req.query);
    const metrics = await store.listMetrics({ createdBefore: to });

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      timezone,
      metrics: metrics.map(toMetricResponse),
    });
  });

  app.use((_req, res) => {
    sendError(res, new ApiError(404, 'not_found', 'Not found'));
  });

  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ApiError) {
      sendError(res, err);
      return;
    }
    console.error(err);
    sendError(res, new ApiError(500, 'internal_error', 'Something went wrong'));
  };
  app.use(handleError);

  return app;
}

function toMetricResponse(metric: MetricRow) {
  return {
    id: metric.id,
    name: metric.name,
    type: metric.type,
    timeframe: metric.timeframe,
    source: metric.source,
    unit: metric.type === 'timed' ? 'minutes' : null,
    periods: [],
  };
}
