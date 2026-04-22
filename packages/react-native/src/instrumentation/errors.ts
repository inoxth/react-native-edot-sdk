import { EdotNativeModule } from '../nativeModule';
import { ActiveViewContext } from '../activeViewContext';
import type { EdotConfig } from '../types';

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

declare const ErrorUtils: {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

function reportError(error: Error, source: string, isFatal: boolean): void {
  const activeView = ActiveViewContext.getActiveView();

  const attributes: Record<string, string> = {
    'exception.type': error.name,
    'exception.message': error.message,
    'exception.stacktrace': error.stack ?? '',
    'error.source': source,
  };
  if (activeView) {
    attributes['view.name'] = activeView.name;
  }

  const spanId = EdotNativeModule.startSpan('JS Error', attributes, null);
  EdotNativeModule.endSpan(spanId, 2);

  EdotNativeModule.reportJsException({
    name: error.name,
    message: error.message,
    stack: error.stack ?? '',
    isFatal,
  });
}

function setupGlobalErrorHandler(): () => void {
  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      reportError(error, 'js_uncaught', isFatal ?? false);
    } catch (sdkError) {
      console.warn('[EDOT] Error handler failed:', sdkError);
    }
    previousHandler(error, isFatal);
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
    } else {
      const tracking = require('promise/setimmediate/rejection-tracking');
      tracking.enable({
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
    }
  } catch (sdkError) {
    console.warn('[EDOT] Failed to set up promise rejection tracking:', sdkError);
  }

  return () => {
    // Promise rejection tracker doesn't support teardown
  };
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
