import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../index';
import { MetricType, MetricTimeframe } from '../../types';
import { createMetric } from '../../services/metrics';
import { queryClient } from '../../services/queryClient';

type Props = NativeStackScreenProps<RootStackParamList, 'AddMetric'>;

const TYPE_OPTIONS: { label: string; value: MetricType }[] = [
  { label: 'Count', value: 'cumulative' },
  { label: 'Timed', value: 'timed' },
  { label: 'Average', value: 'average' },
];

const TIMEFRAME_OPTIONS: { label: string; value: MetricTimeframe }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export function AddMetricScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<MetricType>('cumulative');
  const [timeframe, setTimeframe] = useState<MetricTimeframe>('weekly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setIsSubmitting(true);
    try {
      await createMetric(name.trim(), type, timeframe);
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not create metric. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Metric</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !name.trim()}
          style={[styles.saveBtn, (!name.trim() || isSubmitting) && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveText}>{isSubmitting ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, !!nameError && styles.inputError]}
          value={name}
          onChangeText={(v) => { setName(v); setNameError(''); }}
          placeholder="e.g. Minutes of reading"
          placeholderTextColor="#aaa"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

        <Text style={styles.label}>Type</Text>
        <View style={styles.segmentRow}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segmentBtn, type === opt.value && styles.segmentBtnActive]}
              onPress={() => setType(opt.value)}
            >
              <Text style={[styles.segmentText, type === opt.value && styles.segmentTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Timeframe</Text>
        <View style={styles.segmentRow}>
          {TIMEFRAME_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segmentBtn, timeframe === opt.value && styles.segmentBtnActive]}
              onPress={() => setTimeframe(opt.value)}
            >
              <Text
                style={[styles.segmentText, timeframe === opt.value && styles.segmentTextActive]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.typeHint}>
          <Text style={styles.typeHintText}>
            {type === 'cumulative' && 'Tap to add 1 each time you do the activity.'}
            {type === 'timed' && 'Start and stop a timer for each session; total minutes are tracked.'}
            {type === 'average' && 'Rate each instance 1–5; your average for the period is shown.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16, color: '#007AFF' },
  saveBtn: { padding: 4 },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  content: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111',
  },
  inputError: { borderColor: '#FF3B30' },
  errorText: { color: '#FF3B30', fontSize: 13, marginTop: 4 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: '#007AFF' },
  segmentText: { fontSize: 14, fontWeight: '500', color: '#555' },
  segmentTextActive: { color: '#fff' },
  typeHint: {
    marginTop: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  typeHintText: { fontSize: 13, color: '#666', lineHeight: 18 },
});
