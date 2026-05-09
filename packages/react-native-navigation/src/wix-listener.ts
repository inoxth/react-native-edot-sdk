import { createNavigationLifecycle } from './navigation-lifecycle';
import type {
  EdotWixNavigationOptions,
  WixComponentDidAppearEvent,
  WixNavigationLike,
} from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-sdk/navigation';

export function registerEdotNavigationListener(
  Navigation: WixNavigationLike,
  options?: EdotWixNavigationOptions,
): () => void {
  const mapper = options?.screenNameMapper;

  function resolveScreenName(event: WixComponentDidAppearEvent): string {
    return mapper ? mapper(event.componentName) : event.componentName;
  }

  const lifecycle = createNavigationLifecycle({
    instrumentationName: INSTRUMENTATION_NAME,
  });

  const subscription = Navigation.events().registerComponentDidAppearListener(
    (event: WixComponentDidAppearEvent) => {
      lifecycle.onScreen(resolveScreenName(event));
    },
  );

  return () => {
    subscription.remove();
    lifecycle.cleanup();
  };
}
