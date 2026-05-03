import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Metric } from '../../types';
import { useTimer, formatElapsed } from '../../hooks/useTimer';
import { insertLogEntry } from '../../services/logEntries';
import { useTimerStore } from '../../store/timerStore';

interface TimerControlProps {
  metric: Metric;
}

export function TimerControl({ metric }: TimerControlProps) {
  const { isRunning, elapsedMs, start, stop } = useTimer(metric.id);
  const startedAt = useTimerStore((s) => s.timers[metric.id]?.startedAt ?? null);

  const handleStop = async () => {
    const elapsed = stop();
    const minutes = Math.floor(elapsed / 60_000);
    if (minutes < 1) return; // Don't log sub-minute sessions
    await insertLogEntry({
      id: Crypto.randomUUID(),
      metricId: metric.id,
      value: minutes,
      sessionStartAt: startedAt ?? undefined,
    });
  };

  return (
    <View style={styles.container}>
      {isRunning && (
        <Text style={styles.elapsed}>{formatElapsed(elapsedMs)}</Text>
      )}
      <View style={styles.row}>
        {!isRunning ? (
          <TouchableOpacity style={styles.startBtn} onPress={start}>
            <Text style={styles.startBtnText}>▶ Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
            <Text style={styles.stopBtnText}>■ Stop</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row' },
  elapsed: {
    fontSize: 28,
    fontWeight: '600',
    color: '#007AFF',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginBottom: 4,
  },
  startBtn: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  stopBtn: {
    flex: 1,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stopBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
