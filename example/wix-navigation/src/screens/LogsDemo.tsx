import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function LogsDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const handleInfoLog = useCallback(() => {
    console.info('[EDOT] Info: User viewed logs demo screen');
    addLog('INFO: User viewed logs demo screen');
  }, [addLog]);

  const handleWarnLog = useCallback(() => {
    console.warn('[EDOT] Warn: Cache miss for user preferences');
    addLog('WARN: Cache miss for user preferences');
  }, [addLog]);

  const handleErrorLog = useCallback(() => {
    console.error('[EDOT] Error: Failed to sync data with backend');
    addLog('ERROR: Failed to sync data with backend');
  }, [addLog]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Structured Logs</Text>

        <View style={styles.buttons}>
          <Button testID="logs-btn-info" title="Info Log" onPress={handleInfoLog} />
          <Button testID="logs-btn-warn" title="Warn Log" onPress={handleWarnLog} />
          <Button testID="logs-btn-error" title="Error Log" onPress={handleErrorLog} />
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
