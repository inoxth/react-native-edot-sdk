import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../styles';

export function LogOutput({ log }: { log: string[] }): React.JSX.Element {
  return (
    <View testID="log-section" style={styles.section}>
      <Text style={styles.label}>Log:</Text>
      {log.map((entry, i) => (
        <Text key={i} style={styles.logEntry}>
          {entry}
        </Text>
      ))}
    </View>
  );
}
