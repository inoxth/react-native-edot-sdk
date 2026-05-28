import { Stack, useNavigationContainerRef } from 'expo-router';
import { useEdot } from '@inoxth/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inoxth/react-native-edot-navigation';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME_IOS,
  EDOT_SERVICE_NAME_ANDROID,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';

function screenNameMapper(routeName: string): string {
  return routeName;
}

export default function RootLayout(): React.ReactElement {
  if (!EDOT_SERVER_URL) {
    return (
      <Stack
        screenOptions={{ headerShown: true, title: 'Missing .env -- copy .env.example' }}
      />
    );
  }
  return <InitializedLayout />;
}

function InitializedLayout(): React.ReactElement {
  const navigationRef = useNavigationContainerRef();
  const { ready, error } = useEdot({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS ?? 'edot-expo-router-example-ios' },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID ?? 'edot-expo-router-example-android' },
    serviceVersion: EDOT_SERVICE_VERSION,
    secretToken: EDOT_SECRET_TOKEN,
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT,
    debug: true,
  });

  if (error) {
    console.error('[EDOT] Init failed:', error);
  }

  return (
    <EdotNavigationProvider
      navigationRef={navigationRef}
      screenNameMapper={screenNameMapper}
    >
      <Stack
        screenOptions={{
          headerShown: true,
          title: ready ? 'EDOT Expo Router' : 'Initializing...',
        }}
      />
    </EdotNavigationProvider>
  );
}
