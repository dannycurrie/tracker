import { useEffect } from 'react';
import { AppState } from 'react-native';
import { syncRunningWorkouts, syncSleepSessions, syncMindfulMinutes } from '../services/healthSync';

function runAllSyncs(): void {
  Promise.all([syncRunningWorkouts(), syncSleepSessions(), syncMindfulMinutes()]);
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
