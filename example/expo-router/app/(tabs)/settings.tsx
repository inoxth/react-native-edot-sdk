import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME_IOS,
  EDOT_SERVICE_NAME_ANDROID,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';

const resolvedServiceName =
  Platform.OS === 'ios' ? EDOT_SERVICE_NAME_IOS : EDOT_SERVICE_NAME_ANDROID;

const CONFIG_ITEMS = [
  { label: 'Server URL', value: EDOT_SERVER_URL, testID: 'settings-server-url' },
  { label: 'Service Name', value: resolvedServiceName, testID: 'settings-service-name' },
  { label: 'Service Version', value: EDOT_SERVICE_VERSION },
  { label: 'Secret Token', value: EDOT_SECRET_TOKEN ? '****' : 'Not set' },
  { label: 'Environment', value: EDOT_DEPLOYMENT_ENVIRONMENT },
];

export default function SettingsScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Values from .env file</Text>

        <View style={styles.section}>
          {CONFIG_ITEMS.map((item) => (
            <View key={item.label} style={styles.row} testID={item.testID}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>{item.value || 'Not set'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  subtitle: { fontSize: 13, color: '#999', marginBottom: 16 },
  section: { backgroundColor: '#fff', borderRadius: 8, padding: 12 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  label: { fontSize: 12, color: '#999', marginBottom: 2 },
  value: { fontSize: 14, color: '#333', fontFamily: 'monospace' },
});
