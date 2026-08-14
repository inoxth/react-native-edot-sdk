import { EdotNativeModule } from '../nativeModule';
import { trackSpan, untrackSpan } from './spanCleanup';

export const HTTP_INSTRUMENTATION_NAME = '@inoxth/react-native-edot-sdk/http';

/** `endSpan` sentinel: end the span without setting a status at all. */
const STATUS_UNSET = -1;

/** Below this, a response is not a failure — matching apm-agent-ios and the Flutter plugin. */
const FAILURE_STATUS_FLOOR = 400;

/**
 * Mints the Request Transaction a traced request hangs under, so the request span
 * is never a root: apm-data classifies root spans as transactions, and only
 * non-root spans carry `span.destination.service.resource` — the field Kibana's
 * service map draws external edges from. See ADR-0004.
 *
 * A deliberate copy of the parent apm-agent-ios manufactures for itself: the
 * request span's name, `kind=CLIENT`, and nothing else — no attributes, no status,
 * no events. `http.url` in particular would make `ElasticSpanProcessor` treat this
 * span as the HTTP span and manufacture yet another parent for it.
 */
export function startRequestTransaction(name: string): string {
  const spanId = EdotNativeModule.startClientSpan(name, {}, null, HTTP_INSTRUMENTATION_NAME);
  trackSpan(spanId);

  return spanId;
}

/**
 * Ends a span on the request path, leaving its status unset.
 *
 * Unset is not the same as `Ok`: intake derives `event.outcome` from
 * `http.status_code` only for a span that carries no status, so setting one here
 * would report a 5xx exit span as a success. Failure is said with an exception
 * event instead — see `recordHttpFailure`.
 */
export function endHttpSpan(spanId: string): void {
  EdotNativeModule.endSpan(spanId, STATUS_UNSET);
  untrackSpan(spanId);
}

/**
 * Records a response the service answered with a failure, as the exception event
 * apm-agent-ios's own `URLSessionInstrumentation` records rather than as a span
 * status: `exception.type` is the status code, so a query can group by it, and
 * `exception.message` the reason phrase.
 *
 * Costs an APM error document per 4xx/5xx, deliberately — that is how the agent
 * reports the traffic it instruments, and it is what makes error rate see HTTP
 * failure now that no span carries a status.
 */
export function recordHttpFailure(spanId: string, statusCode: number, reasonPhrase: string): void {
  if (!spanId || statusCode < FAILURE_STATUS_FLOOR) {
    return;
  }

  EdotNativeModule.recordSpanException(spanId, {
    name: String(statusCode),
    message: reasonPhrase || `HTTP ${statusCode}`,
    stack: '',
  });
}
