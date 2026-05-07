import React, { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { EdotErrorBoundary } from '@inox/react-native-edot-sdk';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

function CrashComponent(): React.JSX.Element {
  throw new Error('ErrorBoundary test: component render crash');
}

export function ErrorsSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
  const [showCrashComponent, setShowCrashComponent] = useState(false);

  const handleJsError = useCallback(() => {
    addLog('Throwing JS error...');
    setTimeout(() => {
      throw new Error('Demo: intentional JS error');
    }, 0);
  }, [addLog]);

  const handlePromiseReject = useCallback(() => {
    addLog('Rejecting promise...');
    Promise.reject(new Error('Demo: intentional promise rejection'));
  }, [addLog]);

  const handleErrorBoundary = useCallback(() => {
    addLog('Triggering ErrorBoundary crash...');
    setShowCrashComponent(true);
  }, [addLog]);

  const handleNativeCrash = useCallback(() => {
    Alert.alert(
      'Native Crash',
      'Native crash simulation is not available in JS-only mode. Run on a device with native modules to test.',
    );
    addLog('Native crash: alert shown (placeholder)');
  }, [addLog]);

  return (
    <>
      <SectionHeader title="Errors" />
      <View style={styles.buttons}>
        <Button title="Throw JS Error" onPress={handleJsError} color="#FF3B30" testID="errors-btn-js-error" />
        <Button title="Reject Promise" onPress={handlePromiseReject} color="#FF3B30" testID="errors-btn-promise-reject" />
        <Button title="Trigger ErrorBoundary" onPress={handleErrorBoundary} color="#FF3B30" testID="errors-btn-error-boundary" />
        <Button title="Native Crash" onPress={handleNativeCrash} color="#FF9500" testID="errors-btn-native-crash" />
      </View>

      <EdotErrorBoundary
        fallback={
          <View style={styles.section}>
            <Text style={styles.errorText}>ErrorBoundary caught a crash!</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => setShowCrashComponent(false)}
            >
              <Text style={styles.buttonText}>Reset</Text>
            </TouchableOpacity>
          </View>
        }
      >
        {showCrashComponent && <CrashComponent />}
      </EdotErrorBoundary>
    </>
  );
}
