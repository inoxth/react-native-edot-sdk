import { EdotNativeModule } from '../nativeModule';

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_SPAN_AGE_MS = 5 * 60_000;

const activeSpans = new Map<string, number>();

export function trackSpan(spanId: string): void {
  activeSpans.set(spanId, Date.now());
}

export function untrackSpan(spanId: string): void {
  activeSpans.delete(spanId);
}

export function setupSpanCleanup(): () => void {
  const interval = setInterval(() => {
    const now = Date.now();
    const expiredIds: string[] = [];

    activeSpans.forEach((startTime, spanId) => {
      if (now - startTime > MAX_SPAN_AGE_MS) {
        expiredIds.push(spanId);
      }
    });

    for (const spanId of expiredIds) {
      EdotNativeModule.endSpan(spanId, 2); // DEADLINE_EXCEEDED mapped to ERROR
      activeSpans.delete(spanId);
    }
  }, CLEANUP_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    activeSpans.clear();
  };
}
