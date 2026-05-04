import AppleHealthKit, {
  HealthKitPermissions,
  HKWorkoutQueriedSampleType,
} from 'react-native-health';
import { isLocalMode } from '../config/mode';
import { createKV } from '../utils/storage';
import { getPeriodWindow } from '../utils/periods';
import { logger } from './logger';
import { fetchUserMetrics } from './metrics';
import { insertLogEntry, deleteLogEntriesForPeriod } from './logEntries';

const storage = createKV('health-sync');

// Running workout sync
const LAST_SYNC_KEY = 'health:last_sync_at';
const RUNNING_METRIC_ID = 'fcf0a5fd-d8e1-4d82-ac15-3605984bbc10';

// Sleep session sync
const SLEEP_LAST_SYNC_KEY = 'sleep:last_sync_at';
const EARLY_WAKEUP_METRIC_ID = '1b0558fb-9594-41db-bb2e-bb0f0621b8fc';

interface HealthWorkout {
  id: string;
  distanceKm: number;
  startDate: Date;
  endDate: Date;
}

// Native getSleepSamples returns value as a string despite the TS type saying number
interface RawSleepSample {
  id: string;
  value: string;
  startDate: string;
  endDate: string;
}

interface SleepSession {
  id: string;        // UUID of the last-ending asleep sample (dedup key)
  wakeTime: Date;    // max(endDate) across asleep-type samples in group
  sessionStart: Date;
  durationMinutes: number;
}

type SyncEntry = {
  id: string;
  value: number;
  loggedAt: Date;
  sessionStartAt: string;
};

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
    ],
    write: [],
  },
};

// Miles to km — getAnchoredWorkouts returns distance in miles
const MILES_TO_KM = 1.60934;
const ASLEEP_VALUES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function requestHealthPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error) => {
      if (error) {
        logger.info('Health permission denied — sync disabled');
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// ─── Running workouts ────────────────────────────────────────────────────────

export async function syncRunningWorkouts(): Promise<void> {
  if (isLocalMode) return;

  const granted = await requestHealthPermission();
  if (!granted) return;

  const checkpointStr = storage.getString(LAST_SYNC_KEY);
  const checkpointDate = checkpointStr
    ? new Date(checkpointStr)
    : new Date(Date.now() - NINETY_DAYS_MS);

  logger.info('Health sync started', { since: checkpointDate.toISOString() });

  const workouts = await queryRunningWorkouts(checkpointDate);
  const filtered = workouts.filter((w) => w.distanceKm >= 0.001);

  if (filtered.length === 0) return;

  let submitted = 0;
  let queued = 0;

  for (const workout of filtered) {
    try {
      await insertLogEntry({
        id: workout.id,
        metricId: RUNNING_METRIC_ID,
        value: workout.distanceKm,
        loggedAt: workout.endDate,
        sessionStartAt: workout.startDate.toISOString(),
      });
      submitted++;
    } catch {
      queued++;
    }
  }

  const lastWorkout = filtered[filtered.length - 1];
  storage.set(LAST_SYNC_KEY, lastWorkout.endDate.toISOString());

  logger.info('Health sync complete', { total: filtered.length, submitted, queued });
}

// ─── Sleep sessions ───────────────────────────────────────────────────────────

export async function syncSleepSessions(): Promise<void> {
  if (isLocalMode) return;

  const granted = await requestHealthPermission();
  if (!granted) return;

  const checkpointStr = storage.getString(SLEEP_LAST_SYNC_KEY);
  const checkpoint = checkpointStr
    ? new Date(checkpointStr)
    : new Date(Date.now() - NINETY_DAYS_MS);

  logger.info('Sleep sync started', { since: checkpoint.toISOString() });

  const rawSamples = await querySleepRawSamples(checkpoint);
  const sessions = groupIntoSessions(rawSamples);

  // Overnight sessions: ≥4h total asleep, wake before 10am
  const overnightSessions = sessions.filter(
    (s) => s.durationMinutes >= 240 && s.wakeTime.getHours() < 10
  );

  let submitted = 0;
  let queued = 0;
  let newCheckpoint: Date | null = null;

  for (const session of overnightSessions) {
    // Advance checkpoint past every overnight session (including non-qualifying ones)
    // to avoid re-reading sessions that can never qualify on subsequent syncs
    newCheckpoint = session.wakeTime;

    if (session.wakeTime.getHours() < 7) {
      try {
        await insertLogEntry({
          id: session.id,
          metricId: EARLY_WAKEUP_METRIC_ID,
          value: 1,
          loggedAt: session.wakeTime,
          sessionStartAt: session.sessionStart.toISOString(),
        });
        submitted++;
      } catch {
        queued++;
      }
    }
  }

  if (newCheckpoint) {
    storage.set(SLEEP_LAST_SYNC_KEY, newCheckpoint.toISOString());
  }

  logger.info('Sleep sync complete', { sessions: overnightSessions.length, submitted, queued });
}

// ─── Manual resync (Settings) ────────────────────────────────────────────────

async function syncEntriesForMetric(metricId: string, since: Date): Promise<SyncEntry[]> {
  if (metricId === RUNNING_METRIC_ID) {
    const workouts = await queryRunningWorkouts(since);
    return workouts
      .filter((w) => w.distanceKm >= 0.001)
      .map((w) => ({
        id: w.id,
        value: w.distanceKm,
        loggedAt: w.endDate,
        sessionStartAt: w.startDate.toISOString(),
      }));
  }

  if (metricId === EARLY_WAKEUP_METRIC_ID) {
    const rawSamples = await querySleepRawSamples(since);
    const sessions = groupIntoSessions(rawSamples);
    return sessions
      .filter(
        (s) =>
          s.durationMinutes >= 240 &&
          s.wakeTime.getHours() < 10 &&
          s.wakeTime.getHours() < 7
      )
      .map((s) => ({
        id: s.id,
        value: 1,
        loggedAt: s.wakeTime,
        sessionStartAt: s.sessionStart.toISOString(),
      }));
  }

  logger.info('Unknown apple_health metric — skipping resync', { metricId });
  return [];
}

export async function resyncAppleHealthMetrics(): Promise<void> {
  if (isLocalMode) return;

  const granted = await requestHealthPermission();
  if (!granted) return;

  const metrics = await fetchUserMetrics();
  const appleHealthMetrics = metrics.filter((m) => m.source === 'apple_health');

  if (appleHealthMetrics.length === 0) {
    logger.info('No apple_health metrics found — nothing to resync');
    return;
  }

  logger.info('Apple Health manual resync started', { count: appleHealthMetrics.length });

  for (const metric of appleHealthMetrics) {
    const { start, end } = getPeriodWindow(metric.timeframe);

    await deleteLogEntriesForPeriod(metric.id, start, end);

    const entries = await syncEntriesForMetric(metric.id, start);

    for (const entry of entries) {
      await insertLogEntry({
        id: entry.id,
        metricId: metric.id,
        value: entry.value,
        loggedAt: entry.loggedAt,
        sessionStartAt: entry.sessionStartAt,
      });
    }

    const checkpointKey =
      metric.id === RUNNING_METRIC_ID ? LAST_SYNC_KEY : SLEEP_LAST_SYNC_KEY;
    storage.set(checkpointKey, start.toISOString());

    logger.info('Apple Health resync complete', { metricId: metric.id, inserted: entries.length });
  }
}

// ─── HealthKit queries ────────────────────────────────────────────────────────

function queryRunningWorkouts(since: Date): Promise<HealthWorkout[]> {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: since.toISOString(),
      endDate: new Date().toISOString(),
      ascending: true,
    };

    AppleHealthKit.getAnchoredWorkouts(options, (error, results) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      const running: HealthWorkout[] = (results.data ?? [])
        .filter((r: HKWorkoutQueriedSampleType) => r.activityName === 'Running')
        .map((r: HKWorkoutQueriedSampleType) => ({
          id: r.id,
          distanceKm: r.distance * MILES_TO_KM,
          startDate: new Date(r.start),
          endDate: new Date(r.end),
        }));

      resolve(running);
    });
  });
}

function querySleepRawSamples(since: Date): Promise<RawSleepSample[]> {
  return new Promise((resolve, reject) => {
    const options = {
      startDate: since.toISOString(),
      endDate: new Date().toISOString(),
      ascending: true,
    };

    // The TS type declares value as number but native returns a string — cast required
    AppleHealthKit.getSleepSamples(options, (error, results) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      const asleepSamples = (results as unknown as RawSleepSample[]).filter((r) =>
        ASLEEP_VALUES.has(r.value)
      );

      resolve(asleepSamples);
    });
  });
}

// ─── Session grouping ─────────────────────────────────────────────────────────

function groupIntoSessions(samples: RawSleepSample[]): SleepSession[] {
  if (samples.length === 0) return [];

  const sessions: SleepSession[] = [];
  let group: RawSleepSample[] = [samples[0]];
  let groupMaxEndMs = new Date(samples[0].endDate).getTime();

  for (let i = 1; i < samples.length; i++) {
    const sample = samples[i];
    const startMs = new Date(sample.startDate).getTime();

    if (startMs - groupMaxEndMs > TWO_HOURS_MS) {
      sessions.push(buildSession(group));
      group = [sample];
      groupMaxEndMs = new Date(sample.endDate).getTime();
    } else {
      group.push(sample);
      const endMs = new Date(sample.endDate).getTime();
      if (endMs > groupMaxEndMs) groupMaxEndMs = endMs;
    }
  }
  sessions.push(buildSession(group));

  return sessions;
}

function buildSession(samples: RawSleepSample[]): SleepSession {
  let maxEndMs = -Infinity;
  let minStartMs = Infinity;
  let totalDurationMs = 0;
  let lastSampleId = samples[0].id;

  for (const s of samples) {
    const startMs = new Date(s.startDate).getTime();
    const endMs = new Date(s.endDate).getTime();
    totalDurationMs += endMs - startMs;
    if (startMs < minStartMs) minStartMs = startMs;
    if (endMs > maxEndMs) {
      maxEndMs = endMs;
      lastSampleId = s.id;
    }
  }

  return {
    id: lastSampleId,
    wakeTime: new Date(maxEndMs),
    sessionStart: new Date(minStartMs),
    durationMinutes: totalDurationMs / 60000,
  };
}
