import { ActiveViewContext } from '../activeViewContext';

describe('ActiveViewContext', () => {
  afterEach(() => {
    ActiveViewContext._resetForTesting();
  });

  it('returns null when no active view is set', () => {
    expect(ActiveViewContext.getActiveView()).toBeNull();
  });

  it('stores active view after setActiveView', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(ActiveViewContext.getActiveView()).toEqual({ name: 'HomeScreen', spanId: 'span-1' });
  });

  it('replaces active view on subsequent setActiveView calls', () => {
    ActiveViewContext.setActiveView({ name: 'ScreenA', spanId: 'span-a' });
    ActiveViewContext.setActiveView({ name: 'ScreenB', spanId: 'span-b' });

    expect(ActiveViewContext.getActiveView()).toEqual({ name: 'ScreenB', spanId: 'span-b' });
  });

  it('clears active view after clearActiveView', () => {
    ActiveViewContext.setActiveView({ name: 'Screen', spanId: 'span-1' });
    ActiveViewContext.clearActiveView();

    expect(ActiveViewContext.getActiveView()).toBeNull();
  });

  it('notifies listeners on setActiveView', () => {
    const listener = jest.fn();
    ActiveViewContext.addListener(listener);

    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(listener).toHaveBeenCalledWith({ name: 'HomeScreen', spanId: 'span-1' });
  });

  it('notifies listeners with null on clearActiveView', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });
    const listener = jest.fn();
    ActiveViewContext.addListener(listener);

    ActiveViewContext.clearActiveView();

    expect(listener).toHaveBeenCalledWith(null);
  });

  it('removes listener on unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = ActiveViewContext.addListener(listener);
    unsubscribe();

    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(listener).not.toHaveBeenCalled();
  });
});
