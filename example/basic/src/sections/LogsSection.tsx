import React, { useCallback } from 'react';
import { View } from 'react-native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

export function LogsSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
  const handleLogInfo = useCallback(() => {
    EdotReactNative.log('info', 'Informational log from demo', { 'demo.screen': 'LogsDemo' });
    addLog('Sent: info log');
  }, [addLog]);

  const handleLogWarn = useCallback(() => {
    EdotReactNative.log('warn', 'Warning log from demo', { 'demo.screen': 'LogsDemo' });
    addLog('Sent: warn log');
  }, [addLog]);

  const handleLogError = useCallback(() => {
    EdotReactNative.log('error', 'Error log from demo', {
      'demo.screen': 'LogsDemo',
      'demo.code': '500',
    });
    addLog('Sent: error log');
  }, [addLog]);

  return (
    <>
      <SectionHeader title="Logs" />
      <View style={styles.buttons}>
        <Button title="Log Info" onPress={handleLogInfo} color="#34C759" testID="logs-btn-info" />
        <Button title="Log Warn" onPress={handleLogWarn} color="#FF9500" testID="logs-btn-warn" />
        <Button title="Log Error" onPress={handleLogError} color="#FF3B30" testID="logs-btn-error" />
      </View>
    </>
  );
}
