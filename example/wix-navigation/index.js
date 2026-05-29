import { Alert } from 'react-native';
import { Navigation } from 'react-native-navigation';
import { EdotReactNative } from '@inoxth/react-native-edot-sdk';
import { registerEdotNavigationListener } from '@inoxth/react-native-edot-navigation';
import {
  EDOT_SERVER_URL,
  EDOT_SERVICE_NAME_IOS,
  EDOT_SERVICE_NAME_ANDROID,
  EDOT_SERVICE_VERSION,
  EDOT_SECRET_TOKEN,
  EDOT_DEPLOYMENT_ENVIRONMENT,
} from '@env';
import { HomeScreen } from './src/screens/HomeScreen';
import { DemosScreen } from './src/screens/DemosScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NetworkDemo } from './src/screens/NetworkDemo';
import { TracingDemo } from './src/screens/TracingDemo';
import { MetricsDemo } from './src/screens/MetricsDemo';
import { LogsDemo } from './src/screens/LogsDemo';
import { ErrorDemo } from './src/screens/ErrorDemo';
import { InteractionDemo } from './src/screens/InteractionDemo';
import { withSafeAreaProvider } from './src/withSafeAreaProvider';

Navigation.registerComponent('HomeScreen', () => withSafeAreaProvider(HomeScreen));
Navigation.registerComponent('DemosScreen', () => withSafeAreaProvider(DemosScreen));
Navigation.registerComponent('SettingsScreen', () => withSafeAreaProvider(SettingsScreen));
Navigation.registerComponent('NetworkDemo', () => withSafeAreaProvider(NetworkDemo));
Navigation.registerComponent('TracingDemo', () => withSafeAreaProvider(TracingDemo));
Navigation.registerComponent('MetricsDemo', () => withSafeAreaProvider(MetricsDemo));
Navigation.registerComponent('LogsDemo', () => withSafeAreaProvider(LogsDemo));
Navigation.registerComponent('ErrorDemo', () => withSafeAreaProvider(ErrorDemo));
Navigation.registerComponent('InteractionDemo', () => withSafeAreaProvider(InteractionDemo));

const SCREEN_NAME_MAP = {
  HomeScreen: 'Home',
  DemosScreen: 'Demos',
  SettingsScreen: 'Settings',
  NetworkDemo: 'Network',
  TracingDemo: 'Tracing',
  MetricsDemo: 'Metrics',
  LogsDemo: 'Logs',
  ErrorDemo: 'Errors',
  InteractionDemo: 'Interaction',
};

Navigation.events().registerAppLaunchedListener(async () => {
  if (!EDOT_SERVER_URL) {
    Alert.alert('Missing .env', 'Copy .env.example to .env');
  } else {
    try {
      await EdotReactNative.initialize({
        serverUrl: EDOT_SERVER_URL,
        ios: { serviceName: EDOT_SERVICE_NAME_IOS ?? 'edot-wix-nav-example-ios' },
        android: { serviceName: EDOT_SERVICE_NAME_ANDROID ?? 'edot-wix-nav-example-android' },
        serviceVersion: EDOT_SERVICE_VERSION ?? '0.1.0',
        deploymentEnvironment: EDOT_DEPLOYMENT_ENVIRONMENT ?? 'development',
        secretToken: EDOT_SECRET_TOKEN,
        debug: true,
      });
    } catch {
      // SDK init failure is non-fatal; screens still render
    }
  }

  registerEdotNavigationListener(Navigation, {
    screenNameMapper: (name) => SCREEN_NAME_MAP[name] ?? name,
  });

  Navigation.setRoot({
    root: {
      bottomTabs: {
        children: [
          {
            stack: {
              children: [{ component: { name: 'HomeScreen' } }],
              options: { bottomTab: { text: 'Home', testID: 'tab-home' } },
            },
          },
          {
            stack: {
              children: [{ component: { name: 'DemosScreen' } }],
              options: { bottomTab: { text: 'Demos', testID: 'tab-demos' } },
            },
          },
          {
            stack: {
              children: [{ component: { name: 'SettingsScreen' } }],
              options: { bottomTab: { text: 'Settings', testID: 'tab-settings' } },
            },
          },
        ],
      },
    },
  });
});
