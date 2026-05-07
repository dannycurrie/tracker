import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../index';
import { useMetrics } from '../../hooks/useMetrics';
import { usePeriodLogEntries } from '../../hooks/usePeriodLogEntries';
import { deleteLogEntry } from '../../services/logEntries';
import { formatPeriodLabel } from '../../utils/periods';
import { LogEntry, MetricType } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MetricLog'>;

function formatValue(value: number, type: MetricType): string {
  if (type === 'timed') return `${value} min`;
  if (type === 'average') return value.toFixed(1);
  return value.toFixed(0);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MetricLogScreen({ route, navigation }: Props) {
  const { metricId } = route.params;
  const { metrics } = useMetrics();
  const metric = metrics.find((m) => m.id === metricId);

  const { entries, isLoading } = usePeriodLogEntries(metric!);

  if (!metric) return null;

  const handleDelete = (entry: LogEntry) => {
    Alert.alert('Delete entry', 'Remove this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteLogEntry(entry.id, metricId),
      },
    ]);
  };

  const renderEntry = ({ item }: { item: LogEntry }) => (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowValue}>{formatValue(item.value, metric.type)}</Text>
        <Text style={styles.rowTime}>{formatDateTime(item.logged_at)}</Text>
        {item.session_start_at && (
          <Text style={styles.rowSession}>
            {'Session started ' + formatDateTime(item.session_start_at)}
          </Text>
        )}
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn} hitSlop={8}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {metric.name}
          </Text>
          <Text style={styles.headerPeriod}>{formatPeriodLabel(metric.timeframe)}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No entries this period</Text>
          <Text style={styles.emptySubtitle}>
            Log your first entry from the dashboard card.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
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
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  backBtn: { width: 70 },
  backBtnText: { fontSize: 17, color: '#007AFF' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  headerPeriod: { fontSize: 12, color: '#666', marginTop: 1 },
  loader: { flex: 1 },
  list: { paddingVertical: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#555', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  rowContent: { flex: 1 },
  rowValue: { fontSize: 22, fontWeight: '700', color: '#111' },
  rowTime: { fontSize: 13, color: '#555', marginTop: 2 },
  rowSession: { fontSize: 11, color: '#888', marginTop: 1 },
  deleteBtn: { paddingLeft: 16, paddingVertical: 4 },
  deleteBtnText: { fontSize: 18, color: '#ccc' },
});
