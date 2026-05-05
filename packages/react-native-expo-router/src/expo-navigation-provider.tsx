import React, { useEffect, useRef } from 'react';
import { createNavigationLifecycle } from '@inox/react-native-edot-navigation';
import type {
  EdotExpoNavigationProviderProps,
  ExpoNavigationContainerRef,
} from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-expo-router';

type ScreenNameMapper = (routeName: string, params?: object) => string;

function resolveScreenName(
  navigationRef: ExpoNavigationContainerRef,
  mapper: ScreenNameMapper | undefined,
): string | null {
  const route = navigationRef.getCurrentRoute();
  if (!route) return null;
  return mapper ? mapper(route.name, route.params) : route.name;
}

export function EdotExpoNavigationProvider({
  navigationRef,
  screenNameMapper,
  children,
}: EdotExpoNavigationProviderProps): React.ReactElement {
  const mapperRef = useRef<ScreenNameMapper | undefined>(screenNameMapper);
  mapperRef.current = screenNameMapper;

  useEffect(() => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: INSTRUMENTATION_NAME,
      getCurrentScreenName: () => resolveScreenName(navigationRef, mapperRef.current),
    });

    const emitCurrent = (): void => {
      const screenName = resolveScreenName(navigationRef, mapperRef.current);
      if (screenName) lifecycle.onScreen(screenName);
    };

    emitCurrent();
    const unsubscribe = navigationRef.addListener('state', emitCurrent);

    return () => {
      unsubscribe();
      lifecycle.cleanup();
    };
  }, [navigationRef]);

  return React.createElement(React.Fragment, null, children);
}
