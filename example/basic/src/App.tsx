import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { EdotErrorBoundary, EdotReactNative, useEdot } from '@inox/react-native-edot-sdk';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME_IOS,
  EDOT_SERVICE_NAME_ANDROID,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';
import { ErrorsSection } from './sections/ErrorsSection';
import { InteractionSection } from './sections/InteractionSection';
import { LogOutput } from './sections/LogOutput';
import { LogsSection } from './sections/LogsSection';
import { MetricsSection } from './sections/MetricsSection';
import { NetworkSection } from './sections/NetworkSection';
import { StatusSection } from './sections/StatusSection';
import { TracingSection } from './sections/TracingSection';
import { UserSection } from './sections/UserSection';
import { styles } from './styles';

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

          <StatusSection status={statusText} sessionId={sessionId} />
          <UserSection addLog={addLog} />
          <TracingSection addLog={addLog} />
          <MetricsSection addLog={addLog} />
          <LogsSection addLog={addLog} />
          <NetworkSection addLog={addLog} />
          <ErrorsSection addLog={addLog} />
          <InteractionSection addLog={addLog} />
          <LogOutput log={log} />
        </ScrollView>
      </SafeAreaView>
    </EdotErrorBoundary>
  );
}
