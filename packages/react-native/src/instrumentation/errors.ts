import { EdotNativeModule } from '../nativeModule';
import type { EdotConfig } from '../types';
import { getActiveViewContext, getActiveViewName } from '../context/ActiveViewContext';

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

declare const ErrorUtils: {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

function reportError(error: Error, source: string, isFatal: boolean): void {
  const viewContext = getActiveViewContext();
  const viewName = getActiveViewName();

  const attributes: Record<string, string> = {
    'exception.type': error.name,
    'exception.message': error.message,
    'exception.stacktrace': error.stack ?? '',
    'error.source': source,
  };
  if (viewName) {
    attributes['view.name'] = viewName;
  }
  if (viewContext) {
    attributes['view.id'] = viewContext.spanId;
  }

  const spanId = EdotNativeModule.startSpan('JS Error', attributes, null);

  if (viewContext) {
    EdotNativeModule.addSpanLink(spanId, viewContext.traceId, viewContext.spanId);
  }

  EdotNativeModule.endSpan(spanId, 2);

  EdotNativeModule.reportJsException({
    name: error.name,
    message: error.message,
    stack: error.stack ?? '',
    isFatal,
  });
}

function setupGlobalErrorHandler(debug: boolean): () => void {
  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      reportError(error, 'js_uncaught', isFatal ?? false);
    } catch (sdkError) {
      if (debug) {
        console.log('[EDOT] Error handler failed:', sdkError);
      }
    }
    previousHandler(error, isFatal);
  });

  return () => {
    ErrorUtils.setGlobalHandler(previousHandler);
  };
}

function setupPromiseRejectionHandler(debug: boolean): () => void {
  try {
    if (global.HermesInternal) {
      (global.HermesInternal as Record<string, Function>).enablePromiseRejectionTracker?.({
        allRejections: true,
        onUnhandled: (_id: number, rejection: Error | unknown) => {
          try {
            const error =
              rejection instanceof Error ? rejection : new Error(String(rejection));
            reportError(error, 'js_promise_rejection', false);
          } catch (sdkError) {
            if (debug) {
              console.log('[EDOT] Promise rejection handler failed:', sdkError);
            }
          }
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tracking = require('promise/setimmediate/rejection-tracking');
      tracking.enable({
        allRejections: true,
        onUnhandled: (_id: number, rejection: Error | unknown) => {
          try {
            const error =
              rejection instanceof Error ? rejection : new Error(String(rejection));
            reportError(error, 'js_promise_rejection', false);
          } catch (sdkError) {
            if (debug) {
              console.log('[EDOT] Promise rejection handler failed:', sdkError);
            }
          }
        },
      });
    }
  } catch (sdkError) {
    if (debug) {
      console.log('[EDOT] Failed to set up promise rejection tracking:', sdkError);
    }
  }

  return () => {
    // Promise rejection tracker doesn't support teardown
  };
}

export function setupErrorHandler(config: EdotConfig): () => void {
  const teardownGlobal = setupGlobalErrorHandler(config.debug ?? false);
  const teardownPromise = setupPromiseRejectionHandler(config.debug ?? false);

  return () => {
    teardownGlobal();
    teardownPromise();
  };
}

export { reportError };
