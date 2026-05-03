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

const LAST_SYNC_KEY = 'health:last_sync_at';
const RUNNING_METRIC_ID = 'fcf0a5fd-d8e1-4d82-ac15-3605984bbc10';

interface HealthWorkout {
  id: string;
  distanceKm: number;
  startDate: Date;
  endDate: Date;
}

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.Workout],
    write: [],
  },
};

// Miles to km conversion — getAnchoredWorkouts returns distance in miles
const MILES_TO_KM = 1.60934;

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

export async function syncRunningWorkouts(): Promise<void> {
  if (isLocalMode) return;

  const granted = await requestHealthPermission();
  if (!granted) return;

  const checkpointStr = storage.getString(LAST_SYNC_KEY);
  const checkpointDate = checkpointStr
    ? new Date(checkpointStr)
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

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

    const workouts = await queryRunningWorkouts(start);
    const filtered = workouts.filter((w) => w.distanceKm >= 0.001);

    for (const workout of filtered) {
      await insertLogEntry({
        id: workout.id,
        metricId: metric.id,
        value: workout.distanceKm,
        loggedAt: workout.endDate,
        sessionStartAt: workout.startDate.toISOString(),
      });
    }

    // Reset checkpoint so background sync resumes from period start
    storage.set(LAST_SYNC_KEY, start.toISOString());

    logger.info('Apple Health resync complete', { metricId: metric.id, inserted: filtered.length });
  }
}

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
