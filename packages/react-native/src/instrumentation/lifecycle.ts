import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';

const STATE_LABELS: Record<string, string> = {
  active: 'foreground',
  background: 'background',
  inactive: 'inactive',
};

export function setupLifecycleTracking(config: EdotConfig): () => void {
  let subscription: NativeEventSubscription | null = null;

  try {
    subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        try {
          const label = STATE_LABELS[nextState] ?? nextState;
          const spanId = EdotNativeModule.startSpan(
            `AppLifecycle: ${label}`,
            { 'app.state': nextState },
            null,
          );
          EdotNativeModule.endSpan(spanId, 1);
        } catch (sdkError) {
          if (config.debug) {
            console.log('[EDOT] Lifecycle tracking error:', sdkError);
          }
        }
      },
    );
  } catch (sdkError) {
    if (config.debug) {
      console.log('[EDOT] Failed to set up lifecycle tracking:', sdkError);
    }
  }

  return () => {
    subscription?.remove();
  };
}
