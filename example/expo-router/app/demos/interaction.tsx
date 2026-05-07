import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useEdotAction, withEdotTracking } from '@inox/react-native-edot-sdk';

function Button({
  title,
  onPress,
  testID,
}: {
  title: string;
  onPress: () => void;
  testID?: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} testID={testID}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const TrackedButton = withEdotTracking(Button, 'TrackedButton');

export default function InteractionDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);
  const { trackAction } = useEdotAction();

  const addLog = useCallback((message: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 29)]);
  }, []);

  const handleTrackedPress = useCallback(() => {
    addLog('withEdotTracking button tapped');
  }, [addLog]);

  const handleHookAction = useCallback(() => {
    trackAction('tap', 'HookActionButton', { screen: 'InteractionDemo' });
    addLog('useEdotAction tracked: HookActionButton');
  }, [addLog, trackAction]);

  return (
    <>
      <Stack.Screen options={{ title: 'Interaction' }} />
      <View style={styles.container}>
        <ScrollView style={styles.scroll}>
          <Text style={styles.title}>User Interaction</Text>
          <Text style={styles.subtitle}>HOC and hook for tracking taps</Text>

          <View style={styles.buttons}>
            <TrackedButton
              title="Tracked Button (HOC)"
              onPress={handleTrackedPress}
              testID="interaction-btn-tracked"
            />
            <Button
              title="Track Action (Hook)"
              onPress={handleHookAction}
              testID="interaction-btn-hook-action"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Log:</Text>
            {log.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>
                {entry}
              </Text>
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4, color: '#333' },
  subtitle: { fontSize: 13, color: '#999', marginBottom: 16 },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
});
