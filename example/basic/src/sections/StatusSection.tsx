import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../styles';

export function StatusSection({
  status,
  sessionId,
}: {
  status: string;
  sessionId: string;
}): React.JSX.Element {
  return (
    <View testID="status-section" style={styles.section}>
      <Text testID="home-status" style={styles.label}>
        Status: {status}
      </Text>
      <Text testID="home-session" style={styles.label}>
        Session: {sessionId || 'N/A'}
      </Text>
    </View>
  );
}
