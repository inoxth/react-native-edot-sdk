import React, { useCallback } from 'react';
import { View } from 'react-native';
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

export function UserSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
  const handleSetUser = useCallback(() => {
    EdotReactNative.setUser({ id: 'user-123', email: 'test@example.com', name: 'Test User' });
    addLog('User set: user-123');
  }, [addLog]);

  const handleClearUser = useCallback(() => {
    EdotReactNative.clearUser();
    addLog('User cleared');
  }, [addLog]);

  const handleSetSessionAttr = useCallback(() => {
    EdotReactNative.setSessionAttribute('test_key', 'test_value');
    addLog('Session attr: test_key=test_value');
  }, [addLog]);

  const handleSetGlobalAttr = useCallback(() => {
    EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
    addLog('Global attr: tenant_id=acme-corp');
  }, [addLog]);

  const handleRemoveGlobalAttr = useCallback(() => {
    EdotReactNative.removeGlobalAttribute('tenant_id');
    addLog('Global attr removed: tenant_id');
  }, [addLog]);

  return (
    <>
      <SectionHeader title="User & Session" />
      <View style={styles.buttons}>
        <Button title="Set User" onPress={handleSetUser} testID="home-btn-set-user" />
        <Button title="Clear User" onPress={handleClearUser} testID="home-btn-clear-user" />
        <Button title="Set Session Attr" onPress={handleSetSessionAttr} testID="home-btn-set-session-attr" />
        <Button title="Set Global Attr" onPress={handleSetGlobalAttr} testID="home-btn-set-global-attr" />
        <Button title="Remove Global Attr" onPress={handleRemoveGlobalAttr} testID="home-btn-remove-global-attr" />
      </View>
    </>
  );
}
