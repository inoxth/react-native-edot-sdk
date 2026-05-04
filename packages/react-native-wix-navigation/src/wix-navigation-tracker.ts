import { ActiveViewContext, getNativeModule } from '@inox/react-native-edot-shared';
import type { WixNavigation, EdotWixNavigationOptions, ComponentDidAppearEvent } from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-wix-navigation';

export function registerEdotNavigationListener(
  Navigation: WixNavigation,
  options?: EdotWixNavigationOptions,
): () => void {
  const mapper = options?.screenNameMapper;

  let currentSpanId: string | null = null;
  let previousScreenName: string | null = null;
  let lastEvent: ComponentDidAppearEvent | null = null;

  function endCurrentSpan(): void {
    if (currentSpanId) {
      getNativeModule().endSpan(currentSpanId, 1);
      currentSpanId = null;
    }
  }

  function emitForEvent(event: ComponentDidAppearEvent): void {
    const screenName = mapper ? mapper(event.componentName) : event.componentName;

    if (screenName === previousScreenName) return;

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

  const subscription = Navigation.events().registerComponentDidAppearListener(
    (event: ComponentDidAppearEvent) => {
      lastEvent = event;
      emitForEvent(event);
    },
  );

  const unregisterReEmitter = ActiveViewContext.registerForegroundReEmitter(() => {
    if (!lastEvent) return;
    previousScreenName = null;
    emitForEvent(lastEvent);
  });

  return () => {
    unregisterReEmitter();
    subscription.remove();
    endCurrentSpan();
    ActiveViewContext.clearActiveView();
    previousScreenName = null;
    lastEvent = null;
  };
}

export function resetForTesting(): void {
  if (!__DEV__) {
    return;
  }
  ActiveViewContext.clearActiveView();
}
