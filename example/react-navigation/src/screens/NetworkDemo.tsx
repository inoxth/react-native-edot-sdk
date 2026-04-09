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
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 29)]);
  }, []);

  const handleFetchData = useCallback(async () => {
    try {
      addLog('Fetching data...');
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const data = await response.json();
      addLog(`OK: ${data.title?.substring(0, 40)}...`);
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addLog]);

  const handleFetchError = useCallback(async () => {
    try {
      addLog('Fetching invalid URL...');
      await fetch('https://invalid.example.test/not-found');
      addLog('Unexpected success');
    } catch (e) {
      addLog(`Expected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addLog]);

  const handleFetchMultiple = useCallback(async () => {
    addLog('Fetching 3 requests sequentially...');
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${i}`);
        const data = await response.json();
        addLog(`#${i} OK: ${data.title?.substring(0, 30)}...`);
      } catch (e) {
        addLog(`#${i} Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    addLog('All 3 requests complete');
  }, [addLog]);

  const handleXhr = useCallback(() => {
    addLog('XHR request...');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/users/1');
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        addLog(`XHR OK: ${data.name}`);
      } catch {
        addLog(`XHR parse error`);
      }
    };
    xhr.onerror = () => addLog('XHR network error');
    xhr.send();
  }, [addLog]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Network Demos</Text>
        <Text style={styles.subtitle}>All requests are auto-instrumented by the SDK</Text>

        <View style={styles.buttons}>
          <Button title="Fetch Data" onPress={handleFetchData} />
          <Button title="Fetch Error" onPress={handleFetchError} />
          <Button title="Fetch Multiple (3)" onPress={handleFetchMultiple} />
          <Button title="XHR Request" onPress={handleXhr} />
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
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  subtitle: { fontSize: 13, color: '#999', marginBottom: 16 },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
});
