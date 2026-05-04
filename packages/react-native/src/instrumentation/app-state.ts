import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { ActiveViewContext } from '../activeViewContext';
import { EdotNativeModule } from '../nativeModule';

const STATUS_OK = 1;

export function setupAppStateTracking(): () => void {
  let wasBackgrounded = false;

  const handleChange = (nextState: AppStateStatus): void => {
    if (nextState === 'background') {
      const active = ActiveViewContext.getActiveView();
      if (active) {
        EdotNativeModule.endSpan(active.spanId, STATUS_OK);
        ActiveViewContext.clearActiveView();
      }
      wasBackgrounded = true;
      return;
    }

    if (nextState === 'active' && wasBackgrounded) {
      ActiveViewContext.notifyForegroundReEmitters();
      wasBackgrounded = false;
    }
  };

  const subscription: NativeEventSubscription = AppState.addEventListener('change', handleChange);

  return () => {
    subscription.remove();
  };
}
