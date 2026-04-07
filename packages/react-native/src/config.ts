import type { EdotConfig } from './types';

const REQUIRED_FIELDS: (keyof EdotConfig)[] = [
  'serverUrl',
  'serviceName',
  'serviceVersion',
  'deploymentEnvironment',
];

export function validateConfig(config: EdotConfig): void {
  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      throw new Error(`[EDOT] ${field} is required`);
    }
  }

  if (config.secretToken && config.apiKey) {
    throw new Error('[EDOT] secretToken and apiKey are mutually exclusive');
  }

  if (config.sessionSamplingRate !== undefined) {
    if (config.sessionSamplingRate < 0 || config.sessionSamplingRate > 1) {
      throw new Error('[EDOT] sessionSamplingRate must be between 0.0 and 1.0');
    }
  }

  if (
    config.exportProtocol !== undefined &&
    config.exportProtocol !== 'otlp/http' &&
    config.exportProtocol !== 'otlp/grpc'
  ) {
    throw new Error("[EDOT] exportProtocol must be 'otlp/http' or 'otlp/grpc'");
  }
}
