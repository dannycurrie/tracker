import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncRunningWorkouts } from '../services/healthSync';

export function useHealthSync(): void {
  useEffect(() => {
    syncRunningWorkouts();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncRunningWorkouts();
      }
    });

    return () => subscription.remove();
  }, []);
}
