import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { ActiveViewContext } from '../activeViewContext';
import { EdotNativeModule } from '../nativeModule';

const STATUS_ERROR = 2;

export function setupAppStateTracking(): () => void {
  let wasBackgrounded = false;

  const handleChange = (nextState: AppStateStatus): void => {
    if (nextState === 'background') {
      const active = ActiveViewContext.getActiveView();
      if (active) {
        // Mark the screen-load span as aborted so SLOs see it as a failed
        // load rather than a successful one with bogus duration. Idempotent
        // on already-ended spans (the navigation lifecycle's auto-end via
        // runAfterInteractions almost always fires before background).
        EdotNativeModule.setSpanAttributeBoolean(active.spanId, 'screen.load.aborted', true);
        EdotNativeModule.endSpan(active.spanId, STATUS_ERROR);
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
