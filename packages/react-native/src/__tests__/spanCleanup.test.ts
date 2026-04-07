import { setupSpanCleanup, trackSpan } from '../instrumentation/spanCleanup';
import { EdotNativeModule } from '../nativeModule';

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    endSpan: jest.fn(),
  },
}));

describe('setupSpanCleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cleans up spans older than 5 minutes', () => {
    const teardown = setupSpanCleanup();

    trackSpan('old-span');

    jest.advanceTimersByTime(5 * 60_000 + 60_000);

    expect(EdotNativeModule.endSpan).toHaveBeenCalledWith('old-span', 2);
    teardown();
  });

  it('does not clean up recent spans', () => {
    const teardown = setupSpanCleanup();

    trackSpan('new-span');

    jest.advanceTimersByTime(60_000);

    expect(EdotNativeModule.endSpan).not.toHaveBeenCalled();
    teardown();
  });

  it('stops cleanup on teardown', () => {
    const teardown = setupSpanCleanup();
    teardown();

    trackSpan('span-after-teardown');
    jest.advanceTimersByTime(10 * 60_000);

    expect(EdotNativeModule.endSpan).not.toHaveBeenCalled();
  });
});
