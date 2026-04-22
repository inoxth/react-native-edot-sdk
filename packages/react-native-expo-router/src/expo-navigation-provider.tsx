import React, { useEffect, useRef } from 'react';
import { ActiveViewContext, getNativeModule } from '@inox/react-native-edot-shared';
import type { EdotExpoNavigationProviderProps } from './types';

interface ExpoRouterModule {
  usePathname(): string;
}

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
  const previousPathnameRef = useRef<string | null>(null);

  const pathname = usePathnameHook();
  const displayName = screenNameMapper ? screenNameMapper(pathname) : pathname;

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    if (currentSpanIdRef.current) {
      getNativeModule().endSpan(currentSpanIdRef.current, 1);
    }

    const attributes: Record<string, string> = {
      'view.name': displayName,
      'view.url': pathname,
      'view.transition_type': previousPathnameRef.current ? 'push' : 'initial',
    };
    if (previousPathnameRef.current) {
      attributes['view.previous'] = previousPathnameRef.current;
    }

    const spanId = getNativeModule().startSpan(
      `Navigation: ${displayName}`,
      attributes,
      null,
    );

    currentSpanIdRef.current = spanId;
    previousPathnameRef.current = pathname;

    ActiveViewContext.setActiveView({ name: displayName, spanId });

    return () => {
      getNativeModule().endSpan(spanId, 1);
      currentSpanIdRef.current = null;
      ActiveViewContext.clearActiveView();
    };
  }, [pathname, displayName]);

  return React.createElement(React.Fragment, null, children);
}

export function resetNativeModuleForTesting(): void {
  if (!__DEV__) {
    return;
  }
}
