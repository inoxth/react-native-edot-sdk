import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EdotReactNative, EdotErrorBoundary } from '@inox-edot/react-native';
import { EDOT_SERVER_URL, EDOT_SECRET_TOKEN } from '@env';

export function App(): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Not initialized');
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  useEffect(() => {
    async function init(): Promise<void> {
      if (!EDOT_SERVER_URL) {
        setStatus('Missing .env — copy .env.example to .env');
        return;
      }
      try {
        await EdotReactNative.initialize({
          serverUrl: EDOT_SERVER_URL,
          serviceName: 'rn-edot-example',
          serviceVersion: '0.1.0',
          deploymentEnvironment: 'development',
          secretToken: EDOT_SECRET_TOKEN,
          debug: true,
        });
        setStatus('Initialized');
        addLog('SDK initialized');

        const id = await EdotReactNative.getCurrentSessionId();
        setSessionId(id);
        addLog(`Session ID: ${id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setStatus(`Error: ${message}`);
        addLog(`Init error: ${message}`);
      }
    }
    init();
  }, [addLog]);

  const handleSetUser = useCallback(() => {
    EdotReactNative.setUser({ id: 'user-123', email: 'test@example.com', name: 'Test User' });
    addLog('User set: user-123');
  }, [addLog]);

  const handleClearUser = useCallback(() => {
    EdotReactNative.clearUser();
    addLog('User cleared');
  }, [addLog]);

  const handleSetAttribute = useCallback(() => {
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

  const handleFetchRequest = useCallback(async () => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const data = await response.json();
      addLog(`Fetch OK: ${data.title?.substring(0, 30)}...`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Fetch error: ${message}`);
    }
  }, [addLog]);

  return (
    <EdotErrorBoundary fallback={<Text style={styles.title}>Something went wrong</Text>}>
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scroll}>
        <Text testID="title" style={styles.title}>EDOT React Native SDK</Text>

        <View testID="status-section" style={styles.section}>
          <Text testID="status-text" style={styles.label}>Status: {status}</Text>
          <Text testID="session-text" style={styles.label}>Session: {sessionId || 'N/A'}</Text>
        </View>

        <View style={styles.buttons}>
          <Button testID="btn-set-user" title="Set User" onPress={handleSetUser} />
          <Button testID="btn-clear-user" title="Clear User" onPress={handleClearUser} />
          <Button testID="btn-set-session-attr" title="Set Session Attr" onPress={handleSetAttribute} />
          <Button testID="btn-set-global-attr" title="Set Global Attr" onPress={handleSetGlobalAttribute} />
          <Button testID="btn-remove-global-attr" title="Remove Global Attr" onPress={handleRemoveGlobalAttribute} />
          <Button testID="btn-test-fetch" title="Test Fetch" onPress={handleFetchRequest} />
        </View>

        <View testID="log-section" style={styles.section}>
          <Text style={styles.label}>Log:</Text>
          {log.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>
              {entry}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
    </EdotErrorBoundary>
  );
}

function Button({ testID, title, onPress }: { testID?: string; title: string; onPress: () => void }): React.JSX.Element {
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
