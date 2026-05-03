import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { drainQueue } from '../services/syncQueue';

export function useNetworkSync(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setIsOnline(connected);

      if (connected && wasOffline.current) {
        wasOffline.current = false;
        drainQueue().catch(() => {});
      } else if (!connected) {
        wasOffline.current = true;
      }
    });

    return unsubscribe;
  }, []);

  return { isOnline };
}
