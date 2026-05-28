import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { EdotErrorBoundary } from '@inoxth/react-native-edot-sdk';

function CrashComponent(): React.JSX.Element {
  throw new Error('ErrorBoundary test: component render crash');
}

export default function ErrorDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);
  const [showCrashComponent, setShowCrashComponent] = useState(false);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 29)]);
  }, []);

  const handleJsError = useCallback(() => {
    addLog('Throwing JS error...');
    setTimeout(() => {
      throw new Error('Demo: intentional JS error');
    }, 0);
  }, [addLog]);

  const handlePromiseReject = useCallback(() => {
    addLog('Rejecting promise...');
    Promise.reject(new Error('Demo: intentional promise rejection'));
  }, [addLog]);

  const handleErrorBoundary = useCallback(() => {
    addLog('Triggering ErrorBoundary crash...');
    setShowCrashComponent(true);
  }, [addLog]);

  const handleNativeCrash = useCallback(() => {
    Alert.alert(
      'Native Crash',
      'Native crash simulation is not available in JS-only mode. Run on a device with native modules to test.',
    );
    addLog('Native crash: alert shown (placeholder)');
  }, [addLog]);

  return (
    <>
      <Stack.Screen options={{ title: 'Errors' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scroll}>
          <Text style={styles.title}>Errors</Text>
          <Text style={styles.subtitle}>These will trigger real errors captured by the SDK</Text>

          <View style={styles.buttons}>
            <Button title="Throw JS Error" onPress={handleJsError} color="#FF3B30" testID="errors-btn-js-error" />
            <Button title="Reject Promise" onPress={handlePromiseReject} color="#FF3B30" testID="errors-btn-promise-reject" />
            <Button title="Trigger ErrorBoundary" onPress={handleErrorBoundary} color="#FF3B30" testID="errors-btn-error-boundary" />
            <Button title="Native Crash" onPress={handleNativeCrash} color="#FF9500" testID="errors-btn-native-crash" />
          </View>

          <EdotErrorBoundary
            fallback={
              <View style={styles.section}>
                <Text style={styles.errorText}>ErrorBoundary caught a crash!</Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowCrashComponent(false)}
                >
                  <Text style={styles.buttonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            }
          >
            {showCrashComponent && <CrashComponent />}
          </EdotErrorBoundary>

          <View style={styles.section}>
            <Text style={styles.label}>Log:</Text>
            {log.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>{entry}</Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

function Button({ title, onPress, color, testID }: { title: string; onPress: () => void; color?: string; testID?: string }): React.JSX.Element {
  return (
    <TouchableOpacity style={[styles.button, color ? { backgroundColor: color } : undefined]} onPress={onPress} testID={testID}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  subtitle: { fontSize: 13, color: '#999', marginBottom: 16 },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
  errorText: { fontSize: 14, color: '#FF3B30', fontWeight: '600', marginBottom: 8 },
});
