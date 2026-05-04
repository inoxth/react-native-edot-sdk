import React, { useEffect, useRef } from 'react';
import { ActiveViewContext, getNativeModule } from '@inox/react-native-edot-shared';
import type { EdotExpoNavigationProviderProps } from './types';

interface ExpoRouterModule {
  usePathname(): string;
}

const INSTRUMENTATION_NAME = '@inox/react-native-edot-expo-router';

function resolveUsePathname(): () => string {
  try {
    const mod: unknown = require('expo-router');
    if (
      mod !== null &&
      typeof mod === 'object' &&
      'usePathname' in mod &&
      typeof (mod as ExpoRouterModule).usePathname === 'function'
    ) {
      return (mod as ExpoRouterModule).usePathname.bind(mod as ExpoRouterModule);
    }
  } catch {
    // expo-router not available
  }
  return () => '/';
}

const usePathnameHook = resolveUsePathname();

export function EdotExpoNavigationProvider({
  screenNameMapper,
  children,
}: EdotExpoNavigationProviderProps): React.ReactElement {
  const currentSpanIdRef = useRef<string | null>(null);
  const previousScreenNameRef = useRef<string | null>(null);
  const latestScreenNameRef = useRef<string | null>(null);

  const pathname = usePathnameHook();
  const displayName = screenNameMapper ? screenNameMapper(pathname) : pathname;
  latestScreenNameRef.current = displayName;

  useEffect(() => {
    const startSpanForCurrentScreen = (): void => {
      const screenName = latestScreenNameRef.current;
      if (!screenName) return;

      if (currentSpanIdRef.current) {
        getNativeModule().endSpan(currentSpanIdRef.current, 1);
        currentSpanIdRef.current = null;
      }

      const attributes: Record<string, string> = {
        'screen.name': screenName,
      };
      if (previousScreenNameRef.current && previousScreenNameRef.current !== screenName) {
        attributes['last.screen.name'] = previousScreenNameRef.current;
      }

      const spanId = getNativeModule().startSpan(
        screenName,
        attributes,
        null,
        INSTRUMENTATION_NAME,
      );

      currentSpanIdRef.current = spanId;
      previousScreenNameRef.current = screenName;

      ActiveViewContext.setActiveView({ name: screenName, spanId });
    };

    if (previousScreenNameRef.current !== displayName) {
      startSpanForCurrentScreen();
    }

    const unregisterReEmitter = ActiveViewContext.registerForegroundReEmitter(() => {
      previousScreenNameRef.current = null;
      startSpanForCurrentScreen();
    });

    return () => {
      unregisterReEmitter();
      if (currentSpanIdRef.current) {
        getNativeModule().endSpan(currentSpanIdRef.current, 1);
        currentSpanIdRef.current = null;
      }
      ActiveViewContext.clearActiveView();
    };
  }, [displayName]);

  return React.createElement(React.Fragment, null, children);
}

export function resetNativeModuleForTesting(): void {
  if (!__DEV__) {
    return;
  }
}
