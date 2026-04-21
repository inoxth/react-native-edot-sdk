import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';

export default function HomeScreen(): React.ReactElement {
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Ready');

  async function fetchSessionId(): Promise<void> {
    try {
      const id = await EdotReactNative.getCurrentSessionId();
      setSessionId(id);
      setStatus(id ? 'Session ID fetched' : 'Session ID unavailable (Android)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${message}`);
    }
  }

  function setUser(): void {
    EdotReactNative.setUser({ id: 'user-123', email: 'demo@example.com', name: 'Demo User' });
    setStatus('User set');
  }

  function clearUser(): void {
    EdotReactNative.clearUser();
    setStatus('User cleared');
  }

  function setSessionAttr(): void {
    EdotReactNative.setSessionAttribute('screen_mode', 'expo-router');
    setStatus('Session attribute set');
  }

  function setGlobalAttr(): void {
    EdotReactNative.setGlobalAttribute('app.variant', 'expo-router-example');
    setStatus('Global attribute set');
  }

  function removeGlobalAttr(): void {
    EdotReactNative.removeGlobalAttribute('app.variant');
    setStatus('Global attribute removed');
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>EDOT Expo Router Example</Text>
      <Text testID="home-status" style={styles.status}>Status: {status}</Text>
      {sessionId ? <Text testID="home-session" style={styles.sessionId}>Session: {sessionId}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session</Text>
        <TouchableOpacity testID="home-btn-get-session" style={styles.button} onPress={fetchSessionId}>
          <Text style={styles.buttonText}>Get Session ID</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User</Text>
        <TouchableOpacity testID="home-btn-set-user" style={styles.button} onPress={setUser}>
          <Text style={styles.buttonText}>Set User</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="home-btn-clear-user" style={styles.button} onPress={clearUser}>
          <Text style={styles.buttonText}>Clear User</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Attributes</Text>
        <TouchableOpacity testID="home-btn-set-session-attr" style={styles.button} onPress={setSessionAttr}>
          <Text style={styles.buttonText}>Set Session Attribute</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="home-btn-set-global-attr" style={styles.button} onPress={setGlobalAttr}>
          <Text style={styles.buttonText}>Set Global Attribute</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="home-btn-remove-global-attr" style={styles.button} onPress={removeGlobalAttr}>
          <Text style={styles.buttonText}>Remove Global Attribute</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  status: { fontSize: 14, color: '#666', marginBottom: 4 },
  sessionId: { fontSize: 12, color: '#999', marginBottom: 16, fontFamily: 'monospace' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginBottom: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
