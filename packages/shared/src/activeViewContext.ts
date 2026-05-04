export interface ActiveView {
  name: string;
  spanId: string;
}

type Listener = (view: ActiveView | null) => void;
type ForegroundReEmitter = () => void;

let currentView: ActiveView | null = null;
const listeners = new Set<Listener>();
const foregroundReEmitters: ForegroundReEmitter[] = [];

function notifyListeners(view: ActiveView | null): void {
  listeners.forEach((cb) => {
    try {
      cb(view);
    } catch (err) {
      console.warn('[EDOT] ActiveViewContext listener threw:', err);
    }
  });
}

export const ActiveViewContext = {
  setActiveView(view: ActiveView): void {
    currentView = view;
    notifyListeners(currentView);
  },

  getActiveView(): ActiveView | null {
    return currentView;
  },

  clearActiveView(): void {
    currentView = null;
    notifyListeners(null);
  },

  addListener(callback: Listener): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },

  registerForegroundReEmitter(fn: ForegroundReEmitter): () => void {
    foregroundReEmitters.push(fn);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      const index = foregroundReEmitters.indexOf(fn);
      if (index !== -1) {
        foregroundReEmitters.splice(index, 1);
      }
    };
  },

  notifyForegroundReEmitters(): void {
    for (const fn of foregroundReEmitters.slice()) {
      try {
        fn();
      } catch (err) {
        console.warn('[EDOT] ActiveViewContext foreground re-emitter threw:', err);
      }
    }
  },

  /** @internal */
  _resetForTesting(): void {
    currentView = null;
    listeners.clear();
    foregroundReEmitters.length = 0;
  },
};
