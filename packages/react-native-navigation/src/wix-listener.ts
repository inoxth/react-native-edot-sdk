import { createNavigationLifecycle } from './navigation-lifecycle';
import type {
  EdotWixNavigationOptions,
  WixComponentDidAppearEvent,
  WixNavigationLike,
} from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-navigation';

export function registerEdotNavigationListener(
  Navigation: WixNavigationLike,
  options?: EdotWixNavigationOptions,
): () => void {
  const mapper = options?.screenNameMapper;

  let lastEvent: WixComponentDidAppearEvent | null = null;

  function resolveScreenName(event: WixComponentDidAppearEvent): string {
    return mapper ? mapper(event.componentName) : event.componentName;
  }

  const lifecycle = createNavigationLifecycle({
    instrumentationName: INSTRUMENTATION_NAME,
    getCurrentScreenName: () => (lastEvent ? resolveScreenName(lastEvent) : null),
  });

  const subscription = Navigation.events().registerComponentDidAppearListener(
    (event: WixComponentDidAppearEvent) => {
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
