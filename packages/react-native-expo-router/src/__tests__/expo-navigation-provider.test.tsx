import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import {
  EdotExpoNavigationProvider,
  resetNativeModuleForTesting,
} from '../expo-navigation-provider';
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

let mockPathname = '/home';
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

function triggerForegroundReEmit(): void {
  for (const fn of reEmitters.slice()) {
    fn();
  }
}

function TestChild(): React.ReactElement {
  return <View />;
}

describe('EdotExpoNavigationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    reEmitters.length = 0;
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
      '/home',
      { 'screen.name': '/home' },
      null,
      '@inox/react-native-edot-expo-router',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
    expect(attrs).not.toHaveProperty('view.transition_type');
    expect(attrs).not.toHaveProperty('view.url');
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: '/home',
      spanId: 'view-span-1',
    });
  });

  it('creates new span on pathname change with last.screen.name', () => {
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
      '/products/42',
      { 'screen.name': '/products/42', 'last.screen.name': '/home' },
      null,
      '@inox/react-native-edot-expo-router',
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
      '/products/:id',
      { 'screen.name': '/products/:id' },
      null,
      '@inox/react-native-edot-expo-router',
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

  it('does not re-emit when two pathnames share the same mapped displayName', () => {
    const mapper = (path: string) => path.replace(/\/\d+/g, '/:id');

    mockPathname = '/products/1';
    const { rerender } = render(
      <EdotExpoNavigationProvider screenNameMapper={mapper}>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    jest.clearAllMocks();
    mockPathname = '/products/2';

    rerender(
      <EdotExpoNavigationProvider screenNameMapper={mapper}>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('foreground re-emit replays current pathname without last.screen.name', () => {
    render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    triggerForegroundReEmit();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      '/home',
      { 'screen.name': '/home' },
      null,
      '@inox/react-native-edot-expo-router',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
  });

  it('unmount unregisters the foreground re-emitter', () => {
    const { unmount } = render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    unmount();
    jest.clearAllMocks();

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('renders correctly when pathname resolves to "/"', () => {
    mockPathname = '/';
    mockNativeModule.startSpan.mockReturnValue('view-span-fallback');

    render(
      <EdotExpoNavigationProvider>
        <TestChild />
      </EdotExpoNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      '/',
      { 'screen.name': '/' },
      null,
      '@inox/react-native-edot-expo-router',
    );
  });
});
