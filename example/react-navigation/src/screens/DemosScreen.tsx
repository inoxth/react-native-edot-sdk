import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type DemosStackParamList = {
  Demos: undefined;
  NetworkDemo: undefined;
  TracingDemo: undefined;
  MetricsDemo: undefined;
  LogsDemo: undefined;
  ErrorDemo: undefined;
};

const DEMO_SCREENS: Array<{ name: keyof DemosStackParamList; label: string }> = [
  { name: 'NetworkDemo', label: 'Network Requests' },
  { name: 'TracingDemo', label: 'Manual Tracing' },
  { name: 'MetricsDemo', label: 'Metrics' },
  { name: 'LogsDemo', label: 'Structured Logs' },
  { name: 'ErrorDemo', label: 'Error Handling' },
];

export function DemosScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<DemosStackParamList>>();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>SDK Demos</Text>
        {DEMO_SCREENS.map((screen) => (
          <TouchableOpacity
            key={screen.name}
            style={styles.row}
            onPress={() => navigation.navigate(screen.name)}
          >
            <Text style={styles.rowText}>{screen.label}</Text>
            <Text style={styles.arrow}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#333' },
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
