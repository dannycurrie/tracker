import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../index';
import { useMetrics } from '../../hooks/useMetrics';
import { useChecklistState } from '../../hooks/useChecklistState';
import { checkItem, uncheckItem } from '../../services/checklistItems';
import { formatPeriodLabel } from '../../utils/periods';

type Props = NativeStackScreenProps<RootStackParamList, 'Checklist'>;

export function ChecklistScreen({ route, navigation }: Props) {
  const { metricId } = route.params;
  const { metrics } = useMetrics();
  const metric = metrics.find((m) => m.id === metricId);

  const [isPending, setIsPending] = useState<number | null>(null);

  const { isItemChecked, isLoading } = useChecklistState(metric ?? metrics[0]);

  if (!metric) return null;

  const items = metric.checklist_items ?? [];

  async function handleToggle(index: number): Promise<void> {
    if (isPending !== null) {
      return;
    }
    setIsPending(index);
    try {
      if (isItemChecked(index)) {
        await uncheckItem(metric!, index);
      } else {
        await checkItem(metric!, index);
      }
    } finally {
      setIsPending(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{metric.name}</Text>
        <Text style={styles.badge}>{formatPeriodLabel(metric.timeframe)}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => {
            const checked = isItemChecked(index);
            return (
              <View style={styles.row}>
                <Text style={styles.itemLabel}>{item}</Text>
                <TouchableOpacity
                  onPress={() => handleToggle(index)}
                  disabled={isPending !== null}
                  style={styles.toggleBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.indicator, checked ? styles.indicatorChecked : styles.indicatorUnchecked]}>
                    {checked ? '✓' : '○'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          contentContainerStyle={styles.list}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 8,
  },
  backBtn: { paddingRight: 4 },
  backText: { fontSize: 17, color: '#007AFF' },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: '#111' },
  badge: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  loader: { flex: 1 },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  itemLabel: { flex: 1, fontSize: 16, color: '#111' },
  toggleBtn: { paddingLeft: 12 },
  indicator: { fontSize: 24 },
  indicatorChecked: { color: '#34C759' },
  indicatorUnchecked: { color: '#ccc' },
});
