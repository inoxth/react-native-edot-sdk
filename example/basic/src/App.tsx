import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EdotReactNative,
  EdotErrorBoundary,
  withEdotTracking,
  useEdotAction,
} from '@inox/react-native-edot-sdk';
import {
  getTracerProvider,
  getMeterProvider,
  withSpanContext,
  SpanStatusCode,
} from '@inox/react-native-edot-tracer-provider';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Button({
  testID,
  title,
  onPress,
  color,
}: {
  testID?: string;
  title: string;
  onPress: () => void;
  color?: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.button, color ? { backgroundColor: color } : undefined]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const TrackedButton = withEdotTracking(Button, 'TrackedButton');

function CrashingComponent(): React.JSX.Element {
  throw new Error('ErrorBoundary test: component render crash');
}

function ErrorBoundaryDemo({
  addLog,
}: {
  addLog: (msg: string) => void;
}): React.JSX.Element {
  const [shouldCrash, setShouldCrash] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Keep EdotErrorBoundary always mounted so it is a committed boundary
  // when CrashingComponent throws. If it were conditionally mounted in
  // the same render that causes the throw, React 18 concurrent mode may
  // route the error to the outer boundary instead.
  return (
    <EdotErrorBoundary
      key={resetKey}
      fallback={
        <View testID="error-boundary-fallback" style={styles.errorFallback}>
          <Text style={styles.errorFallbackText}>
            Caught by EdotErrorBoundary
          </Text>
          <Button
            title="Reset"
            onPress={() => {
              setShouldCrash(false);
              setResetKey((k) => k + 1);
            }}
            color="#999"
          />
        </View>
      }
    >
      {shouldCrash ? (
        <CrashingComponent />
      ) : (
        <Button
          testID="btn-error-boundary"
          title="Error Boundary"
          color="#FF3B30"
          onPress={() => {
            addLog('Triggering ErrorBoundary crash');
            setShouldCrash(true);
          }}
        />
      )}
    </EdotErrorBoundary>
  );
}

function InteractionDemo({
  addLog,
}: {
  addLog: (msg: string) => void;
}): React.JSX.Element {
  const { trackAction } = useEdotAction();

  const handleTrackedPress = useCallback(() => {
    addLog('withEdotTracking button tapped');
  }, [addLog]);

  const handleHookAction = useCallback(() => {
    trackAction('tap', 'HookActionButton', { screen: 'BasicExample' });
    addLog('useEdotAction tracked: HookActionButton');
  }, [addLog, trackAction]);

  return (
    <>
      <TrackedButton
        testID="btn-tracked"
        title="Tracked Button (HOC)"
        onPress={handleTrackedPress}
      />
      <Button
        testID="btn-hook-action"
        title="Track Action (Hook)"
        onPress={handleHookAction}
      />
    </>
  );
}

export function App(): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Not initialized');
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    setLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev.slice(0, 49),
    ]);
  }, []);

  useEffect(() => {
    async function init(): Promise<void> {
      if (!EDOT_SERVER_URL) {
        setStatus('Missing .env -- copy .env.example to .env');
        return;
      }
      try {
        await EdotReactNative.initialize({
          serverUrl: EDOT_SERVER_URL,
          serviceName: EDOT_SERVICE_NAME || 'rn-edot-example',
          serviceVersion: EDOT_SERVICE_VERSION || '0.1.0',
          deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT || 'development',
          secretToken: EDOT_SECRET_TOKEN,
          debug: true,
        });
        setStatus('Initialized');
        addLog('SDK initialized');

        const id = await EdotReactNative.getCurrentSessionId();
        setSessionId(id);
        addLog(`Session ID: ${id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setStatus(`Error: ${message}`);
        addLog(`Init error: ${message}`);
      }
    }
    init();
  }, [addLog]);

  // --- User & Session ---
  const handleSetUser = useCallback(() => {
    EdotReactNative.setUser({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    });
    addLog('User set: user-123');
  }, [addLog]);

  const handleClearUser = useCallback(() => {
    EdotReactNative.clearUser();
    addLog('User cleared');
  }, [addLog]);

  const handleSetAttribute = useCallback(() => {
    EdotReactNative.setSessionAttribute('test_key', 'test_value');
    addLog('Session attribute set: test_key=test_value');
  }, [addLog]);

  const handleSetGlobalAttribute = useCallback(() => {
    EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
    addLog('Global attribute set: tenant_id=acme-corp');
  }, [addLog]);

  const handleRemoveGlobalAttribute = useCallback(() => {
    EdotReactNative.removeGlobalAttribute('tenant_id');
    addLog('Global attribute removed: tenant_id');
  }, [addLog]);

  // --- Manual Tracing ---
  const handleCreateSpan = useCallback(() => {
    const tracer = getTracerProvider().getTracer('basic-example');
    const span = tracer.startSpan('manual-span', {
      attributes: { 'demo.type': 'single' },
    });
    span.setAttribute('demo.timestamp', Date.now());
    span.setStatus(SpanStatusCode.OK);
    span.end();
    addLog('Created and ended manual span');
  }, [addLog]);

  const handleNestedSpans = useCallback(() => {
    const tracer = getTracerProvider().getTracer('basic-example');
    const parentSpan = tracer.startSpan('parent-span', {
      attributes: { 'demo.type': 'nested' },
    });

    withSpanContext(parentSpan, () => {
      const childSpan = tracer.startSpan('child-span-1');
      childSpan.setAttribute('child.index', 1);
      childSpan.setStatus(SpanStatusCode.OK);
      childSpan.end();

      const childSpan2 = tracer.startSpan('child-span-2');
      childSpan2.setAttribute('child.index', 2);
      childSpan2.setStatus(SpanStatusCode.OK);
      childSpan2.end();
    });

    parentSpan.setStatus(SpanStatusCode.OK);
    parentSpan.end();
    addLog('Created parent span with 2 child spans');
  }, [addLog]);

  // --- Metrics ---
  const handleCounter = useCallback(() => {
    const meter = getMeterProvider().getMeter('basic-example');
    const counter = meter.createCounter('demo.button_clicks');
    counter.add(1, { button: 'counter_demo' });
    addLog('Counter incremented: demo.button_clicks +1');
  }, [addLog]);

  const handleHistogram = useCallback(() => {
    const meter = getMeterProvider().getMeter('basic-example');
    const histogram = meter.createHistogram('demo.response_time');
    const value = Math.round(Math.random() * 500);
    histogram.record(value, { endpoint: '/api/demo' });
    addLog(`Histogram recorded: demo.response_time = ${value}ms`);
  }, [addLog]);

  const handleUpDownCounter = useCallback(() => {
    const meter = getMeterProvider().getMeter('basic-example');
    const upDown = meter.createUpDownCounter('demo.active_connections');
    const delta = Math.random() > 0.5 ? 1 : -1;
    upDown.add(delta, { service: 'demo' });
    addLog(`UpDownCounter: demo.active_connections ${delta > 0 ? '+1' : '-1'}`);
  }, [addLog]);

  // --- Structured Logs ---
  const handleLogInfo = useCallback(() => {
    EdotReactNative.log('info', 'Info log from basic example', {
      screen: 'App',
      action: 'demo',
    });
    addLog('Logged info message');
  }, [addLog]);

  const handleLogWarn = useCallback(() => {
    EdotReactNative.log('warn', 'Warning log from basic example', {
      screen: 'App',
      risk_level: 'medium',
    });
    addLog('Logged warn message');
  }, [addLog]);

  const handleLogError = useCallback(() => {
    EdotReactNative.log('error', 'Error log from basic example', {
      screen: 'App',
      error_code: 'DEMO_ERR',
    });
    addLog('Logged error message');
  }, [addLog]);

  // --- Network Requests ---
  const handleFetchSuccess = useCallback(async () => {
    try {
      const response = await fetch(
        'https://jsonplaceholder.typicode.com/posts/1',
      );
      const data = (await response.json()) as { title?: string };
      addLog(`Fetch OK: ${data.title?.substring(0, 30)}...`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Fetch error: ${message}`);
    }
  }, [addLog]);

  const handleFetchError = useCallback(async () => {
    try {
      await fetch('https://invalid.endpoint.test/not-found');
      addLog('Fetch unexpectedly succeeded');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Fetch error (expected): ${message}`);
    }
  }, [addLog]);

  const handleFetchMultiple = useCallback(async () => {
    addLog('Starting 3 sequential fetches...');
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await fetch(
          `https://jsonplaceholder.typicode.com/posts/${i}`,
        );
        const data = (await response.json()) as { id?: number };
        addLog(`Fetch ${i}/3 OK: post #${data.id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        addLog(`Fetch ${i}/3 error: ${message}`);
      }
    }
    addLog('Sequential fetches complete');
  }, [addLog]);

  const handleXhrRequest = useCallback(() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/users/1');
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText) as { name?: string };
        addLog(`XHR OK: ${data.name}`);
      } else {
        addLog(`XHR status: ${xhr.status}`);
      }
    };
    xhr.onerror = () => {
      addLog('XHR network error');
    };
    xhr.send();
    addLog('XHR request sent');
  }, [addLog]);

  // --- Error Tracing ---
  const handleThrowError = useCallback(() => {
    addLog('Throwing uncaught JS error...');
    setTimeout(() => {
      throw new Error('Demo uncaught JS error');
    }, 0);
  }, [addLog]);

  const handleRejectPromise = useCallback(() => {
    addLog('Creating unhandled promise rejection...');
    Promise.reject(new Error('Demo unhandled promise rejection'));
  }, [addLog]);

  const handleNativeCrash = useCallback(() => {
    Alert.alert(
      'Native Crash',
      'Native crash testing requires a release build. This is a placeholder.',
      [{ text: 'OK' }],
    );
    addLog('Native crash: placeholder (requires release build)');
  }, [addLog]);

  return (
    <EdotErrorBoundary
      fallback={<Text style={styles.title}>Something went wrong</Text>}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          testID="scroll-view"
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scroll}
        >
          <Text testID="title" style={styles.title}>
            EDOT React Native SDK
          </Text>

          {/* Status */}
          <View testID="status-section" style={styles.section}>
            <Text testID="status-text" style={styles.label}>
              Status: {status}
            </Text>
            <Text testID="session-text" style={styles.label}>
              Session: {sessionId || 'N/A'}
            </Text>
          </View>

          {/* User & Session */}
          <SectionHeader title="User & Session" />
          <View style={styles.buttons}>
            <Button
              testID="btn-set-user"
              title="Set User"
              onPress={handleSetUser}
            />
            <Button
              testID="btn-clear-user"
              title="Clear User"
              onPress={handleClearUser}
            />
            <Button
              testID="btn-set-session-attr"
              title="Set Session Attr"
              onPress={handleSetAttribute}
            />
            <Button
              testID="btn-set-global-attr"
              title="Set Global Attr"
              onPress={handleSetGlobalAttribute}
            />
            <Button
              testID="btn-remove-global-attr"
              title="Remove Global Attr"
              onPress={handleRemoveGlobalAttribute}
            />
          </View>

          {/* Manual Tracing */}
          <SectionHeader title="Manual Tracing" />
          <View style={styles.buttons}>
            <Button
              testID="btn-create-span"
              title="Create Span"
              onPress={handleCreateSpan}
            />
            <Button
              testID="btn-nested-spans"
              title="Nested Spans"
              onPress={handleNestedSpans}
            />
          </View>

          {/* Metrics */}
          <SectionHeader title="Metrics" />
          <View style={styles.buttons}>
            <Button
              testID="btn-counter"
              title="Counter (+1)"
              onPress={handleCounter}
            />
            <Button
              testID="btn-histogram"
              title="Histogram"
              onPress={handleHistogram}
            />
            <Button
              testID="btn-updown-counter"
              title="UpDownCounter"
              onPress={handleUpDownCounter}
            />
          </View>

          {/* Structured Logs */}
          <SectionHeader title="Structured Logs" />
          <View style={styles.buttons}>
            <Button
              testID="btn-log-info"
              title="Log Info"
              onPress={handleLogInfo}
              color="#34C759"
            />
            <Button
              testID="btn-log-warn"
              title="Log Warn"
              onPress={handleLogWarn}
              color="#FF9500"
            />
            <Button
              testID="btn-log-error"
              title="Log Error"
              onPress={handleLogError}
              color="#FF3B30"
            />
          </View>

          {/* Network Requests */}
          <SectionHeader title="Network Requests" />
          <View style={styles.buttons}>
            <Button
              testID="btn-fetch-success"
              title="Fetch Data"
              onPress={handleFetchSuccess}
            />
            <Button
              testID="btn-fetch-error"
              title="Fetch Error"
              onPress={handleFetchError}
            />
            <Button
              testID="btn-fetch-multiple"
              title="Fetch Multiple"
              onPress={handleFetchMultiple}
            />
            <Button
              testID="btn-xhr-request"
              title="XHR Request"
              onPress={handleXhrRequest}
            />
          </View>

          {/* Error Tracing */}
          <SectionHeader title="Error Tracing" />
          <View style={styles.buttons}>
            <Button
              testID="btn-throw-error"
              title="Throw JS Error"
              onPress={handleThrowError}
              color="#FF3B30"
            />
            <Button
              testID="btn-reject-promise"
              title="Reject Promise"
              onPress={handleRejectPromise}
              color="#FF3B30"
            />
            <ErrorBoundaryDemo addLog={addLog} />
            <Button
              testID="btn-native-crash"
              title="Native Crash"
              onPress={handleNativeCrash}
              color="#FF3B30"
            />
          </View>

          {/* User Interaction */}
          <SectionHeader title="User Interaction" />
          <View style={styles.buttons}>
            <InteractionDemo addLog={addLog} />
          </View>

          {/* Log Output */}
          <View testID="log-section" style={styles.section}>
            <Text style={styles.label}>Log:</Text>
            {log.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>
                {entry}
              </Text>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </EdotErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { flex: 1, padding: 16 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  errorFallback: {
    padding: 8,
    backgroundColor: '#FFE5E5',
    borderRadius: 6,
  },
  errorFallbackText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
});
