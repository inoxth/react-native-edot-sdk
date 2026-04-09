import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Navigation } from 'react-native-navigation';

interface Props {
  componentId: string;
}

const DEMOS = [
  { name: 'NetworkDemo', label: 'Network Requests' },
  { name: 'TracingDemo', label: 'Manual Tracing' },
  { name: 'MetricsDemo', label: 'Metrics' },
  { name: 'LogsDemo', label: 'Structured Logs' },
  { name: 'ErrorDemo', label: 'Error Tracking' },
] as const;

export function DemosScreen({ componentId }: Props): React.JSX.Element {
  const navigateTo = (screenName: string, title: string): void => {
    Navigation.push(componentId, {
      component: {
        name: screenName,
        options: { topBar: { title: { text: title } } },
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Demos</Text>
        {DEMOS.map((demo) => (
          <TouchableOpacity
            key={demo.name}
            style={styles.row}
            onPress={() => navigateTo(demo.name, demo.label)}
          >
            <Text style={styles.rowText}>{demo.label}</Text>
            <Text style={styles.arrow}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  rowText: { fontSize: 16, color: '#333' },
  arrow: { fontSize: 16, color: '#999' },
});
