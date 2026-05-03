import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Metric } from '../../types';
import { usePeriodValue } from '../../hooks/usePeriodValue';
import { TimerControl } from '../TimerControl/TimerControl';
import { AverageInput } from '../AverageInput/AverageInput';
import { insertLogEntry } from '../../services/logEntries';
import { formatPeriodLabel } from '../../utils/periods';
import * as Crypto from 'expo-crypto';

interface MetricCardProps {
  metric: Metric;
}

export function MetricCard({ metric }: MetricCardProps) {
  const { value, isLoading } = usePeriodValue(metric);
  const [isPending, setIsPending] = useState(false);

  const handleIncrement = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await insertLogEntry({
        id: Crypto.randomUUID(),
        metricId: metric.id,
        value: 1,
      });
    } finally {
      setIsPending(false);
    }
  };

  const displayValue = (() => {
    if (isLoading) return '…';
    if (value === null) return metric.type === 'average' ? '—' : '0';
    if (metric.type === 'timed') return `${value} min`;
    if (metric.type === 'average') return value.toFixed(1);
    if (metric.type === 'cumulative') return value.toFixed(0);
    return String(value);
  })();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{metric.name}</Text>
        <Text style={styles.badge}>{formatPeriodLabel(metric.timeframe)}</Text>
      </View>

      <Text style={[styles.value, isPending && styles.valuePending]}>{displayValue}</Text>

      {metric.type === 'cumulative' && (
        <TouchableOpacity
          style={[styles.incrementBtn, isPending && styles.incrementBtnPending]}
          onPress={handleIncrement}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.incrementBtnText}>+ Add</Text>
          )}
        </TouchableOpacity>
      )}

      {metric.type === 'timed' && <TimerControl metric={metric} />}

      {metric.type === 'average' && <AverageInput metric={metric} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  badge: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  value: { fontSize: 36, fontWeight: '700', color: '#111', marginBottom: 12 },
  valuePending: { opacity: 0.5 },
  incrementBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  incrementBtnPending: { opacity: 0.6 },
  incrementBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
