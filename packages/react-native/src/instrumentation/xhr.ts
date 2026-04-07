import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';
import { sanitizeUrl, shouldIgnore, shouldPropagate } from './urlUtils';
import { formatTraceparent, generateTraceId, generateSpanId } from './traceContext';
import { extractGraphqlOperationName, isGraphqlUrl } from './graphql';
import { getActiveViewContext, getActiveViewName } from '../context/ActiveViewContext';

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

  XMLHttpRequest.prototype.open = function (method: string, url: string, ...args: unknown[]) {
    try {
      xhrStateMap.set(this, { method: method.toUpperCase(), url, spanId: '' });
    } catch {
      // SDK error — ignore
    }
    return originalOpen.apply(this, [method, url, ...args] as Parameters<typeof originalOpen>);
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

      let spanName = `HTTP ${method}`;
      const bodyStr = typeof body === 'string' ? body : undefined;
      if (isGraphqlUrl(url, config.graphqlUrls) && bodyStr) {
        const opName = extractGraphqlOperationName(bodyStr);
        if (opName) {
          spanName = `GraphQL: ${opName}`;
        }
      }

      const viewContext = getActiveViewContext();
      const viewName = getActiveViewName();

      const attributes: Record<string, string> = {
        'http.method': method,
        'http.url': sanitizedUrl,
      };
      if (viewName) {
        attributes['view.name'] = viewName;
      }
      if (viewContext) {
        attributes['view.id'] = viewContext.spanId;
      }

      const nativeSpanId = EdotNativeModule.startSpan(spanName, attributes, null);
      state.spanId = nativeSpanId;

      if (viewContext) {
        EdotNativeModule.addSpanLink(nativeSpanId, viewContext.traceId, viewContext.spanId);
      }

      originalSetRequestHeader.call(this, DEDUP_HEADER, '1');
      if (shouldPropagate(url, config.tracePropagationTargets)) {
        const traceId = generateTraceId();
        const spanId = generateSpanId();
        originalSetRequestHeader.call(this, 'traceparent', formatTraceparent(traceId, spanId));
      }

      if (bodyStr) {
        EdotNativeModule.setSpanAttribute(
          nativeSpanId,
          'http.request_content_length',
          String(bodyStr.length),
        );
      }

      const endSpan = (statusCode: number) => {
        if (!state.spanId) {
          return;
        }
        EdotNativeModule.setSpanAttribute(state.spanId, 'http.status_code', String(this.status));
        const responseLength = this.getResponseHeader('content-length');
        if (responseLength) {
          EdotNativeModule.setSpanAttribute(
            state.spanId,
            'http.response_content_length',
            responseLength,
          );
        }
        EdotNativeModule.endSpan(state.spanId, statusCode);
        state.spanId = '';
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
    } catch (sdkError) {
      if (config.debug) {
        console.log('[EDOT] XHR instrumentation error:', sdkError);
      }
    }

    return originalSend.call(this, body);
  };

  return () => {
    XMLHttpRequest.prototype.open = originalOpen;
    XMLHttpRequest.prototype.send = originalSend;
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
  };
}
