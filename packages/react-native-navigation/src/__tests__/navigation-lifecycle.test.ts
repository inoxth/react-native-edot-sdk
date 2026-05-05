import { createNavigationLifecycle } from '../navigation-lifecycle';
import { ActiveViewContext } from '@inox/react-native-edot-shared';

const mockNativeModule = {
  startSpan: jest.fn().mockReturnValue('view-span-1'),
  endSpan: jest.fn(),
};

const reEmitters: Array<() => void> = [];

jest.mock('@inox/react-native-edot-sdk/nativeModule', () => ({
  EdotNativeModule: mockNativeModule,
}));

jest.mock('@inox/react-native-edot-shared', () => ({
  ActiveViewContext: {
    setActiveView: jest.fn(),
    clearActiveView: jest.fn(),
    registerForegroundReEmitter: jest.fn((fn: () => void) => {
      reEmitters.push(fn);
      return () => {
        const index = reEmitters.indexOf(fn);
        if (index !== -1) reEmitters.splice(index, 1);
      };
    }),
  },
  getNativeModule: () => mockNativeModule,
}));

function triggerForegroundReEmit(): void {
  for (const fn of reEmitters.slice()) {
    fn();
  }
}

describe('createNavigationLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    reEmitters.length = 0;
  });

  it('starts a span on the first onScreen call', () => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => null,
    });

    lifecycle.onScreen('Home');

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Home',
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

  it('ends the previous span and includes last.screen.name on the next', () => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => null,
    });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    lifecycle.onScreen('Details');

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Details',
      { 'screen.name': 'Details', 'last.screen.name': 'Home' },
      null,
      'test',
    );
  });

  it('does not re-emit when called with the same screen name', () => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => null,
    });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();

    lifecycle.onScreen('Home');

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('cleanup ends the active span and clears context', () => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => null,
    });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();

    lifecycle.cleanup();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });

  it('foreground re-emit replays the screen returned by getCurrentScreenName without last.screen.name', () => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => 'Home',
    });

    lifecycle.onScreen('Home');
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    triggerForegroundReEmit();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Home',
      { 'screen.name': 'Home' },
      null,
      'test',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
  });

  it('foreground re-emit is a no-op when getCurrentScreenName returns null', () => {
    createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => null,
    });

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('cleanup unregisters the foreground re-emitter', () => {
    const lifecycle = createNavigationLifecycle({
      instrumentationName: 'test',
      getCurrentScreenName: () => 'Home',
    });

    lifecycle.onScreen('Home');
    lifecycle.cleanup();
    jest.clearAllMocks();

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('keeps span state isolated between concurrent lifecycles', () => {
    mockNativeModule.startSpan.mockReturnValueOnce('span-a-1').mockReturnValueOnce('span-b-1');

    const a = createNavigationLifecycle({
      instrumentationName: 'a',
      getCurrentScreenName: () => null,
    });
    const b = createNavigationLifecycle({
      instrumentationName: 'b',
      getCurrentScreenName: () => null,
    });

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
