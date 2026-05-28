import { InteractionManager } from 'react-native';
import { ActiveViewContext, getNativeModule } from '@inoxth/react-native-edot-shared';

const STATUS_OK = 1;

export interface NavigationLifecycle {
  onScreen: (screenName: string) => void;
  markScreenLoaded: () => void;
  cleanup: () => void;
}

export interface CreateNavigationLifecycleOptions {
  instrumentationName: string;
}

interface PendingEndHandle {
  cancel: () => void;
}

let activeMarkLoaded: (() => void) | null = null;

export function markCurrentScreenLoaded(): void {
  activeMarkLoaded?.();
}

export function createNavigationLifecycle(
  options: CreateNavigationLifecycleOptions,
): NavigationLifecycle {
  let currentSpanId: string | null = null;
  let previousScreenName: string | null = null;
  let pendingHandle: PendingEndHandle | null = null;

  function endCurrentSpan(): void {
    if (pendingHandle) {
      pendingHandle.cancel();
      pendingHandle = null;
    }
    if (currentSpanId) {
      getNativeModule().endSpan(currentSpanId, STATUS_OK);
      currentSpanId = null;
    }
  }

  function startViewSpan(screenName: string): void {
    endCurrentSpan();

    const attributes: Record<string, string> = {
      'screen.name': screenName,
    };
    if (previousScreenName && previousScreenName !== screenName) {
      attributes['last.screen.name'] = previousScreenName;
    }

    const newSpanId = getNativeModule().startSpan(
      `${screenName} - view appearing`,
      attributes,
      null,
      options.instrumentationName,
    );
    currentSpanId = newSpanId;
    ActiveViewContext.setActiveView({ name: screenName, spanId: newSpanId });
    previousScreenName = screenName;

    // Auto-end on JS-thread idle. Capture spanId so a fast next-nav
    // can't end the new span by accident.
    pendingHandle = InteractionManager.runAfterInteractions(() => {
      if (currentSpanId === newSpanId) {
        getNativeModule().endSpan(newSpanId, STATUS_OK);
        currentSpanId = null;
        pendingHandle = null;
      }
    });
  }

  function onScreen(screenName: string): void {
    if (screenName !== previousScreenName) {
      startViewSpan(screenName);
    }
  }

  function markScreenLoaded(): void {
    endCurrentSpan();
  }

  activeMarkLoaded = markScreenLoaded;

  function cleanup(): void {
    if (activeMarkLoaded === markScreenLoaded) {
      activeMarkLoaded = null;
    }
    endCurrentSpan();
    ActiveViewContext.clearActiveView();
    previousScreenName = null;
  }

  return { onScreen, markScreenLoaded, cleanup };
}
