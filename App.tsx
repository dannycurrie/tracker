import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/services/supabase';
import { queryClient } from './src/services/queryClient';
import { isLocalMode } from './src/config/mode';
import { logger } from './src/services/logger';
import { RootStack } from './src/screens';
import { useHealthSync } from './src/hooks/useHealthSync';

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (isLocalMode) {
      setSessionReady(true);
      return;
    }
    supabase!.auth.getSession().then(({ error }) => {
      if (error) logger.error('Failed to restore session', error);
    }).finally(() => setSessionReady(true));
  }, []);

  useHealthSync();

  if (!sessionReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <RootStack />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
