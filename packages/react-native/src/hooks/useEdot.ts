import { useEffect, useRef, useState } from 'react';
import { EdotReactNative } from '../EdotReactNative';
import type { EdotConfig } from '../types';

export interface UseEdotResult {
  ready: boolean;
  error: Error | null;
}

const NATIVE_RELEVANT_KEYS = [
  'serverUrl',
  'serviceName',
  'serviceVersion',
  'deploymentEnvironment',
  'secretToken',
  'apiKey',
  'exportProtocol',
  'sessionSamplingRate',
  'trackingConsent',
  'managementUrl',
  'disableAgent',
  'enableAppMetricInstrumentation',
  'enableSystemMetrics',
  'instrumentNetworkRequests',
  'instrumentJsErrors',
  'instrumentAppStartup',
  'appStateTracking',
  'debug',
] as const satisfies ReadonlyArray<keyof EdotConfig>;

function configsDifferOnNativeKeys(a: EdotConfig, b: EdotConfig): boolean {
  for (const key of NATIVE_RELEVANT_KEYS) {
    if (a[key] !== b[key]) {
      return true;
    }
  }
  return false;
}

export function useEdot(config: EdotConfig): UseEdotResult {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initialConfigRef = useRef<EdotConfig | null>(null);

  if (initialConfigRef.current === null) {
    initialConfigRef.current = config;
  } else if (
    __DEV__ &&
    initialConfigRef.current !== config &&
    configsDifferOnNativeKeys(initialConfigRef.current, config)
  ) {
    console.warn(
      '[EDOT] useEdot received a different config after first render; only the initial config is applied.',
    );
  }

  useEffect(() => {
    let cancelled = false;
    const initialConfig = initialConfigRef.current;
    if (initialConfig === null) {
      return;
    }

    EdotReactNative.initialize(initialConfig)
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const normalized = err instanceof Error ? err : new Error(String(err));
        console.warn('[EDOT] SDK initialization failed:', normalized);
        setError(normalized);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
}
