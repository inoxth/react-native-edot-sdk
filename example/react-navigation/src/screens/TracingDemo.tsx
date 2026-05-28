import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getTracerProvider, withSpanContext, SpanStatusCode } from '@inoxth/react-native-edot-tracer-provider';

export function TracingDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 29)]);
  }, []);

  const handleCreateSpan = useCallback(() => {
    const tracer = getTracerProvider().getTracer('demo', '1.0.0');
    const span = tracer.startSpan('demo-operation', {
      attributes: { 'demo.type': 'simple', 'demo.screen': 'TracingDemo' },
    });
    addLog(`Span started: ${span.spanId}`);

    span.setAttribute('demo.step', 'processing');
    span.setStatus(SpanStatusCode.OK);
    span.end();
    addLog('Span ended with OK status');
  }, [addLog]);

  const handleNestedSpans = useCallback(() => {
    const tracer = getTracerProvider().getTracer('demo', '1.0.0');

    const parentSpan = tracer.startSpan('parent-operation', {
      attributes: { 'demo.type': 'nested' },
    });
    addLog(`Parent span: ${parentSpan.spanId}`);

    withSpanContext(parentSpan, () => {
      const childSpan = tracer.startSpan('child-operation', {
        attributes: { 'demo.parent': parentSpan.spanId },
      });
      addLog(`Child span: ${childSpan.spanId}`);

      childSpan.setAttribute('demo.step', 'child-work');
      childSpan.setStatus(SpanStatusCode.OK);
      childSpan.end();
      addLog('Child span ended');
    });

    parentSpan.setStatus(SpanStatusCode.OK);
    parentSpan.end();
    addLog('Parent span ended');
  }, [addLog]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Manual Tracing</Text>

        <View style={styles.buttons}>
          <Button title="Create Span" onPress={handleCreateSpan} testID="tracing-btn-create-span" />
          <Button title="Nested Spans" onPress={handleNestedSpans} testID="tracing-btn-nested-spans" />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Log:</Text>
          {log.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>{entry}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
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
