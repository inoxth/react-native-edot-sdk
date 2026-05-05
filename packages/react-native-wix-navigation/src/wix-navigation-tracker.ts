import { createNavigationLifecycle } from '@inox/react-native-edot-navigation';
import type { WixNavigation, EdotWixNavigationOptions, ComponentDidAppearEvent } from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-wix-navigation';

export function registerEdotNavigationListener(
  Navigation: WixNavigation,
  options?: EdotWixNavigationOptions,
): () => void {
  const mapper = options?.screenNameMapper;

  let lastEvent: ComponentDidAppearEvent | null = null;

  function resolveScreenName(event: ComponentDidAppearEvent): string {
    return mapper ? mapper(event.componentName) : event.componentName;
  }

  const lifecycle = createNavigationLifecycle({
    instrumentationName: INSTRUMENTATION_NAME,
    getCurrentScreenName: () => (lastEvent ? resolveScreenName(lastEvent) : null),
  });

  const subscription = Navigation.events().registerComponentDidAppearListener(
    (event: ComponentDidAppearEvent) => {
      lastEvent = event;
      lifecycle.onScreen(resolveScreenName(event));
    },
  );

  return () => {
    subscription.remove();
    lifecycle.cleanup();
    lastEvent = null;
  };
}

export function resetForTesting(): void {
  if (!__DEV__) {
    return;
  }
}
