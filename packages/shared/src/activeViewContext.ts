export interface ActiveView {
  name: string;
  spanId: string;
}

type Listener = (view: ActiveView | null) => void;

let currentView: ActiveView | null = null;
const listeners = new Set<Listener>();

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

  /** @internal */
  _resetForTesting(): void {
    currentView = null;
    listeners.clear();
  },
};
