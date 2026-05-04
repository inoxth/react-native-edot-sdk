import { ActiveViewContext, getNativeModule } from '@inox/react-native-edot-shared';
import type { NavigationContainerRef, EdotNavigationOptions } from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-navigation';

export function createEdotNavigationContainerRef<
  T extends NavigationContainerRef = NavigationContainerRef,
>(
  options?: EdotNavigationOptions,
): {
  onStateChange: () => void;
  onReady: () => void;
  cleanup: () => void;
  navigationRef: { current: T | null };
} {
  const navigationRef: { current: T | null } = { current: null };
  const mapper = options?.screenNameMapper;

  let currentSpanId: string | null = null;
  let previousScreenName: string | null = null;

  function endCurrentSpan(): void {
    if (currentSpanId) {
      getNativeModule().endSpan(currentSpanId, 1);
      currentSpanId = null;
    }
  }

  function startViewSpan(screenName: string): void {
    endCurrentSpan();

    const attributes: Record<string, string> = {
      'screen.name': screenName,
    };
    if (previousScreenName && previousScreenName !== screenName) {
      attributes['last.screen.name'] = previousScreenName;
    }

    currentSpanId = getNativeModule().startSpan(screenName, attributes, null, INSTRUMENTATION_NAME);

    ActiveViewContext.setActiveView({ name: screenName, spanId: currentSpanId });
    previousScreenName = screenName;
  }

  function getScreenName(ref: NavigationContainerRef): string | null {
    const route = ref.getCurrentRoute();
    if (!route) return null;
    return mapper ? mapper(route.name, route.params) : route.name;
  }

  function onReady(): void {
    if (!navigationRef.current) return;
    const screenName = getScreenName(navigationRef.current);
    if (screenName) {
      startViewSpan(screenName);
    }
  }

  function onStateChange(): void {
    if (!navigationRef.current) return;
    const screenName = getScreenName(navigationRef.current);
    if (screenName && screenName !== previousScreenName) {
      startViewSpan(screenName);
    }
  }

  const unregisterReEmitter = ActiveViewContext.registerForegroundReEmitter(() => {
    if (!navigationRef.current) return;
    const screenName = getScreenName(navigationRef.current);
    if (!screenName) return;
    previousScreenName = null;
    startViewSpan(screenName);
  });

  function cleanup(): void {
    unregisterReEmitter();
    endCurrentSpan();
    ActiveViewContext.clearActiveView();
    previousScreenName = null;
  }

  return { onStateChange, onReady, cleanup, navigationRef };
}

export function resetForTesting(): void {
  if (!__DEV__) {
    return;
  }
  ActiveViewContext.clearActiveView();
}
