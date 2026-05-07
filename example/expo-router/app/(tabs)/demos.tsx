import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

const DEMO_SCREENS = [
  {
    href: '/demos/network',
    title: 'Network Requests',
    description: 'Auto-instrumented fetch and XHR',
    testID: 'demos-btn-network',
  },
  {
    href: '/demos/tracing',
    title: 'Manual Tracing',
    description: 'Custom spans and nested spans',
    testID: 'demos-btn-tracing',
  },
  {
    href: '/demos/metrics',
    title: 'Metrics',
    description: 'Counter, Histogram, UpDownCounter',
    testID: 'demos-btn-metrics',
  },
  {
    href: '/demos/logs',
    title: 'Logs',
    description: 'Structured log messages',
    testID: 'demos-btn-logs',
  },
  {
    href: '/demos/errors',
    title: 'Errors',
    description: 'Error tracking and boundaries',
    testID: 'demos-btn-errors',
  },
  {
    href: '/demos/interaction',
    title: 'User Interaction',
    description: 'Track taps with HOC and hook',
    testID: 'demos-btn-interaction',
  },
] as const;

export default function DemosScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ScrollView testID="demos-scroll" style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Demo Screens</Text>
        {DEMO_SCREENS.map((demo) => (
          <Link key={demo.href} href={demo.href} testID={demo.testID} style={styles.card}>
            <View>
              <Text style={styles.cardTitle}>{demo.title}</Text>
              <Text style={styles.cardDescription}>{demo.description}</Text>
            </View>
          </Link>
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
