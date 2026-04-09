import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';

export function HomeScreen(): React.JSX.Element {
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('Checking...');
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  useEffect(() => {
    async function checkStatus(): Promise<void> {
      try {
        const id = await EdotReactNative.getCurrentSessionId();
        setSessionId(id);
        setStatus('Initialized');
        addLog(`Session ID: ${id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setStatus(`Error: ${message}`);
        addLog(`Status check error: ${message}`);
      }
    }
    checkStatus();
  }, [addLog]);

  const handleSetUser = useCallback(() => {
    EdotReactNative.setUser({ id: 'user-123', email: 'test@example.com', name: 'Test User' });
    addLog('User set: user-123');
  }, [addLog]);

  const handleClearUser = useCallback(() => {
    EdotReactNative.clearUser();
    addLog('User cleared');
  }, [addLog]);

  const handleSetSessionAttribute = useCallback(() => {
    EdotReactNative.setSessionAttribute('test_key', 'test_value');
    addLog('Session attribute set: test_key=test_value');
  }, [addLog]);

  const handleSetGlobalAttribute = useCallback(() => {
    EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
    addLog('Global attribute set: tenant_id=acme-corp');
  }, [addLog]);

  const handleRemoveGlobalAttribute = useCallback(() => {
    EdotReactNative.removeGlobalAttribute('tenant_id');
    addLog('Global attribute removed: tenant_id');
  }, [addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>EDOT Wix Navigation</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Status: {status}</Text>
          <Text style={styles.label}>Session: {sessionId || 'N/A'}</Text>
        </View>

        <View style={styles.buttons}>
          <Button title="Set User" onPress={handleSetUser} />
          <Button title="Clear User" onPress={handleClearUser} />
          <Button title="Set Session Attr" onPress={handleSetSessionAttribute} />
          <Button title="Set Global Attr" onPress={handleSetGlobalAttribute} />
          <Button title="Remove Global Attr" onPress={handleRemoveGlobalAttribute} />
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
});
