import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createKV } from '../utils/storage';

interface TimerRecord {
  startedAt: string;
}

interface TimerStoreState {
  timers: Record<string, TimerRecord>;
  startTimer: (metricId: string) => void;
  stopTimer: (metricId: string) => void;
  getStartedAt: (metricId: string) => string | null;
}

const kv = createKV('timer');

const mmkvStorage = {
  getItem: (name: string) => kv.getString(name) ?? null,
  setItem: (name: string, value: string) => kv.set(name, value),
  removeItem: (name: string) => kv.delete(name),
};

export const useTimerStore = create<TimerStoreState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: 'timer',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
