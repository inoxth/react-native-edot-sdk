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

function screenNameMapper(pathname: string): string {
  return pathname.replace(/\/\d+/g, '/:id');
}

export default function RootLayout(): React.ReactElement {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    EdotReactNative.initialize({
      serverUrl: EDOT_SERVER_URL,
      serviceName: EDOT_SERVICE_NAME,
      serviceVersion: EDOT_SERVICE_VERSION,
      secretToken: EDOT_SECRET_TOKEN,
      deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
      debug: true,
    })
      .then(() => setInitialized(true))
      .catch((err: unknown) => console.error('[EDOT] Init failed:', err));
  }, []);

  return (
    <EdotExpoNavigationProvider screenNameMapper={screenNameMapper}>
      <Stack
        screenOptions={{
          headerShown: true,
          title: initialized ? 'EDOT Expo Router' : 'Initializing...',
        }}
      />
    </EdotExpoNavigationProvider>
  );
}
