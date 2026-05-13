import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import {
  sanitizeUrl,
  shouldIgnore,
  shouldPropagate,
  extractMethod,
  extractUrl,
  extractHost,
  extractHostname,
  extractPort,
  extractScheme,
  extractTarget,
} from './urlUtils';
import { extractGraphqlOperationName, isGraphqlUrl } from './graphql';
import { trackSpan, untrackSpan } from './spanCleanup';

const DEDUP_HEADER = 'X-Edot-RN-Traced';

export function setupFetchInstrumentation(config: EdotConfig): () => void {
  const originalFetch = global.fetch;

  global.fetch = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const forwardInput: RequestInfo = input instanceof URL ? input.toString() : input;
    const url = extractUrl(input);

    if (shouldIgnore(url, config.ignoreUrls, config.serverUrl)) {
      return originalFetch(forwardInput, init);
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

      const activeView = ActiveViewContext.getActiveView();

      const spanAttributes: Record<string, string | number> = {
        'http.method': method,
        'http.url': sanitizedUrl,
        'http.client': 'fetch',
      };
      const scheme = extractScheme(url);
      if (scheme) spanAttributes['http.scheme'] = scheme;
      const target = extractTarget(sanitizedUrl);
      if (target) spanAttributes['http.target'] = target;
      const peerName = extractHostname(url);
      if (peerName) spanAttributes['net.peer.name'] = peerName;
      const peerPort = extractPort(url);
      if (peerPort != null) spanAttributes['net.peer.port'] = peerPort;
      if (activeView) {
        spanAttributes['screen.name'] = activeView.name;
        spanAttributes['screen.id'] = activeView.spanId;
      }

      nativeSpanId = EdotNativeModule.startClientSpan(
        spanName,
        spanAttributes,
        null,
        '@inox/react-native-edot-sdk/http',
      );
      trackSpan(nativeSpanId);

      const headers = new Headers(init?.headers);
      headers.set(DEDUP_HEADER, '1');

      if (shouldPropagate(url, config.tracePropagationTargets)) {
        const traceparent = EdotNativeModule.getTraceparent(nativeSpanId);
        if (traceparent) {
          headers.set('traceparent', traceparent);
        }
      }

      const patchedInit: RequestInit = { ...init, headers };

      if (typeof init?.body === 'string') {
        EdotNativeModule.setSpanAttributeNumber(
          nativeSpanId,
          'http.request_body.size',
          init.body.length,
        );
      }

      const response = await originalFetch(forwardInput, patchedInit);

      EdotNativeModule.setSpanAttributeNumber(nativeSpanId, 'http.status_code', response.status);

      const responseContentLength = response.headers.get('content-length');
      if (responseContentLength) {
        const parsed = Number(responseContentLength);
        if (Number.isFinite(parsed)) {
          EdotNativeModule.setSpanAttributeNumber(nativeSpanId, 'http.response_body.size', parsed);
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
          stack: error instanceof Error ? (error.stack ?? '') : '',
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
