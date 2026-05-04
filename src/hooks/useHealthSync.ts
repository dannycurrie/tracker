import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncRunningWorkouts, syncSleepSessions } from '../services/healthSync';

function runAllSyncs(): void {
  Promise.all([syncRunningWorkouts(), syncSleepSessions()]);
}

export function useHealthSync(): void {
  useEffect(() => {
    runAllSyncs();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runAllSyncs();
      }
    });

    return () => subscription.remove();
  }, []);
}
