import { ActiveViewContext } from '@inox/react-native-edot-shared';
import type { WixNavigation, EdotWixNavigationOptions, ComponentDidAppearEvent } from './types';

interface NativeModule {
  startSpan(name: string, attributes: Record<string, string>, parentSpanId: string | null): string;
  endSpan(spanId: string, statusCode: number): void;
}

let nativeModule: NativeModule | null = null;

function getNativeModule(): NativeModule {
  if (!nativeModule) {
    const mod = require('@inox/react-native-edot-sdk/nativeModule') as {
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

export function registerEdotNavigationListener(
  Navigation: WixNavigation,
  options?: EdotWixNavigationOptions,
): () => void {
  const mapper = options?.screenNameMapper;

  const subscription = Navigation.events().registerComponentDidAppearListener(
    (event: ComponentDidAppearEvent) => {
      const screenName = mapper ? mapper(event.componentName) : event.componentName;

      if (screenName === previousScreenName) return;

      endCurrentSpan();

      const attributes: Record<string, string> = {
        'view.name': screenName,
        'view.transition_type': 'push',
      };
      if (previousScreenName) {
        attributes['view.previous'] = previousScreenName;
      }

      currentSpanId = getNativeModule().startSpan(
        `Navigation: ${screenName}`,
        attributes,
        null,
      );

      ActiveViewContext.setActiveView({ name: screenName, spanId: currentSpanId });
      previousScreenName = screenName;
    },
  );

  return () => {
    subscription.remove();
    endCurrentSpan();
    ActiveViewContext.clearActiveView();
    previousScreenName = null;
  };
}

export function resetForTesting(): void {
  endCurrentSpan();
  ActiveViewContext.clearActiveView();
  previousScreenName = null;
  currentSpanId = null;
  nativeModule = null;
}
