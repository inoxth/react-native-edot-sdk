import React, { useEffect, useRef } from 'react';
import { createNavigationLifecycle } from './navigation-lifecycle';
import type { NavigationContainerRefLike, RefScreenNameMapper } from './types';

const INSTRUMENTATION_NAME = '@inox/react-native-edot-navigation';

export interface EdotNavigationProviderProps {
  navigationRef: NavigationContainerRefLike;
  screenNameMapper?: RefScreenNameMapper;
  children?: React.ReactNode;
}

function resolveScreenName(
  navigationRef: NavigationContainerRefLike,
  mapper: RefScreenNameMapper | undefined,
): string | null {
  const route = navigationRef.getCurrentRoute();
  if (!route) return null;
  return mapper ? mapper(route.name, route.params) : route.name;
}

export function EdotNavigationProvider({
  navigationRef,
  screenNameMapper,
  children,
}: EdotNavigationProviderProps): React.ReactElement {
  const mapperRef = useRef<RefScreenNameMapper | undefined>(screenNameMapper);
  mapperRef.current = screenNameMapper;

  useEffect(() => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: INSTRUMENTATION_NAME,
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
