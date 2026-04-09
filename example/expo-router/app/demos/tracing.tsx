import { useState } from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { getTracerProvider, withSpanContext, SpanStatusCode } from '@inox/react-native-edot-tracer-provider';

export default function TracingDemo(): React.ReactElement {
  const [result, setResult] = useState<string>('');

  function createSpan(): void {
    const tracer = getTracerProvider().getTracer('expo-router-demo', '1.0.0');
    const span = tracer.startSpan('demo-operation', {
      attributes: { 'demo.type': 'single-span' },
    });

    setTimeout(() => {
      span.setAttribute('demo.completed', true);
      span.setStatus(SpanStatusCode.OK);
      span.end();
      setResult('Span created and ended');
    }, 500);

    setResult('Span started...');
  }

  function createNestedSpans(): void {
    const tracer = getTracerProvider().getTracer('expo-router-demo', '1.0.0');
    const parentSpan = tracer.startSpan('parent-operation', {
      attributes: { 'demo.type': 'nested' },
    });

    setResult('Parent span started...');

    withSpanContext(parentSpan, () => {
      const childSpan = tracer.startSpan('child-operation', {
        attributes: { 'demo.level': '1' },
      });

      setTimeout(() => {
        childSpan.setStatus(SpanStatusCode.OK);
        childSpan.end();
        parentSpan.setStatus(SpanStatusCode.OK);
        parentSpan.end();
        setResult('Parent + child spans created and ended');
      }, 800);
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Manual Tracing' }} />
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Manual Tracing</Text>
        <Text style={styles.description}>
          Create custom spans using getTracerProvider and withSpanContext.
        </Text>

        <TouchableOpacity style={styles.button} onPress={createSpan}>
          <Text style={styles.buttonText}>Create Span</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={createNestedSpans}>
          <Text style={styles.buttonText}>Nested Spans</Text>
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
