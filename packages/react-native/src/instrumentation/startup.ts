import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';

type IdleHandle =
  | { kind: 'idle'; id: number }
  | { kind: 'timeout'; id: ReturnType<typeof setTimeout> };

function scheduleIdle(cb: () => void): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    return { kind: 'idle', id: requestIdleCallback(cb) };
  }
  return { kind: 'timeout', id: setTimeout(cb, 0) };
}

function cancelIdle(handle: IdleHandle): void {
  if (handle.kind === 'idle') {
    cancelIdleCallback(handle.id);
  } else {
    clearTimeout(handle.id);
  }
}

export function setupStartupTracing(_config: EdotConfig): () => void {
  const jsBundleLoadedAt = Date.now();

  try {
    const startupScope = '@inoxth/react-native-edot-sdk/startup';
    const parentSpanId = EdotNativeModule.startSpan(
      'AppStartup: cold',
      { 'app.startup.type': 'cold' },
      null,
      startupScope,
    );

    const jsBundleSpanId = EdotNativeModule.startSpan(
      'AppStartup: js_bundle_load',
      {},
      parentSpanId,
      startupScope,
    );
    EdotNativeModule.setSpanAttributeNumber(
      jsBundleSpanId,
      'app.startup.js_bundle_load_ms',
      jsBundleLoadedAt,
    );
    EdotNativeModule.endSpan(jsBundleSpanId, 1);

    const firstRenderSpanId = EdotNativeModule.startSpan(
      'AppStartup: first_render',
      {},
      parentSpanId,
      startupScope,
    );

    const handle = scheduleIdle(() => {
      try {
        const firstRenderAt = Date.now();
        EdotNativeModule.setSpanAttributeNumber(
          firstRenderSpanId,
          'app.startup.first_render_ms',
          firstRenderAt - jsBundleLoadedAt,
        );
        EdotNativeModule.endSpan(firstRenderSpanId, 1);

        EdotNativeModule.setSpanAttributeNumber(
          parentSpanId,
          'app.startup.duration_ms',
          firstRenderAt - jsBundleLoadedAt,
        );
        EdotNativeModule.endSpan(parentSpanId, 1);
      } catch (sdkError) {
        console.warn('[EDOT] Startup first render tracking error:', sdkError);
      }
    });

    return () => {
      cancelIdle(handle);
    };
  } catch (sdkError) {
    console.warn('[EDOT] Failed to set up startup tracing:', sdkError);
    return () => {};
  }
}
