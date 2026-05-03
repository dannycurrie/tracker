import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useTimerStore } from '../store/timerStore';

interface UseTimerResult {
  isRunning: boolean;
  elapsedMs: number;
  start: () => void;
  stop: () => number;
}

export function useTimer(metricId: string): UseTimerResult {
  const { startTimer, stopTimer, getStartedAt } = useTimerStore();
  const startedAt = useTimerStore((s) => s.timers[metricId]?.startedAt ?? null);
  const isRunning = startedAt !== null;

  const getElapsed = useCallback(
    () => (startedAt ? Date.now() - new Date(startedAt).getTime() : 0),
    [startedAt]
  );

  const [elapsedMs, setElapsedMs] = useState(getElapsed);

  useEffect(() => {
    if (!isRunning) {
      setElapsedMs(0);
      return;
    }

    setElapsedMs(getElapsed());
    const interval = setInterval(() => setElapsedMs(getElapsed()), 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setElapsedMs(getElapsed());
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isRunning, getElapsed]);

  const start = useCallback(() => startTimer(metricId), [metricId, startTimer]);

  const stop = useCallback((): number => {
    const elapsed = getElapsed();
    stopTimer(metricId);
    return elapsed;
  }, [metricId, stopTimer, getElapsed]);

  return { isRunning, elapsedMs, start, stop };
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
