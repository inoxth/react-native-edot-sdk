export interface ActiveView {
  name: string;
  spanId: string;
}

type Listener = (view: ActiveView | null) => void;

let currentView: ActiveView | null = null;
const listeners = new Set<Listener>();

export const ActiveViewContext = {
  setActiveView(view: ActiveView): void {
    currentView = view;
    listeners.forEach((cb) => cb(currentView));
  },

  getActiveView(): ActiveView | null {
    return currentView;
  },

  clearActiveView(): void {
    currentView = null;
    listeners.forEach((cb) => cb(null));
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
