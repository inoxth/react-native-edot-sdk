import React, { useEffect, useRef } from 'react';
import { ActiveViewContext } from '@inox-edot/react-native/active-view-context';
import type { EdotExpoNavigationProviderProps } from './types';

interface NativeModule {
  startSpan(name: string, attributes: Record<string, string>, parentSpanId: string | null): string;
  endSpan(spanId: string, statusCode: number): void;
}

let nativeModule: NativeModule | null = null;

function getNativeModule(): NativeModule {
  if (!nativeModule) {
    const mod = require('@inox-edot/react-native/nativeModule') as {
      EdotNativeModule: NativeModule;
    };
    nativeModule = mod.EdotNativeModule;
  }
  return nativeModule;
}

export function EdotExpoNavigationProvider({
  screenNameMapper,
  children,
}: EdotExpoNavigationProviderProps): React.ReactElement {
  const currentSpanIdRef = useRef<string | null>(null);
  const previousPathnameRef = useRef<string | null>(null);

  let pathname: string;
  try {
    const expoRouter = require('expo-router') as {
      usePathname(): string;
    };
    pathname = expoRouter.usePathname();
  } catch {
    pathname = '/';
  }

  const displayName = screenNameMapper ? screenNameMapper(pathname) : pathname;

  useEffect(() => {
    if (displayName === previousPathnameRef.current) return;

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
    previousPathnameRef.current = displayName;

    ActiveViewContext.setActiveView({ name: displayName, spanId });
  }, [displayName, pathname]);

  useEffect(() => {
    return () => {
      if (currentSpanIdRef.current) {
        getNativeModule().endSpan(currentSpanIdRef.current, 1);
        currentSpanIdRef.current = null;
      }
      ActiveViewContext.clearActiveView();
    };
  }, []);

  return React.createElement(React.Fragment, null, children);
}

export function resetNativeModuleForTesting(): void {
  nativeModule = null;
}
