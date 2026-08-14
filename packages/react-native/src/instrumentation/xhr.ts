import type { EdotConfig } from '../types';
import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import {
  sanitizeUrl,
  shouldIgnore,
  shouldPropagate,
  extractHost,
  extractHostname,
  extractPort,
  extractScheme,
  extractTarget,
} from './urlUtils';
import { buildGraphqlSpanName, extractGraphqlOperation, isGraphqlUrl } from './graphql';
import {
  endHttpSpan,
  HTTP_INSTRUMENTATION_NAME,
  recordHttpFailure,
  startRequestTransaction,
} from './httpSpans';
import { trackSpan } from './spanCleanup';

const DEDUP_HEADER = 'X-Edot-RN-Traced';

interface XhrState {
  method: string;
  url: string;
  spanId: string;
  transactionSpanId: string;
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
      xhrStateMap.set(this, {
        method: method.toUpperCase(),
        url,
        spanId: '',
        transactionSpanId: '',
      });
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
      let graphqlOp: ReturnType<typeof extractGraphqlOperation> = null;
      if (isGraphqlUrl(url, config.graphqlUrls) && bodyStr) {
        graphqlOp = extractGraphqlOperation(bodyStr);
        if (graphqlOp) {
          spanName = buildGraphqlSpanName(graphqlOp);
        }
      }

      const activeView = ActiveViewContext.getActiveView();

      const spanAttributes: Record<string, string | number> = {
        'http.method': method,
        'http.url': sanitizedUrl,
        'http.client': 'xhr',
      };
      if (graphqlOp) {
        spanAttributes['graphql.operation.type'] = graphqlOp.type;
        if (graphqlOp.name) {
          spanAttributes['graphql.operation.name'] = graphqlOp.name;
        }
      }
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

      state.transactionSpanId = startRequestTransaction(spanName);

      const nativeSpanId = EdotNativeModule.startClientSpan(
        spanName,
        spanAttributes,
        state.transactionSpanId,
        HTTP_INSTRUMENTATION_NAME,
      );
      state.spanId = nativeSpanId;
      trackSpan(nativeSpanId);

      originalSetRequestHeader.call(this, DEDUP_HEADER, '1');
      if (shouldPropagate(url, config.tracePropagationTargets)) {
        const traceparent = EdotNativeModule.getTraceparent(nativeSpanId);
        if (traceparent) {
          originalSetRequestHeader.call(this, 'traceparent', traceparent);
        }
      }

      if (bodyStr) {
        EdotNativeModule.setSpanAttributeNumber(
          nativeSpanId,
          'http.request_body.size',
          bodyStr.length,
        );
      }

      const endSpans = () => {
        if (!state.spanId) {
          return;
        }
        const currentSpanId = state.spanId;
        const currentTransactionSpanId = state.transactionSpanId;
        EdotNativeModule.setSpanAttributeNumber(currentSpanId, 'http.status_code', this.status);
        const responseLength = this.getResponseHeader('content-length');
        if (responseLength) {
          const parsed = Number(responseLength);
          if (Number.isFinite(parsed)) {
            EdotNativeModule.setSpanAttributeNumber(
              currentSpanId,
              'http.response_body.size',
              parsed,
            );
          }
        }
        state.spanId = '';
        state.transactionSpanId = '';
        endHttpSpan(currentSpanId);
        endHttpSpan(currentTransactionSpanId);
      };

      this.addEventListener('load', () => {
        recordHttpFailure(state.spanId, this.status, this.statusText);
        endSpans();
      });

      this.addEventListener('error', () => {
        EdotNativeModule.recordSpanException(state.spanId, {
          name: 'NetworkError',
          message: 'XHR request failed',
          stack: '',
        });
        endSpans();
      });

      this.addEventListener('timeout', () => {
        EdotNativeModule.recordSpanException(state.spanId, {
          name: 'TimeoutError',
          message: 'XHR request timed out',
          stack: '',
        });
        endSpans();
      });

      // A cancellation is recorded like any other request failure, told apart by its
      // exception type — as it is on the Flutter fleet.
      this.addEventListener('abort', () => {
        EdotNativeModule.recordSpanException(state.spanId, {
          name: 'AbortError',
          message: 'XHR request aborted',
          stack: '',
        });
        endSpans();
      });
    } catch (sdkError) {
      console.warn('[EDOT] XHR instrumentation error:', sdkError);

      const state = xhrStateMap.get(this);
      if (state?.spanId) {
        endHttpSpan(state.spanId);
        state.spanId = '';
      }
      if (state?.transactionSpanId) {
        endHttpSpan(state.transactionSpanId);
        state.transactionSpanId = '';
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
