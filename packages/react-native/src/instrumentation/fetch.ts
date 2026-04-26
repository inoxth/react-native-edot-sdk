import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import { sanitizeUrl, shouldIgnore, shouldPropagate, extractMethod, extractUrl, extractHost } from './urlUtils';
import { formatTraceparent, generateTraceId, generateSpanId } from './traceContext';
import { extractGraphqlOperationName, isGraphqlUrl } from './graphql';
import { trackSpan, untrackSpan } from './spanCleanup';

const DEDUP_HEADER = 'X-Edot-RN-Traced';

export function setupFetchInstrumentation(config: EdotConfig): () => void {
  const originalFetch = global.fetch;

  global.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = extractUrl(input);

    if (shouldIgnore(url, config.ignoreUrls, config.serverUrl)) {
      return originalFetch(input, init);
    }

    let nativeSpanId: string | undefined;
    try {
      const method = extractMethod(input, init);
      const sanitizedUrl = sanitizeUrl(url, config.urlSanitizer);
      const host = extractHost(url);

      let spanName = host ? `${method} ${host}` : `HTTP ${method}`;
      if (isGraphqlUrl(url, config.graphqlUrls) && typeof init?.body === 'string') {
        const opName = extractGraphqlOperationName(init.body);
        if (opName) {
          spanName = `GraphQL: ${opName}`;
        }
      }

      const traceId = generateTraceId();
      const spanId = generateSpanId();

      const activeView = ActiveViewContext.getActiveView();

      const spanAttributes: Record<string, string> = {
        'http.request.method': method,
        'url.full': sanitizedUrl,
      };
      if (activeView) {
        spanAttributes['view.name'] = activeView.name;
        spanAttributes['view.id'] = activeView.spanId;
      }

      nativeSpanId = EdotNativeModule.startSpan(spanName, spanAttributes, null);
      trackSpan(nativeSpanId);

      const headers = new Headers(init?.headers);
      headers.set(DEDUP_HEADER, '1');

      if (shouldPropagate(url, config.tracePropagationTargets)) {
        headers.set('traceparent', formatTraceparent(traceId, spanId));
      }

      const patchedInit: RequestInit = { ...init, headers };

      if (typeof init?.body === 'string') {
        EdotNativeModule.setSpanAttributeNumber(nativeSpanId, 'http.request.body.size', init.body.length);
      }

      const response = await originalFetch(input, patchedInit);

      EdotNativeModule.setSpanAttributeNumber(nativeSpanId, 'http.response.status_code', response.status);

      const responseContentLength = response.headers.get('content-length');
      if (responseContentLength) {
        const parsed = Number(responseContentLength);
        if (Number.isFinite(parsed)) {
          EdotNativeModule.setSpanAttributeNumber(nativeSpanId, 'http.response.body.size', parsed);
        }
      }

      // OTel StatusCode: 1=Ok, 2=Error
      EdotNativeModule.endSpan(nativeSpanId, response.ok ? 1 : 2);
      untrackSpan(nativeSpanId);

      return response;
    } catch (error) {
      if (nativeSpanId) {
        EdotNativeModule.recordSpanException(nativeSpanId, {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack ?? '' : '',
        });
        EdotNativeModule.endSpan(nativeSpanId, 2);
        untrackSpan(nativeSpanId);
      }
      throw error;
    }
  };

  return () => {
    global.fetch = originalFetch;
  };
}
