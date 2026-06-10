import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';

export function HomeScreen(): React.JSX.Element {
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('Checking...');
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  useEffect(() => {
    async function check(): Promise<void> {
      try {
        const id = await EdotReactNative.getCurrentSessionId();
        setSessionId(id);
        setStatus('Initialized');
        addLog(id ? `Session: ${id}` : 'Session: unavailable (Android)');
      } catch {
        setStatus('Not initialized');
      }
    }
    check();
  }, [addLog]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>EDOT Example</Text>

        <View style={styles.section}>
          <Text style={styles.label} testID="home-status">Status: {status}</Text>
          <Text style={styles.label} testID="home-session">Session: {sessionId || 'N/A'}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
});
