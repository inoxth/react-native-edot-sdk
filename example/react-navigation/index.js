import { AppRegistry, LogBox } from 'react-native';
import { App } from './src/App';

LogBox.ignoreAllLogs();
try { require('./e2e/sdk-spy'); } catch (_e) {}

AppRegistry.registerComponent('EdotReactNavExample', () => App);
