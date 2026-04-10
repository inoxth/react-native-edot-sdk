import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';

export default function NetworkDemo(): React.ReactElement {
  const [result, setResult] = useState<string>('');

  async function fetchData(): Promise<void> {
    setResult('Fetching...');
    try {
      const response = await fetch('https://httpbin.org/get');
      const data: unknown = await response.json();
      setResult(`OK ${response.status}: ${JSON.stringify(data).slice(0, 200)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult(`Error: ${message}`);
    }
  }

  async function fetchError(): Promise<void> {
    setResult('Fetching...');
    try {
      const response = await fetch('https://httpbin.org/status/500');
      setResult(`Response: ${response.status} ${response.statusText}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult(`Error: ${message}`);
    }
  }

  async function fetchMultiple(): Promise<void> {
    setResult('Fetching 3 requests...');
    try {
      const results = await Promise.all([
        fetch('https://httpbin.org/delay/1'),
        fetch('https://httpbin.org/delay/2'),
        fetch('https://httpbin.org/get'),
      ]);
      const statuses = results.map((r) => r.status).join(', ');
      setResult(`All done: [${statuses}]`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult(`Error: ${message}`);
    }
  }

  function xhrRequest(): void {
    setResult('XHR sending...');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://httpbin.org/get');
    xhr.onload = () => {
      setResult(`XHR ${xhr.status}: ${xhr.responseText.slice(0, 200)}`);
    };
    xhr.onerror = () => {
      setResult('XHR error');
    };
    xhr.send();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Network Requests' }} />
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Network Requests</Text>
        <Text style={styles.description}>
          All fetch/XHR requests are auto-instrumented by the SDK.
        </Text>

        <TouchableOpacity testID="network-btn-fetch" style={styles.button} onPress={fetchData}>
          <Text style={styles.buttonText}>Fetch Data</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="network-btn-fetch-error" style={styles.button} onPress={fetchError}>
          <Text style={styles.buttonText}>Fetch Error (500)</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="network-btn-fetch-multiple" style={styles.button} onPress={fetchMultiple}>
          <Text style={styles.buttonText}>Fetch Multiple</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="network-btn-xhr" style={styles.button} onPress={xhrRequest}>
          <Text style={styles.buttonText}>XHR Request</Text>
        </TouchableOpacity>

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  description: { fontSize: 14, color: '#666', marginBottom: 16 },
  button: { backgroundColor: '#007AFF', padding: 12, borderRadius: 8, marginBottom: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  resultBox: { marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 },
  resultText: { fontSize: 12, fontFamily: 'monospace', color: '#333' },
});
