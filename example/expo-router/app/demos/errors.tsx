import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { EdotErrorBoundary } from '@inox/react-native-edot-sdk';

function CrashyComponent(): React.ReactElement {
  throw new Error('ErrorBoundary demo: component render error');
}

export default function ErrorsDemo(): React.ReactElement {
  const [showCrashy, setShowCrashy] = useState(false);
  const [result, setResult] = useState<string>('');

  function throwJsError(): void {
    setResult('Throwing JS error...');
    throw new Error('Demo JS error from Expo Router example');
  }

  function rejectPromise(): void {
    setResult('Rejecting promise...');
    Promise.reject(new Error('Demo unhandled promise rejection'));
  }

  function toggleErrorBoundary(): void {
    setShowCrashy((prev) => !prev);
    setResult(showCrashy ? 'ErrorBoundary hidden' : 'ErrorBoundary shown');
  }

  function nativeCrash(): void {
    setResult('Native crash not available in JS-only demo');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Error Tracking' }} />
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Error Tracking</Text>
        <Text style={styles.description}>
          Trigger various error types to test SDK error tracking.
        </Text>

        <TouchableOpacity testID="errors-btn-js-error" style={[styles.button, styles.dangerButton]} onPress={throwJsError}>
          <Text style={styles.buttonText}>Throw JS Error</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="errors-btn-promise-reject" style={[styles.button, styles.dangerButton]} onPress={rejectPromise}>
          <Text style={styles.buttonText}>Reject Promise</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="errors-btn-error-boundary" style={[styles.button, styles.dangerButton]} onPress={toggleErrorBoundary}>
          <Text style={styles.buttonText}>
            {showCrashy ? 'Hide' : 'Show'} ErrorBoundary Demo
          </Text>
        </TouchableOpacity>
        <TouchableOpacity testID="errors-btn-native-crash" style={[styles.button, styles.disabledButton]} onPress={nativeCrash}>
          <Text style={styles.buttonText}>Native Crash (placeholder)</Text>
        </TouchableOpacity>

        {showCrashy ? (
          <EdotErrorBoundary
            fallback={
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Caught by EdotErrorBoundary</Text>
              </View>
            }
          >
            <CrashyComponent />
          </EdotErrorBoundary>
        ) : null}

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
  dangerButton: { backgroundColor: '#FF3B30' },
  disabledButton: { backgroundColor: '#999' },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  errorBox: { marginTop: 16, padding: 16, backgroundColor: '#FFF3CD', borderRadius: 8 },
  errorText: { color: '#856404', fontWeight: '600' },
  result: { marginTop: 16, fontSize: 14, color: '#333', fontFamily: 'monospace' },
});
