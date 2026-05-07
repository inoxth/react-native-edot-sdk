import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import { getMeterProvider } from '@inox/react-native-edot-tracer-provider';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

export function MetricsSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
  const meter = useRef(getMeterProvider().getMeter('demo', '1.0.0'));
  const counter = useRef(meter.current.createCounter('demo.button_clicks'));
  const histogram = useRef(meter.current.createHistogram('demo.response_time'));
  const upDown = useRef(meter.current.createUpDownCounter('demo.active_items'));

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
    <>
      <SectionHeader title="Metrics" />
      <View style={styles.buttons}>
        <Button title="Increment Counter" onPress={handleCounter} testID="metrics-btn-counter" />
        <Button title="Record Histogram" onPress={handleHistogram} testID="metrics-btn-histogram" />
        <Button title="UpDown +1" onPress={handleUpDownIncrement} testID="metrics-btn-updown-up" />
        <Button title="UpDown -1" onPress={handleUpDownDecrement} testID="metrics-btn-updown-down" />
      </View>
    </>
  );
}
