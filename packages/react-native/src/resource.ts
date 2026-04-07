import { Platform } from 'react-native';

const sdkPackage = require('../package.json');

export interface ResourceAttributes {
  'telemetry.sdk.name': string;
  'telemetry.sdk.version': string;
  'telemetry.sdk.language': string;
  'os.type': string;
  'rn.version': string;
  'rn.hermes': boolean;
  'rn.architecture': 'bridge' | 'fabric';
}

export function detectResourceAttributes(): ResourceAttributes {
  return {
    'telemetry.sdk.name': 'edot-react-native',
    'telemetry.sdk.version': sdkPackage.version,
    'telemetry.sdk.language': 'javascript',
    'os.type': Platform.OS,
    'rn.version': Platform.constants?.reactNativeVersion
      ? `${Platform.constants.reactNativeVersion.major}.${Platform.constants.reactNativeVersion.minor}.${Platform.constants.reactNativeVersion.patch}`
      : 'unknown',
    'rn.hermes': isHermesEnabled(),
    'rn.architecture': detectArchitecture(),
  };
}

function isHermesEnabled(): boolean {
  return global.HermesInternal != null;
}

function detectArchitecture(): 'bridge' | 'fabric' {
  return global.nativeFabricUIManager != null ? 'fabric' : 'bridge';
}
