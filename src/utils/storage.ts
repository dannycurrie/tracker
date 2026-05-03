import Constants from 'expo-constants';
import { isLocalMode } from '../config/mode';

const isExpoGo = Constants.appOwnership === 'expo';

export interface SyncKV {
  getString(key: string): string | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | boolean): void;
  delete(key: string): void;
}

function makeMemoryKV(): SyncKV {
  const store = new Map<string, string | boolean>();
  return {
    getString: (k) => { const v = store.get(k); return typeof v === 'string' ? v : undefined; },
    getBoolean: (k) => { const v = store.get(k); return typeof v === 'boolean' ? v : undefined; },
    set: (k, v) => store.set(k, v),
    delete: (k) => store.delete(k),
  };
}

export function createKV(id: string): SyncKV {
  if (isLocalMode || isExpoGo) return makeMemoryKV();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
  return new MMKV({ id });
}
