import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';

export function setupStartupTracing(_config: EdotConfig): () => void {
  const jsBundleLoadedAt = Date.now();

  try {
    const parentSpanId = EdotNativeModule.startSpan('AppStartup: cold', {
      'app.startup.type': 'cold',
    }, null);

    const jsBundleSpanId = EdotNativeModule.startSpan('AppStartup: js_bundle_load', {}, parentSpanId);
    EdotNativeModule.setSpanAttributeNumber(
      jsBundleSpanId,
      'app.startup.js_bundle_load_ms',
      jsBundleLoadedAt,
    );
    EdotNativeModule.endSpan(jsBundleSpanId, 1);

    const firstRenderSpanId = EdotNativeModule.startSpan('AppStartup: first_render', {}, parentSpanId);

    const handle = requestIdleCallback(() => {
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
      cancelIdleCallback(handle);
    };
  } catch (sdkError) {
    console.warn('[EDOT] Failed to set up startup tracing:', sdkError);
    return () => {};
  }
}
