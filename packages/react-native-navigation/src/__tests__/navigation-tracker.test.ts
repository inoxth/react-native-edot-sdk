import { createEdotNavigationContainerRef, resetForTesting } from '../navigation-tracker';
import { ActiveViewContext } from '@inox/react-native-edot-shared';

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
}));

describe('createEdotNavigationContainerRef', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    resetForTesting();
  });

  it('creates initial view span on onReady', () => {
    const { onReady, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: () => ({ name: 'HomeScreen', key: 'home-1' }),
    };

    onReady();

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: HomeScreen',
      expect.objectContaining({
        'view.name': 'HomeScreen',
        'view.transition_type': 'initial',
      }),
      null,
    );
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'HomeScreen',
      spanId: 'view-span-1',
    });
  });

  it('creates span on state change with view.previous', () => {
    const { onReady, onStateChange, navigationRef } = createEdotNavigationContainerRef();
    navigationRef.current = {
      getCurrentRoute: jest.fn()
        .mockReturnValueOnce({ name: 'HomeScreen', key: 'home-1' })
        .mockReturnValueOnce({ name: 'ProductDetail', key: 'product-1' }),
    };

    onReady();
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    onStateChange();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: ProductDetail',
      expect.objectContaining({
        'view.name': 'ProductDetail',
        'view.previous': 'HomeScreen',
        'view.transition_type': 'push',
      }),
      null,
    );
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
      'Navigation: UserProfile/:id',
      expect.objectContaining({ 'view.name': 'UserProfile/:id' }),
      null,
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

  it('keeps span state isolated between concurrent instances', () => {
    mockNativeModule.startSpan
      .mockReturnValueOnce('span-a-1')
      .mockReturnValueOnce('span-b-1');

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
