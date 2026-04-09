import { useState } from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { getMeterProvider } from '@inox/react-native-edot-tracer-provider';

export default function MetricsDemo(): React.ReactElement {
  const [result, setResult] = useState<string>('');
  const meter = getMeterProvider().getMeter('expo-router-demo', '1.0.0');

  function recordCounter(): void {
    const counter = meter.createCounter('demo.button_clicks');
    counter.add(1, { screen: 'metrics', action: 'counter' });
    setResult('Counter incremented by 1');
  }

  function recordHistogram(): void {
    const histogram = meter.createHistogram('demo.response_time');
    const value = Math.floor(Math.random() * 500) + 50;
    histogram.record(value, { screen: 'metrics', unit: 'ms' });
    setResult(`Histogram recorded: ${value}ms`);
  }

  function recordUpDownCounter(): void {
    const upDown = meter.createUpDownCounter('demo.active_tasks');
    const delta = Math.random() > 0.5 ? 1 : -1;
    upDown.add(delta, { screen: 'metrics' });
    setResult(`UpDownCounter adjusted by ${delta}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Metrics' }} />
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Metrics</Text>
        <Text style={styles.description}>
          Record Counter, Histogram, and UpDownCounter metrics.
        </Text>

        <TouchableOpacity style={styles.button} onPress={recordCounter}>
          <Text style={styles.buttonText}>Increment Counter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={recordHistogram}>
          <Text style={styles.buttonText}>Record Histogram</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={recordUpDownCounter}>
          <Text style={styles.buttonText}>UpDownCounter +/-</Text>
        </TouchableOpacity>

        {result ? <Text style={styles.result}>{result}</Text> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  description: { fontSize: 14, color: '#666', marginBottom: 16 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginBottom: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  result: { marginTop: 16, fontSize: 14, color: '#333', fontFamily: 'monospace' },
});
