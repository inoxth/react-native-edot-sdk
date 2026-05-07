import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  EdotErrorBoundary,
  EdotReactNative,
  useEdot,
  useEdotAction,
  withEdotTracking,
} from '@inox/react-native-edot-sdk';
import {
  getMeterProvider,
  getTracerProvider,
  withSpanContext,
  SpanStatusCode,
} from '@inox/react-native-edot-tracer-provider';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME_IOS,
  EDOT_SERVICE_NAME_ANDROID,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';

function Button({
  title,
  onPress,
  color,
  testID,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  testID?: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.button, color ? { backgroundColor: color } : undefined]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const TrackedButton = withEdotTracking(Button, 'TrackedButton');

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function CrashComponent(): React.JSX.Element {
  throw new Error('ErrorBoundary test: component render crash');
}

function InteractionSection({
  addLog,
}: {
  addLog: (msg: string) => void;
}): React.JSX.Element {
  const { trackAction } = useEdotAction();

  const handleTrackedPress = useCallback(() => {
    addLog('withEdotTracking button tapped');
  }, [addLog]);

  const handleHookAction = useCallback(() => {
    trackAction('tap', 'HookActionButton', { screen: 'InteractionDemo' });
    addLog('useEdotAction tracked: HookActionButton');
  }, [addLog, trackAction]);

  return (
    <>
      <TrackedButton
        title="Tracked Button (HOC)"
        onPress={handleTrackedPress}
        testID="interaction-btn-tracked"
      />
      <Button
        title="Track Action (Hook)"
        onPress={handleHookAction}
        testID="interaction-btn-hook-action"
      />
    </>
  );
}

export function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      {EDOT_SERVER_URL ? <InitializedApp /> : <MissingEnvScreen />}
    </SafeAreaProvider>
  );
}

function MissingEnvScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scroll}>
        <Text style={styles.title}>EDOT Example</Text>
        <View style={styles.section}>
          <Text style={styles.label}>
            Status: Missing .env -- copy .env.example to .env
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InitializedApp(): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('Checking...');
  const [log, setLog] = useState<string[]>([]);
  const [showCrashComponent, setShowCrashComponent] = useState(false);

  const meter = useRef(getMeterProvider().getMeter('demo', '1.0.0'));
  const counter = useRef(meter.current.createCounter('demo.button_clicks'));
  const histogram = useRef(meter.current.createHistogram('demo.response_time'));
  const upDown = useRef(meter.current.createUpDownCounter('demo.active_items'));

  const addLog = useCallback((message: string) => {
    setLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev.slice(0, 29),
    ]);
  }, []);

  const { ready, error } = useEdot({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS || 'edot-basic-example-ios' },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID || 'edot-basic-example-android' },
    serviceVersion: EDOT_SERVICE_VERSION || '0.1.0',
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT || 'development',
    secretToken: EDOT_SECRET_TOKEN,
    debug: true,
    exportProtocol: 'http',
  });

  useEffect(() => {
    if (!ready) {
      return;
    }
    async function check(): Promise<void> {
      try {
        const id = await EdotReactNative.getCurrentSessionId();
        setSessionId(id);
        setStatus('Initialized');
        addLog(id ? `Session: ${id}` : 'Session: unavailable (Android)');
      } catch {
        setStatus('Not initialized');
      }
    }
    check();
  }, [ready, addLog]);

  useEffect(() => {
    if (error) {
      addLog(`Init error: ${error.message}`);
    }
  }, [error, addLog]);

  // ===== User & Session =====
  const handleSetUser = useCallback(() => {
    EdotReactNative.setUser({ id: 'user-123', email: 'test@example.com', name: 'Test User' });
    addLog('User set: user-123');
  }, [addLog]);

  const handleClearUser = useCallback(() => {
    EdotReactNative.clearUser();
    addLog('User cleared');
  }, [addLog]);

  const handleSetSessionAttr = useCallback(() => {
    EdotReactNative.setSessionAttribute('test_key', 'test_value');
    addLog('Session attr: test_key=test_value');
  }, [addLog]);

  const handleSetGlobalAttr = useCallback(() => {
    EdotReactNative.setGlobalAttribute('tenant_id', 'acme-corp');
    addLog('Global attr: tenant_id=acme-corp');
  }, [addLog]);

  const handleRemoveGlobalAttr = useCallback(() => {
    EdotReactNative.removeGlobalAttribute('tenant_id');
    addLog('Global attr removed: tenant_id');
  }, [addLog]);

  // ===== Manual Tracing =====
  const handleCreateSpan = useCallback(() => {
    const tracer = getTracerProvider().getTracer('demo', '1.0.0');
    const span = tracer.startSpan('demo-operation', {
      attributes: { 'demo.type': 'simple', 'demo.screen': 'TracingDemo' },
    });
    addLog(`Span started: ${span.spanId}`);

    span.setAttribute('demo.step', 'processing');
    span.setStatus(SpanStatusCode.OK);
    span.end();
    addLog('Span ended with OK status');
  }, [addLog]);

  const handleNestedSpans = useCallback(() => {
    const tracer = getTracerProvider().getTracer('demo', '1.0.0');

    const parentSpan = tracer.startSpan('parent-operation', {
      attributes: { 'demo.type': 'nested' },
    });
    addLog(`Parent span: ${parentSpan.spanId}`);

    withSpanContext(parentSpan, () => {
      const childSpan = tracer.startSpan('child-operation', {
        attributes: { 'demo.parent': parentSpan.spanId },
      });
      addLog(`Child span: ${childSpan.spanId}`);

      childSpan.setAttribute('demo.step', 'child-work');
      childSpan.setStatus(SpanStatusCode.OK);
      childSpan.end();
      addLog('Child span ended');
    });

    parentSpan.setStatus(SpanStatusCode.OK);
    parentSpan.end();
    addLog('Parent span ended');
  }, [addLog]);

  // ===== Metrics =====
  const handleCounter = useCallback(() => {
    counter.current.add(1, { 'demo.action': 'increment' });
    addLog('Counter incremented by 1');
  }, [addLog]);

  const handleHistogram = useCallback(() => {
    const value = Math.round(Math.random() * 500);
    histogram.current.record(value, { 'demo.unit': 'ms' });
    addLog(`Histogram recorded: ${value}ms`);
  }, [addLog]);

  const handleUpDownIncrement = useCallback(() => {
    upDown.current.add(1, { 'demo.direction': 'up' });
    addLog('UpDownCounter +1');
  }, [addLog]);

  const handleUpDownDecrement = useCallback(() => {
    upDown.current.add(-1, { 'demo.direction': 'down' });
    addLog('UpDownCounter -1');
  }, [addLog]);

  // ===== Logs =====
  const handleLogInfo = useCallback(() => {
    EdotReactNative.log('info', 'Informational log from demo', { 'demo.screen': 'LogsDemo' });
    addLog('Sent: info log');
  }, [addLog]);

  const handleLogWarn = useCallback(() => {
    EdotReactNative.log('warn', 'Warning log from demo', { 'demo.screen': 'LogsDemo' });
    addLog('Sent: warn log');
  }, [addLog]);

  const handleLogError = useCallback(() => {
    EdotReactNative.log('error', 'Error log from demo', {
      'demo.screen': 'LogsDemo',
      'demo.code': '500',
    });
    addLog('Sent: error log');
  }, [addLog]);

  // ===== Network Requests =====
  const handleFetchData = useCallback(async () => {
    try {
      addLog('Fetching data...');
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const data = await response.json();
      addLog(`OK: ${data.title?.substring(0, 40)}...`);
    } catch (e) {
      addLog(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addLog]);

  const handleFetchError = useCallback(async () => {
    try {
      addLog('Fetching invalid URL...');
      await fetch('https://invalid.example.test/not-found');
      addLog('Unexpected success');
    } catch (e) {
      addLog(`Expected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [addLog]);

  const handleFetchMultiple = useCallback(async () => {
    addLog('Fetching 3 requests sequentially...');
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await fetch(`https://jsonplaceholder.typicode.com/posts/${i}`);
        const data = await response.json();
        addLog(`#${i} OK: ${data.title?.substring(0, 30)}...`);
      } catch (e) {
        addLog(`#${i} Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    addLog('All 3 requests complete');
  }, [addLog]);

  const handleXhr = useCallback(() => {
    addLog('XHR request...');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://jsonplaceholder.typicode.com/users/1');
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        addLog(`XHR OK: ${data.name}`);
      } catch {
        addLog(`XHR parse error`);
      }
    };
    xhr.onerror = () => addLog('XHR network error');
    xhr.send();
  }, [addLog]);

  // ===== Errors =====
  const handleJsError = useCallback(() => {
    addLog('Throwing JS error...');
    setTimeout(() => {
      throw new Error('Demo: intentional JS error');
    }, 0);
  }, [addLog]);

  const handlePromiseReject = useCallback(() => {
    addLog('Rejecting promise...');
    Promise.reject(new Error('Demo: intentional promise rejection'));
  }, [addLog]);

  const handleErrorBoundary = useCallback(() => {
    addLog('Triggering ErrorBoundary crash...');
    setShowCrashComponent(true);
  }, [addLog]);

  const handleNativeCrash = useCallback(() => {
    Alert.alert(
      'Native Crash',
      'Native crash simulation is not available in JS-only mode. Run on a device with native modules to test.',
    );
    addLog('Native crash: alert shown (placeholder)');
  }, [addLog]);

  const statusText = error ? `Error: ${error.message}` : status;

  return (
    <EdotErrorBoundary fallback={<Text style={styles.title}>Something went wrong</Text>}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          testID="scroll-view"
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scroll}
        >
          <Text testID="title" style={styles.title}>
            EDOT Example
          </Text>

          {/* Status */}
          <View testID="status-section" style={styles.section}>
            <Text testID="home-status" style={styles.label}>
              Status: {statusText}
            </Text>
            <Text testID="home-session" style={styles.label}>
              Session: {sessionId || 'N/A'}
            </Text>
          </View>

          {/* User & Session */}
          <SectionHeader title="User & Session" />
          <View style={styles.buttons}>
            <Button title="Set User" onPress={handleSetUser} testID="home-btn-set-user" />
            <Button title="Clear User" onPress={handleClearUser} testID="home-btn-clear-user" />
            <Button title="Set Session Attr" onPress={handleSetSessionAttr} testID="home-btn-set-session-attr" />
            <Button title="Set Global Attr" onPress={handleSetGlobalAttr} testID="home-btn-set-global-attr" />
            <Button title="Remove Global Attr" onPress={handleRemoveGlobalAttr} testID="home-btn-remove-global-attr" />
          </View>

          {/* Manual Tracing */}
          <SectionHeader title="Manual Tracing" />
          <View style={styles.buttons}>
            <Button title="Create Span" onPress={handleCreateSpan} testID="tracing-btn-create-span" />
            <Button title="Nested Spans" onPress={handleNestedSpans} testID="tracing-btn-nested-spans" />
          </View>

          {/* Metrics */}
          <SectionHeader title="Metrics" />
          <View style={styles.buttons}>
            <Button title="Increment Counter" onPress={handleCounter} testID="metrics-btn-counter" />
            <Button title="Record Histogram" onPress={handleHistogram} testID="metrics-btn-histogram" />
            <Button title="UpDown +1" onPress={handleUpDownIncrement} testID="metrics-btn-updown-up" />
            <Button title="UpDown -1" onPress={handleUpDownDecrement} testID="metrics-btn-updown-down" />
          </View>

          {/* Logs */}
          <SectionHeader title="Logs" />
          <View style={styles.buttons}>
            <Button title="Log Info" onPress={handleLogInfo} color="#34C759" testID="logs-btn-info" />
            <Button title="Log Warn" onPress={handleLogWarn} color="#FF9500" testID="logs-btn-warn" />
            <Button title="Log Error" onPress={handleLogError} color="#FF3B30" testID="logs-btn-error" />
          </View>

          {/* Network Requests */}
          <SectionHeader title="Network Requests" />
          <View style={styles.buttons}>
            <Button title="Fetch Data" onPress={handleFetchData} testID="network-btn-fetch" />
            <Button title="Fetch Error" onPress={handleFetchError} testID="network-btn-fetch-error" />
            <Button title="Fetch Multiple (3)" onPress={handleFetchMultiple} testID="network-btn-fetch-multiple" />
            <Button title="XHR Request" onPress={handleXhr} testID="network-btn-xhr" />
          </View>

          {/* Errors */}
          <SectionHeader title="Errors" />
          <View style={styles.buttons}>
            <Button title="Throw JS Error" onPress={handleJsError} color="#FF3B30" testID="errors-btn-js-error" />
            <Button title="Reject Promise" onPress={handlePromiseReject} color="#FF3B30" testID="errors-btn-promise-reject" />
            <Button title="Trigger ErrorBoundary" onPress={handleErrorBoundary} color="#FF3B30" testID="errors-btn-error-boundary" />
            <Button title="Native Crash" onPress={handleNativeCrash} color="#FF9500" testID="errors-btn-native-crash" />
          </View>

          <EdotErrorBoundary
            fallback={
              <View style={styles.section}>
                <Text style={styles.errorText}>ErrorBoundary caught a crash!</Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => setShowCrashComponent(false)}
                >
                  <Text style={styles.buttonText}>Reset</Text>
                </TouchableOpacity>
              </View>
            }
          >
            {showCrashComponent && <CrashComponent />}
          </EdotErrorBoundary>

          {/* User Interaction */}
          <SectionHeader title="User Interaction" />
          <View style={styles.buttons}>
            <InteractionSection addLog={addLog} />
          </View>

          {/* Log */}
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
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#333' },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  section: { marginBottom: 16, padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  label: { fontSize: 14, color: '#666', marginBottom: 4 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  button: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  logEntry: { fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 },
  errorText: { fontSize: 14, color: '#FF3B30', fontWeight: '600', marginBottom: 8 },
});
