import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Crypto from 'expo-crypto';
import { Metric } from '../../types';
import { insertLogEntry } from '../../services/logEntries';

interface AverageInputProps {
  metric: Metric;
}

const RATINGS = [1, 2, 3, 4, 5] as const;

export function AverageInput({ metric }: AverageInputProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selected === null || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await insertLogEntry({
        id: Crypto.randomUUID(),
        metricId: metric.id,
        value: selected,
      });
      setSelected(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.ratingRow}>
        {RATINGS.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.ratingBtn, selected === r && styles.ratingBtnSelected]}
            onPress={() => setSelected(r)}
          >
            <Text style={[styles.ratingText, selected === r && styles.ratingTextSelected]}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.submitBtn, (selected === null || isSubmitting) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={selected === null || isSubmitting}
      >
        <Text style={styles.submitBtnText}>{isSubmitting ? 'Saving…' : 'Log rating'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBtnSelected: { backgroundColor: '#007AFF' },
  ratingText: { fontSize: 18, fontWeight: '600', color: '#555' },
  ratingTextSelected: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
