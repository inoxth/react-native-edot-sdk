import { registerEdotNavigationListener, resetForTesting } from '../wix-navigation-tracker';
import { ActiveViewContext } from '@inox-edot/core';
import type { WixNavigation, ComponentDidAppearEvent } from '../types';

const mockNativeModule = {
  startSpan: jest.fn().mockReturnValue('view-span-1'),
  endSpan: jest.fn(),
};

jest.mock('@inox-edot/react-native/nativeModule', () => ({
  EdotNativeModule: mockNativeModule,
}));

jest.mock('@inox-edot/core', () => ({
  ActiveViewContext: {
    setActiveView: jest.fn(),
    clearActiveView: jest.fn(),
  },
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
        'view.transition_type': 'push',
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
});
