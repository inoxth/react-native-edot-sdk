import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Alert, Text } from 'react-native';
import { useEdot } from '@inox/react-native-edot-sdk';
import { EdotNavigationProvider } from '@inox/react-native-edot-navigation';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME_IOS,
  EDOT_SERVICE_NAME_ANDROID,
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
  useEffect(() => {
    if (!EDOT_SERVER_URL) {
      Alert.alert('Missing .env', 'Copy .env.example to .env');
    }
  }, []);

  if (!EDOT_SERVER_URL) {
    return <></>;
  }

  return <InitializedApp />;
}

function InitializedApp(): React.JSX.Element {
  const navigationRef = useNavigationContainerRef();
  const { ready, error } = useEdot({
    serverUrl: EDOT_SERVER_URL,
    ios: { serviceName: EDOT_SERVICE_NAME_IOS ?? 'edot-react-nav-example-ios' },
    android: { serviceName: EDOT_SERVICE_NAME_ANDROID ?? 'edot-react-nav-example-android' },
    serviceVersion: EDOT_SERVICE_VERSION ?? '0.1.0',
    deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT ?? 'development',
    secretToken: EDOT_SECRET_TOKEN,
    debug: true,
  });

  if (error) {
    console.error('[EDOT] Init failed:', error);
  }
  if (!ready) {
    return <></>;
  }

  return (
    <EdotNavigationProvider navigationRef={navigationRef} screenNameMapper={screenNameMapper}>
      <NavigationContainer ref={navigationRef}>
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
              tabBarButtonTestID: 'tab-home',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>H</Text>,
            }}
          />
          <Tab.Screen
            name="DemosTab"
            component={DemosStackScreen}
            options={{
              tabBarLabel: 'Demos',
              tabBarButtonTestID: 'tab-demos',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>D</Text>,
            }}
          />
          <Tab.Screen
            name="SettingsTab"
            component={SettingsStackScreen}
            options={{
              tabBarLabel: 'Settings',
              tabBarButtonTestID: 'tab-settings',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>S</Text>,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </EdotNavigationProvider>
  );
}
