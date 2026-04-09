import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EdotErrorBoundary } from '@inox/react-native-edot-sdk';

function CrashyComponent(): React.JSX.Element {
  throw new Error('ErrorBoundary test: render crash');
}

export function ErrorDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);
  const [showCrashy, setShowCrashy] = useState(false);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const handleJsError = useCallback(() => {
    addLog('Throwing JS error...');
    setTimeout(() => {
      throw new Error('Demo: Uncaught JS error from Wix Navigation example');
    }, 0);
  }, [addLog]);

  const handlePromiseRejection = useCallback(() => {
    addLog('Rejecting promise...');
    Promise.reject(new Error('Demo: Unhandled promise rejection from Wix Navigation example'));
  }, [addLog]);

  const handleErrorBoundary = useCallback(() => {
    addLog('Triggering ErrorBoundary crash...');
    setShowCrashy(true);
  }, [addLog]);

  const handleNativeCrash = useCallback(() => {
    addLog('Native crash placeholder (not implemented)');
  }, [addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Error Tracking</Text>

        <View style={styles.buttons}>
          <Button title="Throw JS Error" onPress={handleJsError} />
          <Button title="Reject Promise" onPress={handlePromiseRejection} />
          <Button title="ErrorBoundary Crash" onPress={handleErrorBoundary} />
          <Button title="Native Crash" onPress={handleNativeCrash} />
        </View>

        {showCrashy && (
          <EdotErrorBoundary
            fallback={
              <View style={styles.section}>
                <Text style={styles.errorText}>ErrorBoundary caught the crash</Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowCrashy(false)}
                >
                  <Text style={styles.buttonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            }
          >
            <CrashyComponent />
          </EdotErrorBoundary>
        )}

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
  errorText: { fontSize: 14, color: '#FF3B30', marginBottom: 8 },
});
