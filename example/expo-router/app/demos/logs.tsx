import { useState } from 'react';
import { Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { EdotReactNative } from '@inox/react-native-edot-sdk';

export default function LogsDemo(): React.ReactElement {
  const [result, setResult] = useState<string>('');

  function logInfo(): void {
    EdotReactNative.log('info', 'User viewed the logs demo screen', {
      screen: 'logs',
      action: 'info',
    });
    setResult('Info log emitted');
  }

  function logWarn(): void {
    EdotReactNative.log('warn', 'Something might need attention', {
      screen: 'logs',
      action: 'warn',
      threshold: 80,
    });
    setResult('Warning log emitted');
  }

  function logError(): void {
    EdotReactNative.log('error', 'An error occurred during demo operation', {
      screen: 'logs',
      action: 'error',
      error_code: 'DEMO_ERROR',
    });
    setResult('Error log emitted');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Logs' }} />
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Structured Logs</Text>
        <Text style={styles.description}>
          Emit structured log messages with different severity levels.
        </Text>

        <TouchableOpacity testID="logs-btn-info" style={styles.button} onPress={logInfo}>
          <Text style={styles.buttonText}>Log Info</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="logs-btn-warn" style={[styles.button, styles.warnButton]} onPress={logWarn}>
          <Text style={styles.buttonText}>Log Warning</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="logs-btn-error" style={[styles.button, styles.errorButton]} onPress={logError}>
          <Text style={styles.buttonText}>Log Error</Text>
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
  warnButton: { backgroundColor: '#FF9500' },
  errorButton: { backgroundColor: '#FF3B30' },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  result: { marginTop: 16, fontSize: 14, color: '#333', fontFamily: 'monospace' },
});
