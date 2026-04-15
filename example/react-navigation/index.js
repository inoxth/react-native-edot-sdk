import { AppRegistry, LogBox } from 'react-native';
import { App } from './src/App';

LogBox.ignoreAllLogs();

AppRegistry.registerComponent('EdotReactNavExample', () => App);
