import {
  createNavigationLifecycle,
  markCurrentScreenLoaded,
} from '../navigation-lifecycle';
import { ActiveViewContext } from '@inox/react-native-edot-shared';

const mockNativeModule = {
  startSpan: jest.fn().mockReturnValue('view-span-1'),
  endSpan: jest.fn(),
};

let mockPendingCallbacks: Array<{ id: number; cb: () => void; cancelled: boolean }> = [];
let mockNextId = 0;

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: jest.fn((cb: () => void) => {
      const id = mockNextId++;
      const entry = { id, cb, cancelled: false };
      mockPendingCallbacks.push(entry);
      return {
        cancel: () => {
          entry.cancelled = true;
        },
      };
    }),
  },
}));

jest.mock('@inox/react-native-edot-sdk/nativeModule', () => ({
  EdotNativeModule: mockNativeModule,
}));

jest.mock('@inox/react-native-edot-shared', () => ({
  ActiveViewContext: {
    setActiveView: jest.fn(),
    clearActiveView: jest.fn(),
  },
  getNativeModule: () => mockNativeModule,
}));

function flushInteractions(): void {
  for (const entry of mockPendingCallbacks.slice()) {
    if (!entry.cancelled) entry.cb();
  }
  mockPendingCallbacks = [];
}

describe('createNavigationLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    mockPendingCallbacks = [];
    mockNextId = 0;
  });

  it('starts a span on the first onScreen call', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Home - view appearing',
      { 'screen.name': 'Home' },
      null,
      'test',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'Home',
      spanId: 'view-span-1',
    });
  });

  it('auto-ends the span when interactions idle', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();

    flushInteractions();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
  });

  it('does not clear ActiveViewContext when the span auto-ends', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    flushInteractions();

    expect(ActiveViewContext.clearActiveView).not.toHaveBeenCalled();
  });

  it('ends the previous span and includes last.screen.name on the next', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    lifecycle.onScreen('Details');

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Details - view appearing',
      { 'screen.name': 'Details', 'last.screen.name': 'Home' },
      null,
      'test',
    );
  });

  it('does not re-emit when called with the same screen name', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();

    lifecycle.onScreen('Home');

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('cancels the pending auto-end when navigating to a new screen', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    mockNativeModule.startSpan.mockReturnValue('view-span-2');
    lifecycle.onScreen('Details');

    // The first runAfterInteractions callback was scheduled for view-span-1.
    // After navigating away, it should be cancelled and never end view-span-2 by mistake.
    flushInteractions();

    // The Home span was ended exactly once (by the navigation, not by the cancelled timer).
    expect(mockNativeModule.endSpan.mock.calls.filter((c) => c[0] === 'view-span-1')).toHaveLength(
      1,
    );
    // The Details span ends via its own runAfterInteractions, exactly once.
    expect(mockNativeModule.endSpan.mock.calls.filter((c) => c[0] === 'view-span-2')).toHaveLength(
      1,
    );
  });

  it('markScreenLoaded ends the current span early', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();

    lifecycle.markScreenLoaded();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
  });

  it('markScreenLoaded cancels the pending auto-end so the span ends only once', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    lifecycle.markScreenLoaded();
    flushInteractions();

    expect(mockNativeModule.endSpan).toHaveBeenCalledTimes(1);
  });

  it('markScreenLoaded called twice is a no-op the second time', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    lifecycle.markScreenLoaded();
    lifecycle.markScreenLoaded();

    expect(mockNativeModule.endSpan).toHaveBeenCalledTimes(1);
  });

  it('module-level markCurrentScreenLoaded targets the most recently created lifecycle', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    markCurrentScreenLoaded();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
  });

  it('cleanup ends the active span and clears active view', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();

    lifecycle.cleanup();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });

  it('cleanup detaches markCurrentScreenLoaded so subsequent module-level calls are no-ops', () => {
    const lifecycle = createNavigationLifecycle({ instrumentationName: 'test' });

    lifecycle.onScreen('Home');
    lifecycle.cleanup();
    jest.clearAllMocks();

    markCurrentScreenLoaded();

    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('keeps span state isolated between concurrent lifecycles', () => {
    mockNativeModule.startSpan.mockReturnValueOnce('span-a-1').mockReturnValueOnce('span-b-1');

    const a = createNavigationLifecycle({ instrumentationName: 'a' });
    const b = createNavigationLifecycle({ instrumentationName: 'b' });

    a.onScreen('AScreen');
    b.onScreen('BScreen');

    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();

    a.cleanup();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('span-a-1', 1);

    mockNativeModule.endSpan.mockClear();
    b.cleanup();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('span-b-1', 1);
  });
});
