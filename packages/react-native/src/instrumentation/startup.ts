import { InteractionManager } from 'react-native';
import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';

export function setupStartupTracing(config: EdotConfig): () => void {
  const jsBundleLoadedAt = Date.now();

  try {
    const parentSpanId = EdotNativeModule.startSpan('AppStartup: cold', {
      'app.startup.type': 'cold',
    }, null);

    const jsBundleSpanId = EdotNativeModule.startSpan('AppStartup: js_bundle_load', {}, parentSpanId);
    EdotNativeModule.setSpanAttribute(
      jsBundleSpanId,
      'app.startup.js_bundle_load_ms',
      String(jsBundleLoadedAt),
    );
    EdotNativeModule.endSpan(jsBundleSpanId, 1);

    const firstRenderSpanId = EdotNativeModule.startSpan('AppStartup: first_render', {}, parentSpanId);

    const handle = InteractionManager.runAfterInteractions(() => {
      try {
        const firstRenderAt = Date.now();
        EdotNativeModule.setSpanAttribute(
          firstRenderSpanId,
          'app.startup.first_render_ms',
          String(firstRenderAt - jsBundleLoadedAt),
        );
        EdotNativeModule.endSpan(firstRenderSpanId, 1);

        EdotNativeModule.setSpanAttribute(
          parentSpanId,
          'app.startup.duration_ms',
          String(firstRenderAt - jsBundleLoadedAt),
        );
        EdotNativeModule.endSpan(parentSpanId, 1);
      } catch (sdkError) {
        if (config.debug) {
          console.log('[EDOT] Startup first render tracking error:', sdkError);
        }
      }
    });

    return () => {
      handle.cancel();
    };
  } catch (sdkError) {
    if (config.debug) {
      console.log('[EDOT] Failed to set up startup tracing:', sdkError);
    }
    return () => {};
  }
}
