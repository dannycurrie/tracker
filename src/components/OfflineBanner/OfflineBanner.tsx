import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkSync } from '../../hooks/useNetworkSync';

export function OfflineBanner() {
  const { isOnline } = useNetworkSync();
  if (isOnline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline — changes will sync automatically</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FF9500',
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '500' },
});
