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
  pendingDeletes: string[];
  enqueue: (entry: PendingLogEntry) => void;
  dequeueAll: () => PendingLogEntry[];
  peek: () => PendingLogEntry[];
  enqueueDeletion: (id: string) => void;
  dequeueAllDeletions: () => string[];
}

export const useOfflineQueue = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      pendingDeletes: [],
      enqueue: (entry) => set((state) => ({ queue: [...state.queue, entry] })),
      dequeueAll: () => {
        const entries = get().queue;
        set({ queue: [] });
        return entries;
      },
      peek: () => get().queue,
      enqueueDeletion: (id) => set((state) => ({ pendingDeletes: [...state.pendingDeletes, id] })),
      dequeueAllDeletions: () => {
        const ids = get().pendingDeletes;
        set({ pendingDeletes: [] });
        return ids;
      },
    }),
    {
      name: 'offline-queue',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
