import { ActiveViewContext } from '@inox-edot/react-native/active-view-context';
import type { NavigationContainerRef, EdotNavigationOptions } from './types';

interface NativeModule {
  startSpan(name: string, attributes: Record<string, string>, parentSpanId: string | null): string;
  endSpan(spanId: string, statusCode: number): void;
}

let nativeModule: NativeModule | null = null;

function getNativeModule(): NativeModule {
  if (!nativeModule) {
    const mod = require('@inox-edot/react-native/nativeModule') as {
      EdotNativeModule: NativeModule;
    };
    nativeModule = mod.EdotNativeModule;
  }
  return nativeModule;
}

let currentSpanId: string | null = null;
let previousScreenName: string | null = null;

function endCurrentSpan(): void {
  if (currentSpanId) {
    getNativeModule().endSpan(currentSpanId, 1);
    currentSpanId = null;
  }
}

function startViewSpan(screenName: string, transitionType: string): void {
  endCurrentSpan();

  const attributes: Record<string, string> = {
    'view.name': screenName,
    'view.transition_type': transitionType,
  };
  if (previousScreenName) {
    attributes['view.previous'] = previousScreenName;
  }

  currentSpanId = getNativeModule().startSpan(`Navigation: ${screenName}`, attributes, null);

  ActiveViewContext.setActiveView({ name: screenName, spanId: currentSpanId });
  previousScreenName = screenName;
}

export function createEdotNavigationContainerRef(
  options?: EdotNavigationOptions,
): {
  onStateChange: () => void;
  onReady: () => void;
  cleanup: () => void;
  navigationRef: { current: NavigationContainerRef | null };
} {
  const navigationRef: { current: NavigationContainerRef | null } = { current: null };
  const mapper = options?.screenNameMapper;

  function getScreenName(ref: NavigationContainerRef): string | null {
    const route = ref.getCurrentRoute();
    if (!route) return null;
    return mapper ? mapper(route.name, route.params) : route.name;
  }

  function onReady(): void {
    if (!navigationRef.current) return;
    const screenName = getScreenName(navigationRef.current);
    if (screenName) {
      startViewSpan(screenName, 'initial');
    }
  }

  function onStateChange(): void {
    if (!navigationRef.current) return;
    const screenName = getScreenName(navigationRef.current);
    if (screenName && screenName !== previousScreenName) {
      startViewSpan(screenName, 'push');
    }
  }

  function cleanup(): void {
    endCurrentSpan();
    ActiveViewContext.clearActiveView();
    previousScreenName = null;
  }

  return { onStateChange, onReady, cleanup, navigationRef };
}

export function resetForTesting(): void {
  endCurrentSpan();
  ActiveViewContext.clearActiveView();
  previousScreenName = null;
  currentSpanId = null;
  nativeModule = null;
}
