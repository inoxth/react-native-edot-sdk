import React, { useCallback } from 'react';
import { View } from 'react-native';
import {
  getTracerProvider,
  withSpanContext,
  SpanStatusCode,
} from '@inox/react-native-edot-tracer-provider';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

export function TracingSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
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
    <>
      <SectionHeader title="Manual Tracing" />
      <View style={styles.buttons}>
        <Button title="Create Span" onPress={handleCreateSpan} testID="tracing-btn-create-span" />
        <Button title="Nested Spans" onPress={handleNestedSpans} testID="tracing-btn-nested-spans" />
      </View>
    </>
  );
}
