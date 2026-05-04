import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

type RejectionTracking = {
  enable: (opts: RejectionTrackingOptions) => void;
  disable?: () => void;
};

type RejectionTrackingOptions = {
  allRejections: boolean;
  onUnhandled: (id: number, rejection: unknown) => void;
};

function isRejectionTracking(value: unknown): value is RejectionTracking {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enable' in value &&
    typeof (value as Record<string, unknown>).enable === 'function'
  );
}

function hasErrorUtils(): boolean {
  return (
    typeof ErrorUtils !== 'undefined' &&
    typeof ErrorUtils.getGlobalHandler === 'function' &&
    typeof ErrorUtils.setGlobalHandler === 'function'
  );
}

function reportError(error: Error, source: string, isFatal: boolean): void {
  const activeView = ActiveViewContext.getActiveView();

  const attributes: Record<string, string> = {
    'exception.type': error.name,
    'exception.message': error.message,
    'exception.stacktrace': error.stack ?? '',
    'error.source': source,
  };
  if (activeView) {
    attributes['screen.name'] = activeView.name;
    attributes['screen.id'] = activeView.spanId;
  }

  const spanId = EdotNativeModule.startSpan(
    'JS Error',
    attributes,
    null,
    '@inox/react-native-edot-sdk/errors',
  );
  EdotNativeModule.endSpan(spanId, 2);

  EdotNativeModule.reportJsException({
    name: error.name,
    message: error.message,
    stack: error.stack ?? '',
    isFatal,
  });
}

function setupGlobalErrorHandler(): () => void {
  if (!hasErrorUtils()) {
    console.warn('[EDOT] ErrorUtils is not available — global error handler not installed');
    return () => {};
  }

  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      reportError(error, 'js_uncaught', isFatal ?? false);
    } catch (sdkError) {
      console.warn('[EDOT] Error handler failed:', sdkError);
    }
    previousHandler(error, isFatal ?? false);
  });

  return () => {
    ErrorUtils.setGlobalHandler(previousHandler);
  };
}

function setupPromiseRejectionHandler(): () => void {
  try {
    const hermes = global.HermesInternal;
    if (hermes?.enablePromiseRejectionTracker) {
      hermes.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, rejection: unknown) => {
          try {
            const error = rejection instanceof Error ? rejection : new Error(String(rejection));
            reportError(error, 'js_promise_rejection', false);
          } catch (sdkError) {
            console.warn('[EDOT] Promise rejection handler failed:', sdkError);
          }
        },
      });
      return () => {};
    }

    const tracking: unknown = require('promise/setimmediate/rejection-tracking');

    if (!isRejectionTracking(tracking)) {
      console.warn(
        '[EDOT] rejection-tracking module has unexpected shape — promise rejection handler not installed',
      );
      return () => {};
    }

    let active = true;

    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => {
        if (!active) return;
        try {
          const error = rejection instanceof Error ? rejection : new Error(String(rejection));
          reportError(error, 'js_promise_rejection', false);
        } catch (sdkError) {
          console.warn('[EDOT] Promise rejection handler failed:', sdkError);
        }
      },
    });

    return () => {
      // Prevent stale closure callbacks from running after teardown (avoids cross-test pollution)
      active = false;
      if (typeof tracking.disable === 'function') {
        tracking.disable();
      }
    };
  } catch (sdkError) {
    console.warn('[EDOT] Failed to set up promise rejection tracking:', sdkError);
  }

  return () => {};
}

export function setupErrorHandler(_config: EdotConfig): () => void {
  const teardownGlobal = setupGlobalErrorHandler();
  const teardownPromise = setupPromiseRejectionHandler();

  return () => {
    teardownGlobal();
    teardownPromise();
  };
}

export { reportError };
