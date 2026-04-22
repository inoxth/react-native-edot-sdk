import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
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
  return <View />;
}

describe('EdotExpoNavigationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    resetNativeModuleForTesting();
    mockPathname = '/home';
  });

  it('creates initial view span on mount', () => {
    render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

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
    const { rerender } = render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    jest.clearAllMocks();
    mockPathname = '/products/42';
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    rerender(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

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

    render(
      <EdotExpoNavigationProvider screenNameMapper={mapper}>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: /products/:id',
      expect.objectContaining({ 'view.name': '/products/:id' }),
      null,
    );
  });

  it('ends span and clears context on unmount', () => {
    const { unmount } = render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    jest.clearAllMocks();

    unmount();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
  });

  it('F-14: emits new span when two pathnames share the same displayName', () => {
    const mapper = (path: string) => path.replace(/\/\d+/g, '/:id');

    mockPathname = '/products/1';
    const { rerender } = render(
      <EdotExpoNavigationProvider screenNameMapper={mapper}>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');
    mockPathname = '/products/2';

    rerender(
      <EdotExpoNavigationProvider screenNameMapper={mapper}>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledTimes(1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: /products/:id',
      expect.objectContaining({ 'view.name': '/products/:id' }),
      null,
    );
  });

  it('F-15: active span is ended when component unmounts mid-navigation', () => {
    const { unmount } = render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    unmount();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
  });

  it('F-16: renders correctly when pathname resolves to "/" (expo-router fallback)', () => {
    mockPathname = '/';
    mockNativeModule.startSpan.mockReturnValue('view-span-fallback');

    render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'Navigation: /',
      expect.objectContaining({ 'view.url': '/', 'view.name': '/', 'view.transition_type': 'initial' }),
      null,
    );
  });
});
