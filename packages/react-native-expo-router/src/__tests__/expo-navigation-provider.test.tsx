import React from 'react';
// @ts-expect-error -- react-test-renderer types not installed
import { create, act } from 'react-test-renderer';
import { EdotExpoNavigationProvider, resetNativeModuleForTesting } from '../expo-navigation-provider';
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

let mockPathname = '/home';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

function TestChild(): React.ReactElement {
  return React.createElement('View');
}

describe('EdotExpoNavigationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    resetNativeModuleForTesting();
    mockPathname = '/home';
  });

  it('creates initial view span on mount', () => {
    act(() => {
      create(
        React.createElement(EdotExpoNavigationProvider, null,
          React.createElement(TestChild),
        ),
      );
    });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: /home',
      expect.objectContaining({
        'view.name': '/home',
        'view.url': '/home',
        'view.transition_type': 'initial',
      }),
      null,
    );
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: '/home',
      spanId: 'view-span-1',
    });
  });

  it('creates new span on pathname change', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        React.createElement(EdotExpoNavigationProvider, null,
          React.createElement(TestChild),
        ),
      );
    });

    jest.clearAllMocks();
    mockPathname = '/products/42';
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    act(() => {
      renderer!.update(
        React.createElement(EdotExpoNavigationProvider, null,
          React.createElement(TestChild),
        ),
      );
    });

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: /products/42',
      expect.objectContaining({
        'view.name': '/products/42',
        'view.previous': '/home',
      }),
      null,
    );
  });

  it('applies screenNameMapper', () => {
    mockPathname = '/products/42';
    const mapper = (path: string) => path.replace(/\/\d+/g, '/:id');

    act(() => {
      create(
        React.createElement(EdotExpoNavigationProvider, { screenNameMapper: mapper, children: React.createElement(TestChild) }),
      );
    });

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: /products/:id',
      expect.objectContaining({ 'view.name': '/products/:id' }),
      null,
    );
  });

  it('ends span and clears context on unmount', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        React.createElement(EdotExpoNavigationProvider, null,
          React.createElement(TestChild),
        ),
      );
    });

    jest.clearAllMocks();

    act(() => {
      renderer!.unmount();
    });

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });
});
