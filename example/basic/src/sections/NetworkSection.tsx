import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

export function NetworkSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
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
    <>
      <SectionHeader title="Network Requests" />
      <View style={styles.buttons}>
        <Button title="Fetch Data" onPress={handleFetchData} testID="network-btn-fetch" />
        <Button title="Fetch Error" onPress={handleFetchError} testID="network-btn-fetch-error" />
        <Button title="Fetch Multiple (3)" onPress={handleFetchMultiple} testID="network-btn-fetch-multiple" />
        <Button title="XHR Request" onPress={handleXhr} testID="network-btn-xhr" />
      </View>
    </>
  );
}
