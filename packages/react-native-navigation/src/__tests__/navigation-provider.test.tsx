import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import { EdotNavigationProvider } from '../navigation-provider';
import { ActiveViewContext } from '@inox/react-native-edot-shared';
import type { NavigationContainerRefLike, NavigationRoute } from '../types';

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

function TestChild(): React.ReactElement {
  return <View />;
}

interface FakeRefHandle {
  ref: NavigationContainerRefLike;
  setRoute: (route: NavigationRoute | undefined) => void;
  emitState: () => void;
  removedListeners: number;
}

function createFakeNavigationRef(initialRoute: NavigationRoute | undefined): FakeRefHandle {
  let currentRoute = initialRoute;
  const listeners = new Set<() => void>();
  let removedListeners = 0;

  const ref: NavigationContainerRefLike = {
    addListener(event, listener) {
      if (event !== 'state') {
        return () => undefined;
      }
      listeners.add(listener);
      return () => {
        if (listeners.delete(listener)) removedListeners += 1;
      };
    },
    getCurrentRoute() {
      return currentRoute;
    },
  };

  return {
    ref,
    setRoute(route) {
      currentRoute = route;
    },
    emitState() {
      for (const listener of listeners) listener();
    },
    get removedListeners() {
      return removedListeners;
    },
  };
}

describe('EdotNavigationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-1');
    reEmitters.length = 0;
  });

  it('creates initial view span on mount from the navigationRef', () => {
    const handle = createFakeNavigationRef({ name: 'index', key: 'k1' });

    render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'index',
      { 'screen.name': 'index' },
      null,
      '@inox/react-native-edot-navigation',
    );
    expect(ActiveViewContext.setActiveView).toHaveBeenCalledWith({
      name: 'index',
      spanId: 'view-span-1',
    });
  });

  it('does not emit when navigationRef has no current route on mount', () => {
    const handle = createFakeNavigationRef(undefined);

    render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });

  it('emits when a state event arrives after a delayed initial route', () => {
    const handle = createFakeNavigationRef(undefined);

    render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    handle.setRoute({ name: 'index', key: 'k1' });
    handle.emitState();

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'index',
      { 'screen.name': 'index' },
      null,
      '@inox/react-native-edot-navigation',
    );
  });

  it('creates new span on state change with last.screen.name', () => {
    const handle = createFakeNavigationRef({ name: 'index', key: 'k1' });

    render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    handle.setRoute({ name: 'network', key: 'k2' });
    handle.emitState();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'network',
      { 'screen.name': 'network', 'last.screen.name': 'index' },
      null,
      '@inox/react-native-edot-navigation',
    );
  });

  it('applies screenNameMapper to the route name and params', () => {
    const handle = createFakeNavigationRef({
      name: 'UserProfile',
      key: 'k1',
      params: { id: 42 },
    });
    const mapper = (name: string, params?: object): string => {
      const id = (params as { id?: number } | undefined)?.id;
      return id !== undefined ? `${name}/:id` : name;
    };

    render(
      <EdotNavigationProvider navigationRef={handle.ref} screenNameMapper={mapper}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'UserProfile/:id',
      { 'screen.name': 'UserProfile/:id' },
      null,
      '@inox/react-native-edot-navigation',
    );
  });

  it('does not re-emit when state event reports the same screen name', () => {
    const handle = createFakeNavigationRef({ name: 'index', key: 'k1' });

    render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    jest.clearAllMocks();

    handle.emitState();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
    expect(mockNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('foreground re-emit replays current screen without last.screen.name', () => {
    const handle = createFakeNavigationRef({ name: 'index', key: 'k1' });

    render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    jest.clearAllMocks();
    mockNativeModule.startSpan.mockReturnValue('view-span-2');

    triggerForegroundReEmit();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(mockNativeModule.startSpan).toHaveBeenCalledWith(
      'index',
      { 'screen.name': 'index' },
      null,
      '@inox/react-native-edot-navigation',
    );
    const attrs = mockNativeModule.startSpan.mock.calls[0]?.[1] as Record<string, string>;
    expect(attrs).not.toHaveProperty('last.screen.name');
  });

  it('ends span and clears context on unmount', () => {
    const handle = createFakeNavigationRef({ name: 'index', key: 'k1' });

    const { unmount } = render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    jest.clearAllMocks();

    unmount();

    expect(mockNativeModule.endSpan).toHaveBeenCalledWith('view-span-1', 1);
    expect(ActiveViewContext.clearActiveView).toHaveBeenCalled();
    expect(handle.removedListeners).toBe(1);
  });

  it('unmount unregisters the foreground re-emitter', () => {
    const handle = createFakeNavigationRef({ name: 'index', key: 'k1' });

    const { unmount } = render(
      <EdotNavigationProvider navigationRef={handle.ref}>
        <TestChild />
      </EdotNavigationProvider>,
    );

    unmount();
    jest.clearAllMocks();

    triggerForegroundReEmit();

    expect(mockNativeModule.startSpan).not.toHaveBeenCalled();
  });
});
