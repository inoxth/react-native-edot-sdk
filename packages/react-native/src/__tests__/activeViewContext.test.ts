import { ActiveViewContext } from '../activeViewContext';

describe('ActiveViewContext', () => {
  beforeEach(() => {
    ActiveViewContext._resetForTesting();
  });

  it('returns null when no view is set', () => {
    expect(ActiveViewContext.getActiveView()).toBeNull();
  });

  it('sets and gets the active view', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(ActiveViewContext.getActiveView()).toEqual({ name: 'HomeScreen', spanId: 'span-1' });
  });

  it('clears the active view', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });
    ActiveViewContext.clearActiveView();

    expect(ActiveViewContext.getActiveView()).toBeNull();
  });

  it('overwrites on subsequent set calls', () => {
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });
    ActiveViewContext.setActiveView({ name: 'ProductDetail', spanId: 'span-2' });

    expect(ActiveViewContext.getActiveView()).toEqual({ name: 'ProductDetail', spanId: 'span-2' });
  });

  it('notifies listener on setActiveView', () => {
    const listener = jest.fn();
    ActiveViewContext.addListener(listener);

    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(listener).toHaveBeenCalledWith({ name: 'HomeScreen', spanId: 'span-1' });
  });

  it('notifies listener on clearActiveView', () => {
    const listener = jest.fn();
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });
    ActiveViewContext.addListener(listener);

    ActiveViewContext.clearActiveView();

    expect(listener).toHaveBeenCalledWith(null);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = ActiveViewContext.addListener(listener);

    unsubscribe();
    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    ActiveViewContext.addListener(listener1);
    ActiveViewContext.addListener(listener2);

    ActiveViewContext.setActiveView({ name: 'HomeScreen', spanId: 'span-1' });

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });
});
