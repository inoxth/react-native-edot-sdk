import { ActiveViewContext, getNativeModule } from '@inox/react-native-edot-shared';
import type { NavigationContainerRef, EdotNavigationOptions } from './types';

const REACT_NAVIGATION_INSTRUMENTATION = '@inox/react-native-edot-navigation';

export interface NavigationLifecycle {
  onScreen: (screenName: string) => void;
  cleanup: () => void;
}

export interface CreateNavigationLifecycleOptions {
  instrumentationName: string;
  getCurrentScreenName: () => string | null;
}

export function createNavigationLifecycle(
  options: CreateNavigationLifecycleOptions,
): NavigationLifecycle {
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

    currentSpanId = getNativeModule().startSpan(
      screenName,
      attributes,
      null,
      options.instrumentationName,
    );

    ActiveViewContext.setActiveView({ name: screenName, spanId: currentSpanId });
    previousScreenName = screenName;
  }

  const unregisterReEmitter = ActiveViewContext.registerForegroundReEmitter(() => {
    const screenName = options.getCurrentScreenName();
    if (!screenName) return;
    previousScreenName = null;
    startViewSpan(screenName);
  });

  function onScreen(screenName: string): void {
    if (screenName !== previousScreenName) {
      startViewSpan(screenName);
    }
  }

  function cleanup(): void {
    unregisterReEmitter();
    endCurrentSpan();
    ActiveViewContext.clearActiveView();
    previousScreenName = null;
  }

  return { onScreen, cleanup };
}

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

  function getScreenName(): string | null {
    const ref = navigationRef.current;
    if (!ref) return null;
    const route = ref.getCurrentRoute();
    if (!route) return null;
    return mapper ? mapper(route.name, route.params) : route.name;
  }

  const lifecycle = createNavigationLifecycle({
    instrumentationName: REACT_NAVIGATION_INSTRUMENTATION,
    getCurrentScreenName: getScreenName,
  });

  function onReady(): void {
    const screenName = getScreenName();
    if (screenName) lifecycle.onScreen(screenName);
  }

  function onStateChange(): void {
    const screenName = getScreenName();
    if (screenName) lifecycle.onScreen(screenName);
  }

  return { onStateChange, onReady, cleanup: lifecycle.cleanup, navigationRef };
}

export function resetForTesting(): void {
  if (!__DEV__) {
    return;
  }
  ActiveViewContext.clearActiveView();
}
