import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import { sanitizeUrl, shouldIgnore, shouldPropagate, extractHost } from './urlUtils';
import { formatTraceparent, generateTraceId, generateSpanId } from './traceContext';
import { extractGraphqlOperationName, isGraphqlUrl } from './graphql';
import { trackSpan, untrackSpan } from './spanCleanup';

const DEDUP_HEADER = 'X-Edot-RN-Traced';

interface XhrState {
  method: string;
  url: string;
  spanId: string;
}

const xhrStateMap = new WeakMap<XMLHttpRequest, XhrState>();

export function setupXhrInstrumentation(config: EdotConfig): () => void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    ...args: Parameters<typeof originalOpen>
  ): ReturnType<typeof originalOpen> {
    const [method, url] = args;
    try {
      xhrStateMap.set(this, { method: method.toUpperCase(), url, spanId: '' });
    } catch (sdkError) {
      console.warn('[EDOT] XHR open instrumentation error:', sdkError);
    }
    return originalOpen.apply(this, args);
  };

  XMLHttpRequest.prototype.send = function (body?: string | null) {
    try {
      const state = xhrStateMap.get(this);
      if (!state) {
        return originalSend.call(this, body);
      }

      const { method, url } = state;

      if (shouldIgnore(url, config.ignoreUrls, config.serverUrl)) {
        xhrStateMap.delete(this);
        return originalSend.call(this, body);
      }

      const sanitizedUrl = sanitizeUrl(url, config.urlSanitizer);
      const host = extractHost(url);

      let spanName = host ? `${method} ${host}` : `HTTP ${method}`;
      const bodyStr = typeof body === 'string' ? body : undefined;
      if (isGraphqlUrl(url, config.graphqlUrls) && bodyStr) {
        const opName = extractGraphqlOperationName(bodyStr);
        if (opName) {
          spanName = `GraphQL: ${opName}`;
        }
      }

      const activeView = ActiveViewContext.getActiveView();

      const spanAttributes: Record<string, string> = {
        'http.request.method': method,
        'url.full': sanitizedUrl,
      };
      if (activeView) {
        spanAttributes['view.name'] = activeView.name;
        spanAttributes['view.id'] = activeView.spanId;
      }

      const nativeSpanId = EdotNativeModule.startSpan(spanName, spanAttributes, null);
      state.spanId = nativeSpanId;
      trackSpan(nativeSpanId);

      originalSetRequestHeader.call(this, DEDUP_HEADER, '1');
      if (shouldPropagate(url, config.tracePropagationTargets)) {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        originalSetRequestHeader.call(this, 'traceparent', formatTraceparent(traceId, spanId));
      }

      if (bodyStr) {
        EdotNativeModule.setSpanAttributeNumber(
          nativeSpanId,
          'http.request.body.size',
          bodyStr.length,
        );
      }

      const endSpan = (statusCode: number) => {
        if (!state.spanId) {
          return;
        }
        const currentSpanId = state.spanId;
        EdotNativeModule.setSpanAttributeNumber(currentSpanId, 'http.response.status_code', this.status);
        const responseLength = this.getResponseHeader('content-length');
        if (responseLength) {
          const parsed = Number(responseLength);
          if (Number.isFinite(parsed)) {
            EdotNativeModule.setSpanAttributeNumber(
              currentSpanId,
              'http.response.body.size',
              parsed,
            );
          }
        }
        EdotNativeModule.endSpan(currentSpanId, statusCode);
        state.spanId = '';
        untrackSpan(currentSpanId);
      };

      this.addEventListener('load', () => {
        endSpan(this.status >= 400 ? 2 : 1);
      });

      this.addEventListener('error', () => {
        EdotNativeModule.recordSpanException(state.spanId, {
          name: 'NetworkError',
          message: 'XHR request failed',
          stack: '',
        });
        endSpan(2);
      });

      this.addEventListener('timeout', () => {
        EdotNativeModule.recordSpanException(state.spanId, {
          name: 'TimeoutError',
          message: 'XHR request timed out',
          stack: '',
        });
        endSpan(2);
      });

      this.addEventListener('abort', () => {
        endSpan(0);
      });
    } catch (sdkError) {
      console.warn('[EDOT] XHR instrumentation error:', sdkError);
    }

    return originalSend.call(this, body);
  };

  return () => {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
  };
}
