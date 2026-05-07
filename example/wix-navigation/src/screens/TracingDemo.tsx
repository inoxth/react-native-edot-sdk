import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  getTracerProvider,
  withSpanContext,
  SpanStatusCode,
} from '@inox/react-native-edot-tracer-provider';

export function TracingDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const handleCreateSpan = useCallback(() => {
    const tracer = getTracerProvider().getTracer('wix-nav-example');
    const span = tracer.startSpan('demo-operation', {
      attributes: { 'demo.type': 'single-span' },
    });
    span.setAttribute('demo.timestamp', Date.now());
    span.setStatus(SpanStatusCode.OK);
    span.end();
    addLog(`Span created: ${span.spanId}`);
  }, [addLog]);

  const handleNestedSpans = useCallback(() => {
    const tracer = getTracerProvider().getTracer('wix-nav-example');

    const parentSpan = tracer.startSpan('parent-operation', {
      attributes: { 'demo.type': 'nested-spans' },
    });

    withSpanContext(parentSpan, () => {
      const childSpan = tracer.startSpan('child-operation-1');
      childSpan.setAttribute('child.index', 1);
      childSpan.setStatus(SpanStatusCode.OK);
      childSpan.end();
      addLog(`Child span 1: ${childSpan.spanId}`);

      const childSpan2 = tracer.startSpan('child-operation-2');
      childSpan2.setAttribute('child.index', 2);
      childSpan2.setStatus(SpanStatusCode.OK);
      childSpan2.end();
      addLog(`Child span 2: ${childSpan2.spanId}`);
    });

    parentSpan.setStatus(SpanStatusCode.OK);
    parentSpan.end();
    addLog(`Parent span: ${parentSpan.spanId}`);
  }, [addLog]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Manual Tracing</Text>

        <View style={styles.buttons}>
          <Button testID="tracing-btn-create-span" title="Create Span" onPress={handleCreateSpan} />
          <Button testID="tracing-btn-nested-spans" title="Nested Spans" onPress={handleNestedSpans} />
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

function Button({ testID, title, onPress }: { testID: string; title: string; onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity testID={testID} style={styles.button} onPress={onPress}>
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
