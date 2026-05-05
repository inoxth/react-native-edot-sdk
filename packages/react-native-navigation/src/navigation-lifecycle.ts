import { ActiveViewContext, getNativeModule } from '@inox/react-native-edot-shared';

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
