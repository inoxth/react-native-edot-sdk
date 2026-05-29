import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useEdotAction, withEdotTracking } from '@inoxth/react-native-edot-sdk';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { styles } from '../styles';

const TrackedButton = withEdotTracking(Button, 'TrackedButton');

export function InteractionSection({
  addLog,
}: {
  addLog: (message: string) => void;
}): React.JSX.Element {
  const { trackAction } = useEdotAction();

  const handleTrackedPress = useCallback(() => {
    addLog('withEdotTracking button tapped');
  }, [addLog]);

  const handleHookAction = useCallback(() => {
    trackAction('tap', 'HookActionButton', { screen: 'InteractionDemo' });
    addLog('useEdotAction tracked: HookActionButton');
  }, [addLog, trackAction]);

  return (
    <>
      <SectionHeader title="User Interaction" />
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
    </>
  );
}
