import {
  setActiveView,
  clearActiveView,
  getActiveViewContext,
  getActiveViewName,
} from '../context/ActiveViewContext';

describe('ActiveViewContext', () => {
  afterEach(() => {
    clearActiveView();
  });

  it('returns null when no active view is set', () => {
    expect(getActiveViewContext()).toBeNull();
    expect(getActiveViewName()).toBeNull();
  });

  it('stores view context and name after setActiveView', () => {
    const context = { traceId: 'trace-1', spanId: 'span-1' };
    setActiveView(context, 'HomeScreen');

    expect(getActiveViewContext()).toEqual({ traceId: 'trace-1', spanId: 'span-1' });
    expect(getActiveViewName()).toBe('HomeScreen');
  });

  it('replaces view context on subsequent setActiveView calls', () => {
    setActiveView({ traceId: 'trace-a', spanId: 'span-a' }, 'ScreenA');
    setActiveView({ traceId: 'trace-b', spanId: 'span-b' }, 'ScreenB');

    expect(getActiveViewContext()).toEqual({ traceId: 'trace-b', spanId: 'span-b' });
    expect(getActiveViewName()).toBe('ScreenB');
  });

  it('clears view context after clearActiveView', () => {
    setActiveView({ traceId: 'trace-1', spanId: 'span-1' }, 'Screen');
    clearActiveView();

    expect(getActiveViewContext()).toBeNull();
    expect(getActiveViewName()).toBeNull();
  });
});
