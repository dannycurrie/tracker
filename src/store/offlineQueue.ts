import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createKV } from '../utils/storage';
import { PendingLogEntry } from '../types';

const kv = createKV('offline-queue');

const mmkvStorage = {
  getItem: (name: string) => kv.getString(name) ?? null,
  setItem: (name: string, value: string) => kv.set(name, value),
  removeItem: (name: string) => kv.delete(name),
};

interface OfflineQueueState {
  queue: PendingLogEntry[];
  enqueue: (entry: PendingLogEntry) => void;
  dequeueAll: () => PendingLogEntry[];
  peek: () => PendingLogEntry[];
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueue: (entry) => set((state) => ({ queue: [...state.queue, entry] })),
      dequeueAll: () => {
        const entries = get().queue;
        set({ queue: [] });
        return entries;
      },
      peek: () => get().queue,
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
