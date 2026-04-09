import React, { useCallback, useMemo, useState } from 'react';
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

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const meter = useMemo(() => getMeterProvider().getMeter('wix-nav-example'), []);

  const handleCounter = useCallback(() => {
    const counter = meter.createCounter('demo.button_clicks');
    counter.add(1, { screen: 'MetricsDemo', action: 'counter' });
    addLog('Counter incremented: demo.button_clicks +1');
  }, [meter, addLog]);

  const handleHistogram = useCallback(() => {
    const histogram = meter.createHistogram('demo.response_time');
    const value = Math.round(Math.random() * 500);
    histogram.record(value, { screen: 'MetricsDemo', unit: 'ms' });
    addLog(`Histogram recorded: demo.response_time = ${value}ms`);
  }, [meter, addLog]);

  const handleUpDownCounter = useCallback(() => {
    const upDown = meter.createUpDownCounter('demo.active_connections');
    const delta = Math.random() > 0.5 ? 1 : -1;
    upDown.add(delta, { screen: 'MetricsDemo' });
    addLog(`UpDownCounter: demo.active_connections ${delta > 0 ? '+' : ''}${delta}`);
  }, [meter, addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Metrics</Text>

        <View style={styles.buttons}>
          <Button title="Counter +1" onPress={handleCounter} />
          <Button title="Histogram Record" onPress={handleHistogram} />
          <Button title="UpDownCounter" onPress={handleUpDownCounter} />
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

function Button({ title, onPress }: { title: string; onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
});
