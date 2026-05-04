import { AppState, type NativeEventSubscription } from 'react-native';
import { ActiveViewContext } from '../activeViewContext';
import { setupAppStateTracking } from '../instrumentation/app-state';
import { EdotNativeModule } from '../nativeModule';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    endSpan: jest.fn(),
  },
}));

type ChangeHandler = (state: 'active' | 'background' | 'inactive' | 'unknown') => void;

let capturedHandler: ChangeHandler | null = null;
const removeFn = jest.fn();

function emit(state: Parameters<ChangeHandler>[0]): void {
  if (!capturedHandler) {
    throw new Error('AppState handler not registered');
  }
  capturedHandler(state);
}

describe('setupAppStateTracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandler = null;
    ActiveViewContext._resetForTesting();

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler): NativeEventSubscription => {
        capturedHandler = handler as unknown as ChangeHandler;
        return { remove: removeFn };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ends the active screen span on background', () => {
    ActiveViewContext.setActiveView({ name: 'Home', spanId: 'home-1' });
    setupAppStateTracking();

    emit('background');

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('home-1', 1);
    expect(ActiveViewContext.getActiveView()).toBeNull();
  });

  it('does not end any span when no active view exists on background', () => {
    setupAppStateTracking();

    emit('background');

    expect(EdotNativeModule.endSpan).not.toHaveBeenCalled();
  });

  it('ignores inactive transitions', () => {
    ActiveViewContext.setActiveView({ name: 'Home', spanId: 'home-1' });
    const reEmitter = jest.fn();
    ActiveViewContext.registerForegroundReEmitter(reEmitter);
    setupAppStateTracking();

    emit('inactive');

    expect(EdotNativeModule.endSpan).not.toHaveBeenCalled();
    expect(reEmitter).not.toHaveBeenCalled();
    expect(ActiveViewContext.getActiveView()).toEqual({ name: 'Home', spanId: 'home-1' });
  });

  it('does not invoke re-emitters when active fires without prior background', () => {
    const reEmitter = jest.fn();
    ActiveViewContext.registerForegroundReEmitter(reEmitter);
    setupAppStateTracking();

    emit('active');

    expect(reEmitter).not.toHaveBeenCalled();
  });

  it('invokes re-emitters once on active after background', () => {
    const reEmitter = jest.fn();
    ActiveViewContext.registerForegroundReEmitter(reEmitter);
    setupAppStateTracking();

    emit('background');
    emit('active');

    expect(reEmitter).toHaveBeenCalledTimes(1);
  });

  it('inactive between background and active does not duplicate the re-emit', () => {
    const reEmitter = jest.fn();
    ActiveViewContext.registerForegroundReEmitter(reEmitter);
    setupAppStateTracking();

    emit('inactive');
    emit('background');
    emit('inactive');
    emit('active');

    expect(reEmitter).toHaveBeenCalledTimes(1);
  });

  it('returns a teardown that removes the AppState subscription', () => {
    const teardown = setupAppStateTracking();
    teardown();
    expect(removeFn).toHaveBeenCalled();
  });
});
