import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../index';
import { resyncAppleHealthMetrics } from '../../services/healthSync';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      await resyncAppleHealthMetrics();
      setResult('success');
    } catch {
      setResult('error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apple Health</Text>

        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.syncBtnText}>Sync Apple Health Metrics</Text>
          )}
        </TouchableOpacity>

        {result === 'success' && (
          <Text style={styles.successMsg}>Sync complete</Text>
        )}
        {result === 'error' && (
          <Text style={styles.errorMsg}>Sync failed — check permissions and try again</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  backBtn: { width: 64 },
  backBtnText: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  section: { margin: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  syncBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successMsg: { marginTop: 12, textAlign: 'center', color: '#34C759', fontWeight: '500' },
  errorMsg: { marginTop: 12, textAlign: 'center', color: '#FF3B30', fontWeight: '500' },
});
