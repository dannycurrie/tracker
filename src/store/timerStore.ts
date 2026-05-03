import { create } from 'zustand';

interface TimerRecord {
  startedAt: string;
}

interface TimerStoreState {
  timers: Record<string, TimerRecord>;
  startTimer: (metricId: string) => void;
  stopTimer: (metricId: string) => void;
  getStartedAt: (metricId: string) => string | null;
}

// In-memory only (no persistence) so force-quit silently discards active sessions.
export const useTimerStore = create<TimerStoreState>((set, get) => ({
  timers: {},
  startTimer: (metricId) =>
    set((state) => ({
      timers: { ...state.timers, [metricId]: { startedAt: new Date().toISOString() } },
    })),
  stopTimer: (metricId) =>
    set((state) => {
      const { [metricId]: _removed, ...rest } = state.timers;
      return { timers: rest };
    }),
  getStartedAt: (metricId) => get().timers[metricId]?.startedAt ?? null,
}));
