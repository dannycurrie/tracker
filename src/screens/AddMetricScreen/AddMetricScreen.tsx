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
  { label: 'Checklist', value: 'checklist' },
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
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);
  const [itemsError, setItemsError] = useState('');

  const isSaveDisabled =
    isSubmitting ||
    !name.trim() ||
    (type === 'checklist' && checklistItems.every((s) => !s.trim()));

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');

    if (type === 'checklist') {
      if (checklistItems.every((s) => !s.trim())) {
        setItemsError('At least one item is required');
        return;
      }
      if (checklistItems.some((s) => !s.trim())) {
        setItemsError('All item names must be non-empty');
        return;
      }
    }
    setItemsError('');

    setIsSubmitting(true);
    try {
      const trimmedItems =
        type === 'checklist'
          ? checklistItems.filter((s) => s.trim()).map((s) => s.trim())
          : undefined;
      await createMetric(name.trim(), type, timeframe, 'user', trimmedItems);
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
          disabled={isSaveDisabled}
          style={[styles.saveBtn, isSaveDisabled && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveText}>{isSubmitting ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
              onPress={() => { setType(opt.value); setItemsError(''); }}
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
            {type === 'checklist' && 'Define items to check off each period — tracked as X/N progress.'}
          </Text>
        </View>

        {type === 'checklist' && (
          <View>
            <Text style={styles.label}>Items</Text>
            {checklistItems.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <TextInput
                  style={[styles.itemInput, !!itemsError && !item.trim() && styles.inputError]}
                  value={item}
                  onChangeText={(v) => {
                    setChecklistItems((prev) => prev.map((s, i) => (i === index ? v : s)));
                    setItemsError('');
                  }}
                  placeholder={`Item ${index + 1}`}
                  placeholderTextColor="#aaa"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  onPress={() => setChecklistItems((prev) => prev.filter((_, i) => i !== index))}
                  disabled={checklistItems.length === 1}
                  style={[styles.removeBtn, checklistItems.length === 1 && styles.removeBtnDisabled]}
                >
                  <Text style={styles.removeBtnText}>−</Text>
                </TouchableOpacity>
              </View>
            ))}
            {!!itemsError && <Text style={styles.errorText}>{itemsError}</Text>}
            <TouchableOpacity
              onPress={() => setChecklistItems((prev) => [...prev, ''])}
              disabled={checklistItems.length >= 10}
              style={[styles.addItemBtn, checklistItems.length >= 10 && styles.addItemBtnDisabled]}
            >
              <Text style={[styles.addItemBtnText, checklistItems.length >= 10 && styles.addItemBtnTextDisabled]}>
                + Add item
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  segmentRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  segmentBtn: {
    flex: 1,
    minWidth: 70,
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
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnDisabled: { backgroundColor: '#ddd' },
  removeBtnText: { color: '#fff', fontSize: 20, lineHeight: 22 },
  addItemBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  addItemBtnDisabled: { opacity: 0.4 },
  addItemBtnText: { fontSize: 14, fontWeight: '500', color: '#007AFF' },
  addItemBtnTextDisabled: { color: '#aaa' },
});
