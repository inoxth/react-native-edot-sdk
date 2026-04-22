import { registerEdotNavigationListener, resetForTesting } from '../wix-navigation-tracker';
import { ActiveViewContext } from '@inox/react-native-edot-shared';
import type { WixNavigation, ComponentDidAppearEvent } from '../types';

const mockNativeModule = {
  startSpan: jest.fn().mockReturnValue('view-span-1'),
  endSpan: jest.fn(),
};

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
    resetForTesting();
  });

  it('creates span on ComponentDidAppear', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: CartScreen',
      expect.objectContaining({
        'view.name': 'CartScreen',
        'view.transition_type': 'initial',
      }),
      null,
    );
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'CartScreen',
      spanId: 'view-span-1',
    });
  });

  it('ends previous span on new screen', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: CartScreen',
      expect.objectContaining({ 'view.previous': 'HomeScreen' }),
      null,
    );
  });

  it('applies screenNameMapper', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation, {
      screenNameMapper: (name) => name.replace('Screen', ''),
    });

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: Cart',
      expect.objectContaining({ 'view.name': 'Cart' }),
      null,
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

  it('emits initial transition_type on first event, push on subsequent', () => {
    const { navigation, fireEvent } = createMockNavigation();
    registerEdotNavigationListener(navigation);

    fireEvent({ componentName: 'HomeScreen', componentId: 'home-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: HomeScreen',
      expect.objectContaining({ 'view.transition_type': 'initial' }),
      null,
    );

    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    fireEvent({ componentName: 'CartScreen', componentId: 'cart-1' });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: CartScreen',
      expect.objectContaining({ 'view.transition_type': 'push' }),
      null,
    );
  });

  it('keeps span state isolated between concurrent listeners', () => {
    mockNativeModule.startSpan
      .mockReturnValueOnce('wix-a-1')
      .mockReturnValueOnce('wix-b-1');

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
