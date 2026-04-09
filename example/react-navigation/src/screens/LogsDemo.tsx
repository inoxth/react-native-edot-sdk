import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';

export function LogsDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 29)]);
  }, []);

  const handleLogInfo = useCallback(() => {
    EdotReactNative.log('info', 'Informational log from demo', { 'demo.screen': 'LogsDemo' });
    addLog('Sent: info log');
  }, [addLog]);

  const handleLogWarn = useCallback(() => {
    EdotReactNative.log('warn', 'Warning log from demo', { 'demo.screen': 'LogsDemo' });
    addLog('Sent: warn log');
  }, [addLog]);

  const handleLogError = useCallback(() => {
    EdotReactNative.log('error', 'Error log from demo', { 'demo.screen': 'LogsDemo', 'demo.code': '500' });
    addLog('Sent: error log');
  }, [addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Logs Demos</Text>

        <View style={styles.buttons}>
          <Button title="Log Info" onPress={handleLogInfo} color="#34C759" />
          <Button title="Log Warn" onPress={handleLogWarn} color="#FF9500" />
          <Button title="Log Error" onPress={handleLogError} color="#FF3B30" />
        </View>

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

function Button({ title, onPress, color }: { title: string; onPress: () => void; color?: string }): React.JSX.Element {
  return (
    <TouchableOpacity style={[styles.button, color ? { backgroundColor: color } : undefined]} onPress={onPress}>
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
