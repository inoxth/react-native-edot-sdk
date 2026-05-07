import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';

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

  const handleSetUser = useCallback(() => {
    EdotReactNative.setUser({ id: 'user-123', email: 'test@example.com', name: 'Test User' });
    addLog('User set: user-123');
  }, [addLog]);

  const handleClearUser = useCallback(() => {
    EdotReactNative.clearUser();
    addLog('User cleared');
  }, [addLog]);

  const handleSetSessionAttr = useCallback(() => {
    EdotReactNative.setSessionAttribute('test_key', 'test_value');
    addLog('Session attr: test_key=test_value');
  }, [addLog]);

  const handleSetGlobalAttr = useCallback(() => {
    EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
    addLog('Global attr: tenant_id=acme-corp');
  }, [addLog]);

  const handleRemoveGlobalAttr = useCallback(() => {
    EdotReactNative.removeGlobalAttribute('tenant_id');
    addLog('Global attr removed: tenant_id');
  }, [addLog]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>EDOT React Navigation</Text>

        <View style={styles.section}>
          <Text style={styles.label} testID="home-status">Status: {status}</Text>
          <Text style={styles.label} testID="home-session">Session: {sessionId || 'N/A'}</Text>
        </View>

        <View style={styles.buttons}>
          <Button title="Set User" onPress={handleSetUser} testID="home-btn-set-user" />
          <Button title="Clear User" onPress={handleClearUser} testID="home-btn-clear-user" />
          <Button title="Set Session Attr" onPress={handleSetSessionAttr} testID="home-btn-set-session-attr" />
          <Button title="Set Global Attr" onPress={handleSetGlobalAttr} testID="home-btn-set-global-attr" />
          <Button title="Remove Global Attr" onPress={handleRemoveGlobalAttr} testID="home-btn-remove-global-attr" />
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

function Button({ title, onPress, testID }: { title: string; onPress: () => void; testID?: string }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} testID={testID}>
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
