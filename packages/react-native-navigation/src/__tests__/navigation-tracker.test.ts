import { createEdotNavigationContainerRef, resetForTesting } from '../navigation-tracker';
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

describe('createEdotNavigationContainerRef', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    reEmitters.length = 0;
    resetForTesting();
  });

  it('creates initial view span on onReady', () => {
    const { onReady, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'HomeScreen', key: 'home-1' }),
    };

    onReady();

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'HomeScreen',
      { 'screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-navigation',
    );
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'HomeScreen',
      spanId: 'view-span-1',
    });
  });

  it('creates span on state change with last.screen.name', () => {
    const { onReady, onStateChange, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: jest
        .fn()
        .mockReturnValueOnce({ name: 'HomeScreen', key: 'home-1' })
        .mockReturnValueOnce({ name: 'ProductDetail', key: 'product-1' }),
    };

    onReady();
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    onStateChange();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'ProductDetail',
      { 'screen.name': 'ProductDetail', 'last.screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-navigation',
    );
  });

  it('omits last.screen.name on the very first emission', () => {
    const { onReady, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'HomeScreen', key: 'home-1' }),
    };

    onReady();

    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
    expect(attrs).not.toHaveProperty('view.transition_type');
    expect(attrs).not.toHaveProperty('view.previous');
  });

  it('applies screenNameMapper', () => {
    const { onReady, navigationRef } = createEdotNavigationContainerRef({
      screenNameMapper: (name) => name.replace(/\d+/, ':id'),
    });
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'UserProfile/42', key: 'user-1' }),
    };

    onReady();

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'UserProfile/:id',
      expect.objectContaining({ 'screen.name': 'UserProfile/:id' }),
      null,
      '@inox/react-native-edot-navigation',
    );
  });

  it('ends span and clears context on cleanup', () => {
    const { onReady, cleanup, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'HomeScreen', key: 'home-1' }),
    };

    onReady();
    jest.clearAllMocks();

    cleanup();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });

  it('does not create span when no route', () => {
    const { onReady, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => undefined,
    };

    onReady();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('foreground re-emit replays current route without last.screen.name', () => {
    const { onReady, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'HomeScreen', key: 'home-1' }),
    };

    onReady();
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    triggerForegroundReEmit();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'HomeScreen',
      { 'screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-navigation',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
  });

  it('foreground re-emit with detached navigationRef does not throw', () => {
    const { navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = null;

    expect(() => triggerForegroundReEmit()).not.toThrow();
    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('cleanup unregisters the foreground re-emitter', () => {
    const { onReady, cleanup, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'HomeScreen', key: 'home-1' }),
    };

    onReady();
    cleanup();
    jest.clearAllMocks();

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('keeps span state isolated between concurrent instances', () => {
    mockNativeModule.startSpan.mockReturnValueOnce('span-a-1').mockReturnValueOnce('span-b-1');

    const first = createEdotNavigationContainerRef();
    first.navigationRef.current = {
      getCurrentRoute: () => ({ name: 'FirstScreen', key: 'k1' }),
    };

    const second = createEdotNavigationContainerRef();
    second.navigationRef.current = {
      getCurrentRoute: () => ({ name: 'SecondScreen', key: 'k2' }),
    };

    first.onReady();
    second.onReady();

    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();

    first.cleanup();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('span-a-1', 1);

    mockNativeModule.endSpan.mockClear();
    second.cleanup();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('span-b-1', 1);
  });
});
