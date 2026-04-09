import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';

const DEMO_SCREENS = [
  { href: '/demos/network', title: 'Network Requests', description: 'Auto-instrumented fetch and XHR' },
  { href: '/demos/tracing', title: 'Manual Tracing', description: 'Custom spans and nested spans' },
  { href: '/demos/metrics', title: 'Metrics', description: 'Counter, Histogram, UpDownCounter' },
  { href: '/demos/logs', title: 'Logs', description: 'Structured log messages' },
  { href: '/demos/errors', title: 'Errors', description: 'Error tracking and boundaries' },
] as const;

export default function DemosScreen(): React.ReactElement {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Demo Screens</Text>
      {DEMO_SCREENS.map((demo) => (
        <Link key={demo.href} href={demo.href} style={styles.card}>
          <View>
            <Text style={styles.cardTitle}>{demo.title}</Text>
            <Text style={styles.cardDescription}>{demo.description}</Text>
          </View>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  card: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDescription: { fontSize: 14, color: '#666' },
});
