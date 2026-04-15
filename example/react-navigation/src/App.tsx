import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { EdotReactNative } from '@inox/react-native-edot-sdk';
import { createEdotNavigationContainerRef } from '@inox/react-native-edot-navigation';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';
import { HomeScreen } from './screens/HomeScreen';
import { DemosScreen } from './screens/DemosScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { NetworkDemo } from './screens/NetworkDemo';
import { TracingDemo } from './screens/TracingDemo';
import { MetricsDemo } from './screens/MetricsDemo';
import { LogsDemo } from './screens/LogsDemo';
import { ErrorDemo } from './screens/ErrorDemo';

declare global {
  var __edotSpy: Record<string, number> | undefined;
}

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const DemosStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

function HomeStackScreen(): React.JSX.Element {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
    </HomeStack.Navigator>
  );
}

function DemosStackScreen(): React.JSX.Element {
  return (
    <DemosStack.Navigator>
      <DemosStack.Screen name="Demos" component={DemosScreen} options={{ title: 'Demos' }} />
      <DemosStack.Screen name="NetworkDemo" component={NetworkDemo} options={{ title: 'Network' }} />
      <DemosStack.Screen name="TracingDemo" component={TracingDemo} options={{ title: 'Tracing' }} />
      <DemosStack.Screen name="MetricsDemo" component={MetricsDemo} options={{ title: 'Metrics' }} />
      <DemosStack.Screen name="LogsDemo" component={LogsDemo} options={{ title: 'Logs' }} />
      <DemosStack.Screen name="ErrorDemo" component={ErrorDemo} options={{ title: 'Errors' }} />
    </DemosStack.Navigator>
  );
}

function SettingsStackScreen(): React.JSX.Element {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </SettingsStack.Navigator>
  );
}

function screenNameMapper(routeName: string): string {
  return routeName.replace(/\/\d+/g, '/:id');
}

export function App(): React.JSX.Element {
  const [sdkReady, setSdkReady] = useState(false);
  const SpyOverlay: React.ComponentType | null = global.__edotSpy != null
    ? require('../e2e/sdk-spy').SdkSpyOverlay
    : null;
  const edotNav = useRef(
    createEdotNavigationContainerRef({ screenNameMapper }),
  );

  useEffect(() => {
    async function init(): Promise<void> {
      if (!EDOT_SERVER_URL) return;
      try {
        await EdotReactNative.initialize({
          serverUrl: EDOT_SERVER_URL,
          serviceName: EDOT_SERVICE_NAME ?? 'edot-react-nav-example',
          serviceVersion: EDOT_SERVICE_VERSION ?? '0.1.0',
          deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT ?? 'development',
          secretToken: EDOT_SECRET_TOKEN,
          debug: true,
        });
        setSdkReady(true);
      } catch (e) {
        console.error('[EDOT] Init failed:', e);
      }
    }
    init();

    return () => {
      edotNav.current.cleanup();
    };
  }, []);

  return (
    <>
      <NavigationContainer
        ref={edotNav.current.navigationRef}
        onReady={edotNav.current.onReady}
        onStateChange={edotNav.current.onStateChange}
      >
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarLabelStyle: { fontSize: 12 },
          }}
        >
          <Tab.Screen
            name="HomeTab"
            component={HomeStackScreen}
            options={{
              tabBarLabel: 'Home',
              tabBarTestID: 'tab-home',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>H</Text>,
            }}
          />
          <Tab.Screen
            name="DemosTab"
            component={DemosStackScreen}
            options={{
              tabBarLabel: 'Demos',
              tabBarTestID: 'tab-demos',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>D</Text>,
            }}
          />
          <Tab.Screen
            name="SettingsTab"
            component={SettingsStackScreen}
            options={{
              tabBarLabel: 'Settings',
              tabBarTestID: 'tab-settings',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>S</Text>,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      {SpyOverlay != null && <SpyOverlay />}
    </>
  );
}
