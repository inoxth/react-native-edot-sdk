import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
  errorText: { fontSize: 14, color: '#FF3B30', fontWeight: '600', marginBottom: 8 },
});
