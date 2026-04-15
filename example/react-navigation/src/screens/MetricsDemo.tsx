import React, { useCallback, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getMeterProvider } from '@inox/react-native-edot-tracer-provider';

export function MetricsDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);
  const meter = useRef(getMeterProvider().getMeter('demo', '1.0.0'));
  const counter = useRef(meter.current.createCounter('demo.button_clicks'));
  const histogram = useRef(meter.current.createHistogram('demo.response_time'));
  const upDown = useRef(meter.current.createUpDownCounter('demo.active_items'));

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 29)]);
  }, []);

  const handleCounter = useCallback(() => {
    counter.current.add(1, { 'demo.action': 'increment' });
    addLog('Counter incremented by 1');
  }, [addLog]);

  const handleHistogram = useCallback(() => {
    const value = Math.round(Math.random() * 500);
    histogram.current.record(value, { 'demo.unit': 'ms' });
    addLog(`Histogram recorded: ${value}ms`);
  }, [addLog]);

  const handleUpDownIncrement = useCallback(() => {
    upDown.current.add(1, { 'demo.direction': 'up' });
    addLog('UpDownCounter +1');
  }, [addLog]);

  const handleUpDownDecrement = useCallback(() => {
    upDown.current.add(-1, { 'demo.direction': 'down' });
    addLog('UpDownCounter -1');
  }, [addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Metrics Demos</Text>

        <View style={styles.buttons}>
          <Button title="Increment Counter" onPress={handleCounter} testID="metrics-btn-counter" />
          <Button title="Record Histogram" onPress={handleHistogram} testID="metrics-btn-histogram" />
          <Button title="UpDown +1" onPress={handleUpDownIncrement} testID="metrics-btn-updown" />
          <Button title="UpDown -1" onPress={handleUpDownDecrement} testID="metrics-btn-updown-decrement" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Log:</Text>
          {log.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>{entry}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({ title, onPress, testID }: { title: string; onPress: () => void; testID?: string }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} testID={testID}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
});
