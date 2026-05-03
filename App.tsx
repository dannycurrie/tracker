import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from './src/services/supabase';
import { queryClient } from './src/services/queryClient';
import { isLocalMode } from './src/config/mode';
import { logger } from './src/services/logger';
import { RootStack } from './src/screens';

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (isLocalMode) {
      setSessionReady(true);
      return;
    }
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
        }
      } catch (err) {
        logger.error('Auth initialisation failed', err);
        Alert.alert(
          'Connection error',
          'Could not connect to the server. Check your internet connection and try again.'
        );
      } finally {
        setSessionReady(true);
      }
    })();
  }, []);

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
