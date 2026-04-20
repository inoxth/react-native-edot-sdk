import type { EdotConfig } from './types';

const REQUIRED_FIELDS: (keyof EdotConfig)[] = [
  'serverUrl',
  'serviceName',
  'serviceVersion',
  'deploymentEnvironment',
];

const RESOURCE_IDENTITY_FIELDS: (keyof EdotConfig)[] = [
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

  for (const field of RESOURCE_IDENTITY_FIELDS) {
    const value = config[field];
    if (typeof value === 'string' && /[,=]/.test(value)) {
      throw new Error(
        `[EDOT] ${field} must not contain ',' or '=' characters (got: ${JSON.stringify(value)})`,
      );
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
}
