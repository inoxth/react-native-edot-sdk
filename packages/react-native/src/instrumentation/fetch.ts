import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import { sanitizeUrl, shouldIgnore, shouldPropagate, extractMethod, extractUrl } from './urlUtils';
import { formatTraceparent, generateTraceId, generateSpanId } from './traceContext';
import { extractGraphqlOperationName, isGraphqlUrl } from './graphql';

const DEDUP_HEADER = 'X-Edot-RN-Traced';

export function setupFetchInstrumentation(config: EdotConfig): () => void {
  const originalFetch = global.fetch;

  global.fetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    try {
      const url = extractUrl(input);

      if (shouldIgnore(url, config.ignoreUrls, config.serverUrl)) {
        return originalFetch(input, init);
      }

      const method = extractMethod(input, init);
      const sanitizedUrl = sanitizeUrl(url, config.urlSanitizer);

      let spanName = `HTTP ${method}`;
      const body = init?.body as string | undefined;
      if (isGraphqlUrl(url, config.graphqlUrls) && body) {
        const opName = extractGraphqlOperationName(body);
        if (opName) {
          spanName = `GraphQL: ${opName}`;
        }
      }

      const traceId = generateTraceId();
      const spanId = generateSpanId();

      const activeView = ActiveViewContext.getActiveView();

      const spanAttributes: Record<string, string> = {
        'http.method': method,
        'http.url': sanitizedUrl,
      };
      if (activeView) {
        spanAttributes['view.name'] = activeView.name;
        spanAttributes['view.id'] = activeView.spanId;
      }

      const nativeSpanId = EdotNativeModule.startSpan(spanName, spanAttributes, null);

      const headers = new Headers(init?.headers);
      headers.set(DEDUP_HEADER, '1');

      if (shouldPropagate(url, config.tracePropagationTargets)) {
        headers.set('traceparent', formatTraceparent(traceId, spanId));
      }

      const patchedInit: RequestInit = { ...init, headers };

      if (init?.body) {
        const contentLength = typeof init.body === 'string' ? init.body.length : undefined;
        if (contentLength !== undefined) {
          EdotNativeModule.setSpanAttribute(nativeSpanId, 'http.request_content_length', String(contentLength));
        }
      }

      try {
        const response = await originalFetch(input, patchedInit);

        EdotNativeModule.setSpanAttribute(nativeSpanId, 'http.status_code', String(response.status));

        const responseContentLength = response.headers.get('content-length');
        if (responseContentLength) {
          EdotNativeModule.setSpanAttribute(nativeSpanId, 'http.response_content_length', responseContentLength);
        }

        const statusCode = response.ok ? 1 : 2; // 1=OK, 2=ERROR
        EdotNativeModule.endSpan(nativeSpanId, statusCode);

        return response;
      } catch (error) {
        EdotNativeModule.recordSpanException(nativeSpanId, {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack ?? '' : '',
        });
        EdotNativeModule.endSpan(nativeSpanId, 2);
        throw error;
      }
    } catch (sdkError) {
      if (config.debug) {
        console.log('[EDOT] Fetch instrumentation error:', sdkError);
      }
      return originalFetch(input, init);
    }
  };

  return () => {
    global.fetch = originalFetch;
  };
}
