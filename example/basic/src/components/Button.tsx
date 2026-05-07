import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { styles } from '../styles';

export function Button({
  title,
  onPress,
  color,
  testID,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  testID?: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.button, color ? { backgroundColor: color } : undefined]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}
