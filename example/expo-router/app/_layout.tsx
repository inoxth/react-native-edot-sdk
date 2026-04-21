import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { EdotReactNative } from '@inox/react-native-edot-sdk';
import { EdotExpoNavigationProvider } from '@inox/react-native-edot-expo-router';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';

type InitState = 'missing-env' | 'initializing' | 'ready';

function screenNameMapper(pathname: string): string {
  return pathname.replace(/\/\d+/g, '/:id');
}

function titleFor(state: InitState): string {
  if (state === 'ready') return 'EDOT Expo Router';
  if (state === 'missing-env') return 'Missing .env -- copy .env.example';
  return 'Initializing...';
}

export default function RootLayout(): React.ReactElement {
  const [initState, setInitState] = useState<InitState>(
    EDOT_SERVER_URL ? 'initializing' : 'missing-env',
  );

  useEffect(() => {
    if (!EDOT_SERVER_URL) return;
    EdotReactNative.initialize({
      serverUrl: EDOT_SERVER_URL,
      serviceName: EDOT_SERVICE_NAME,
      serviceVersion: EDOT_SERVICE_VERSION,
      secretToken: EDOT_SECRET_TOKEN,
      deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
      debug: true,
    })
      .then(() => setInitState('ready'))
      .catch((err: unknown) => console.error('[EDOT] Init failed:', err));
  }, []);

  return (
    <EdotExpoNavigationProvider screenNameMapper={screenNameMapper}>
      <Stack
        screenOptions={{
          headerShown: true,
          title: titleFor(initState),
        }}
      />
    </EdotExpoNavigationProvider>
  );
}
