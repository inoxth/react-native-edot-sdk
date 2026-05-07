import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type DemosStackParamList = {
  Demos: undefined;
  NetworkDemo: undefined;
  TracingDemo: undefined;
  MetricsDemo: undefined;
  LogsDemo: undefined;
  ErrorDemo: undefined;
  InteractionDemo: undefined;
};

const DEMO_SCREENS: Array<{
  name: keyof DemosStackParamList;
  title: string;
  description: string;
  testID: string;
}> = [
  {
    name: 'NetworkDemo',
    title: 'Network Requests',
    description: 'Auto-instrumented fetch and XHR',
    testID: 'demos-btn-network',
  },
  {
    name: 'TracingDemo',
    title: 'Manual Tracing',
    description: 'Custom spans and nested spans',
    testID: 'demos-btn-tracing',
  },
  {
    name: 'MetricsDemo',
    title: 'Metrics',
    description: 'Counter, Histogram, UpDownCounter',
    testID: 'demos-btn-metrics',
  },
  {
    name: 'LogsDemo',
    title: 'Logs',
    description: 'Structured log messages',
    testID: 'demos-btn-logs',
  },
  {
    name: 'ErrorDemo',
    title: 'Errors',
    description: 'Error tracking and boundaries',
    testID: 'demos-btn-errors',
  },
  {
    name: 'InteractionDemo',
    title: 'User Interaction',
    description: 'Track taps with HOC and hook',
    testID: 'demos-btn-interaction',
  },
];

export function DemosScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<DemosStackParamList>>();

  return (
    <View style={styles.container}>
      <ScrollView testID="demos-scroll" style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Demo Screens</Text>
        {DEMO_SCREENS.map((screen) => (
          <TouchableOpacity
            key={screen.name}
            style={styles.card}
            testID={screen.testID}
            onPress={() => navigation.navigate(screen.name)}
          >
            <Text style={styles.cardTitle}>{screen.title}</Text>
            <Text style={styles.cardDescription}>{screen.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#666' },
});
