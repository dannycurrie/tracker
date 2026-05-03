import React from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../index';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricCard } from '../../components/MetricCard/MetricCard';
import { OfflineBanner } from '../../components/OfflineBanner/OfflineBanner';
import { Metric } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { metrics, isLoading } = useMetrics();

  const renderItem = ({ item }: { item: Metric }) => <MetricCard metric={item} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <OfflineBanner />

      <View style={styles.header}>
        <Text style={styles.title}>My Metrics</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddMetric')}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : metrics.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No metrics yet</Text>
          <Text style={styles.emptySubtitle}>
            Track your first habit — tap + Add to get started.
          </Text>
        </View>
      ) : (
        <FlatList
          data={metrics}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  title: { fontSize: 22, fontWeight: '700', color: '#111' },
  addBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  loader: { flex: 1 },
  list: { paddingVertical: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
