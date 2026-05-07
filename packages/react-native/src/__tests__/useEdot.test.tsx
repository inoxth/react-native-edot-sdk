import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { useEdot } from '../hooks/useEdot';
import { EdotReactNative } from '../EdotReactNative';
import type { EdotConfig } from '../types';

jest.mock('../instrumentation/fetch', () => ({
  setupFetchInstrumentation: jest.fn(() => jest.fn()),
}));
jest.mock('../instrumentation/xhr', () => ({ setupXhrInstrumentation: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/errors', () => ({ setupErrorHandler: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/startup', () => ({ setupStartupTracing: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/spanCleanup', () => ({ setupSpanCleanup: jest.fn(() => jest.fn()) }));
jest.mock('../instrumentation/app-state', () => ({
  setupAppStateTracking: jest.fn(() => jest.fn()),
}));

jest.mock('../nativeModule', () => ({
  EdotNativeModule: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getCurrentSessionId: jest.fn().mockResolvedValue('session-1'),
    setUser: jest.fn(),
    clearUser: jest.fn(),
    setSessionAttribute: jest.fn(),
    setGlobalAttribute: jest.fn(),
    removeGlobalAttribute: jest.fn(),
    reportJsException: jest.fn(),
    startSpan: jest.fn().mockReturnValue('span-1'),
    endSpan: jest.fn(),
    setSpanAttribute: jest.fn(),
    setSpanAttributeNumber: jest.fn(),
    setSpanAttributeBoolean: jest.fn(),
    recordSpanException: jest.fn(),
    recordMetric: jest.fn(),
    emitLog: jest.fn(),
    setTrackingConsent: jest.fn(),
  },
}));

const validConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

interface ProbeProps {
  config: EdotConfig;
}

function Probe({ config }: ProbeProps): React.JSX.Element {
  const { ready, error } = useEdot(config);
  const status = error ? 'error' : ready ? 'ready' : 'loading';
  return <Text testID="probe">{status}</Text>;
}

describe('useEdot', () => {
  beforeEach(() => {
    EdotReactNative._resetForTesting();
    jest.clearAllMocks();
  });

  it('initializes once on mount and resolves to ready', async () => {
    const { getByTestId } = render(<Probe config={validConfig} />);

    expect(getByTestId('probe').props.children).toBe('loading');
    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('ready');
    });
    const { EdotNativeModule } = require('../nativeModule');
    expect(EdotNativeModule.initialize).toHaveBeenCalledTimes(1);
  });

  it('exposes error and warns when init rejects', async () => {
    const { EdotNativeModule } = require('../nativeModule');
    const failure = new Error('native failure');
    (EdotNativeModule.initialize as jest.Mock).mockRejectedValueOnce(failure);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { getByTestId } = render(<Probe config={validConfig} />);

    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('error');
    });
    expect(warnSpy).toHaveBeenCalledWith('[EDOT] SDK initialization failed:', failure);
    warnSpy.mockRestore();
  });

  it('does not re-initialize when the config object identity changes', async () => {
    const { EdotNativeModule } = require('../nativeModule');
    const { rerender, getByTestId } = render(<Probe config={validConfig} />);
    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('ready');
    });

    rerender(<Probe config={{ ...validConfig }} />);
    rerender(<Probe config={{ ...validConfig }} />);

    expect(EdotNativeModule.initialize).toHaveBeenCalledTimes(1);
  });

  it('warns in dev when a native-relevant config key changes after first render', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { rerender, getByTestId } = render(<Probe config={validConfig} />);
    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('ready');
    });

    rerender(<Probe config={{ ...validConfig, serverUrl: 'https://other.example.com' }} />);

    expect(warnSpy).toHaveBeenCalledWith(
      '[EDOT] useEdot received a different config after first render; only the initial config is applied.',
    );
    warnSpy.mockRestore();
  });

  it('does not warn when only non-native-relevant keys change', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { rerender, getByTestId } = render(<Probe config={validConfig} />);
    await waitFor(() => {
      expect(getByTestId('probe').props.children).toBe('ready');
    });
    warnSpy.mockClear();

    rerender(<Probe config={{ ...validConfig, urlSanitizer: (u: string) => u }} />);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
