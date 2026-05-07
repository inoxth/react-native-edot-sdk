import React from 'react';
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
  { label: 'Secret Token', value: EDOT_SECRET_TOKEN ? '***' : '(not set)' },
  { label: 'Environment', value: EDOT_DEPLOYMENT_ENVIRONMENT },
] as const;

export function SettingsScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration (.env)</Text>
          {CONFIG_ITEMS.map((item) => (
            <View key={item.label} style={styles.row}>
              <Text style={styles.label}>{item.label}</Text>
              <Text testID={'testID' in item ? item.testID : undefined} style={styles.value}>{item.value || '(not set)'}</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  label: { fontSize: 12, color: '#999', marginBottom: 2 },
  value: { fontSize: 14, color: '#333' },
});
