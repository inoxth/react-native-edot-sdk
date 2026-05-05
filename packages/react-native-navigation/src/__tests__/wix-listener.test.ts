import { registerEdotNavigationListener } from '../wix-listener';
import { ActiveViewContext } from '@inox/react-native-edot-shared';
import type { WixComponentDidAppearEvent, WixNavigationLike } from '../types';

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
  navigation: WixNavigationLike;
  fireEvent: (event: WixComponentDidAppearEvent) => void;
  removeListener: jest.Mock;
} {
  let listener: ((event: WixComponentDidAppearEvent) => void) | null = null;
  const removeListener = jest.fn();

  const navigation: WixNavigationLike = {
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
  });

  it('creates a span on ComponentDidAppear with screen.name', () => {
    const { navigation, fireEvent } = createMockNavigation();

    registerEdotNavigationListener(navigation);
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'HomeScreen',
      { 'screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'HomeScreen',
      spanId: 'view-span-1',
    });
  });

  it('ends previous span on new screen with last.screen.name', () => {
    const { navigation, fireEvent } = createMockNavigation();

    registerEdotNavigationListener(navigation);
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    fireEvent({ componentName: 'DemosScreen', componentId: 'd1' });

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'DemosScreen',
      { 'screen.name': 'DemosScreen', 'last.screen.name': 'HomeScreen' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
  });

  it('applies screenNameMapper', () => {
    const { navigation, fireEvent } = createMockNavigation();

    registerEdotNavigationListener(navigation, {
      screenNameMapper: (name) => name.replace('Screen', ''),
    });
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Home',
      { 'screen.name': 'Home' },
      null,
      '@inox/react-native-edot-wix-navigation',
    );
  });

  it('cleanup removes listener and ends current span', () => {
    const { navigation, fireEvent, removeListener } = createMockNavigation();

    const cleanup = registerEdotNavigationListener(navigation);
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });
    jest.clearAllMocks();

    cleanup();

    expect(removeListener).toHaveBeenCalled();
    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });

  it('ignores duplicate screen events', () => {
    const { navigation, fireEvent } = createMockNavigation();

    registerEdotNavigationListener(navigation);
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });
    jest.clearAllMocks();

    fireEvent({ componentName: 'HomeScreen', componentId: 'h2' });

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('foreground re-emit replays last component without last.screen.name', () => {
    const { navigation, fireEvent } = createMockNavigation();

    registerEdotNavigationListener(navigation);
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });
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

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('cleanup unregisters foreground re-emitter', () => {
    const { navigation, fireEvent } = createMockNavigation();

    const cleanup = registerEdotNavigationListener(navigation);
    fireEvent({ componentName: 'HomeScreen', componentId: 'h1' });
    cleanup();
    jest.clearAllMocks();

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });
});
