import { registerEdotNavigationListener, resetForTesting } from '../wix-navigation-tracker';
import { ActiveViewContext } from '@inox/react-native-edot-shared';
import type { WixNavigation, ComponentDidAppearEvent } from '../types';

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

function createMockNavigation(): {
  navigation: WixNavigation;
  fireEvent: (event: ComponentDidAppearEvent) => void;
  removeListener: jest.Mock;
} {
  let listener: ((event: ComponentDidAppearEvent) => void) | null = null;
  const removeListener = jest.fn();

  const navigation: WixNavigation = {
    events: () => ({
      registerComponentDidAppearListener: (cb) => {
        listener = cb;
        return { remove: removeListener };
      },
    }),
  };

  return {
    navigation,
    fireEvent: (event) => listener?.(event),
    removeListener,
  };
}

describe('registerEdotNavigationListener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    reEmitters.length = 0;
    resetForTesting();
  });

  it('creates span on ComponentDidAppear with screen.name', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'CartScreen',
      { 'screen.name': 'CartScreen' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
    expect(attrs).not.toHaveProperty('view.transition_type');
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'CartScreen',
      spanId: 'view-span-1',
    });
  });

  it('ends previous span on new screen with last.screen.name', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'CartScreen',
      { 'screen.name': 'CartScreen', 'last.screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
  });

  it('applies screenNameMapper', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation, {
      screenNameMapper: (name) => name.replace('Screen', ''),
    });

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Cart',
      { 'screen.name': 'Cart' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
  });

  it('removes listener and clears context on cleanup', () => {
    const { navigation, removeListener } = createMockNavigation();
    const cleanup = registerEdotNavigationListener(navigation);

    cleanup();

    expect(removeListener).toHaveBeenCalled();
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });

  it('ignores duplicate screen events', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });
    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledTimes(1);
  });

  it('foreground re-emit replays last component without last.screen.name', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    triggerForegroundReEmit();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'HomeScreen',
      { 'screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
  });

  it('foreground re-emit without prior event is a no-op', () => {
    const { navigation } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    expect(() => triggerForegroundReEmit()).not.toThrow();
    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('cleanup unregisters foreground re-emitter and clears stashed event', () => {
    const { navigation, fireEvent } = createMockNavigation();
    const cleanup = registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });
    cleanup();
    jest.clearAllMocks();

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('keeps span state isolated between concurrent listeners', () => {
    mockNativeModule.startSpan.mockReturnValueOnce('wix-a-1').mockReturnValueOnce('wix-b-1');

    const first = createMockNavigation();
    const second = createMockNavigation();

    const cleanupFirst = registerEdotNavigationListener(first.navigation);
    const cleanupSecond = registerEdotNavigationListener(second.navigation);

    first.fireEvent({ componentName: 'AScreen', componentId: 'a-1' });
    second.fireEvent({ componentName: 'BScreen', componentId: 'b-1' });

    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();

    cleanupFirst();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('wix-a-1', 1);

    mockNativeModule.endSpan.mockClear();
    cleanupSecond();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('wix-b-1', 1);
  });
});
