import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export function NetworkDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const handleFetchData = useCallback(async () => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const data = await response.json();
      addLog(`Fetch OK: ${data.title?.substring(0, 30)}...`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Fetch error: ${message}`);
    }
  }, [addLog]);

  const handleFetchError = useCallback(async () => {
    try {
      await fetch('https://httpstat.us/500');
      addLog('Fetch 500: server error response');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Fetch error: ${message}`);
    }
  }, [addLog]);

  const handleFetchMultiple = useCallback(async () => {
    try {
      const urls = [
        'https://jsonplaceholder.typicode.com/posts/1',
        'https://jsonplaceholder.typicode.com/posts/2',
        'https://jsonplaceholder.typicode.com/posts/3',
      ];
      const results = await Promise.all(urls.map((url) => fetch(url)));
      addLog(`Fetch multiple: ${results.length} requests completed`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Fetch multiple error: ${message}`);
    }
  }, [addLog]);

  const handleXhrRequest = useCallback(() => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      addLog(`XHR OK: status ${xhr.status}`);
    };
    xhr.onerror = () => {
      addLog('XHR error');
    };
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/posts/1');
    xhr.send();
  }, [addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Network Requests</Text>

        <View style={styles.buttons}>
          <Button testID="network-btn-fetch" title="Fetch Data" onPress={handleFetchData} />
          <Button testID="network-btn-fetch-error" title="Fetch Error" onPress={handleFetchError} />
          <Button testID="network-btn-fetch-multiple" title="Fetch Multiple" onPress={handleFetchMultiple} />
          <Button testID="network-btn-xhr" title="XHR Request" onPress={handleXhrRequest} />
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
