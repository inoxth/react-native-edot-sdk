import { View, Text, StyleSheet, ScrollView } from 'react-native';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';

const CONFIG_ITEMS = [
  { label: 'Server URL', value: EDOT_SERVER_URL, testID: 'settings-server-url' },
  { label: 'Service Name', value: EDOT_SERVICE_NAME, testID: 'settings-service-name' },
  { label: 'Service Version', value: EDOT_SERVICE_VERSION },
  { label: 'Secret Token', value: EDOT_SECRET_TOKEN ? '***' : '(not set)' },
  { label: 'Environment', value: EDOT_DEPLOYMENT_ENVIRONMENT },
];

export default function SettingsScreen(): React.ReactElement {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Configuration</Text>
      <Text style={styles.subtitle}>Values from .env</Text>
      {CONFIG_ITEMS.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={styles.label}>{item.label}</Text>
          <Text testID={item.testID} style={styles.value}>{item.value || '(not set)'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 14, color: '#666', fontFamily: 'monospace' },
});
