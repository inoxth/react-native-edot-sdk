import { validateConfig } from '../config';
import type { EdotConfig } from '../types';

const validConfig: EdotConfig = {
  serverUrl: 'https://apm.example.com:8200',
  serviceName: 'test-app',
  serviceVersion: '1.0.0',
  deploymentEnvironment: 'test',
};

describe('validateConfig', () => {
  it('accepts valid config', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('throws when serverUrl is missing', () => {
    expect(() => validateConfig({ ...validConfig, serverUrl: '' })).toThrow(
      'serverUrl is required',
    );
  });

  it('throws when serviceName is missing', () => {
    expect(() => validateConfig({ ...validConfig, serviceName: '' })).toThrow(
      'serviceName is required',
    );
  });

  it('throws when serviceVersion is missing', () => {
    expect(() => validateConfig({ ...validConfig, serviceVersion: '' })).toThrow(
      'serviceVersion is required',
    );
  });

  it('throws when deploymentEnvironment is missing', () => {
    expect(() => validateConfig({ ...validConfig, deploymentEnvironment: '' })).toThrow(
      'deploymentEnvironment is required',
    );
  });

  it('throws when both secretToken and apiKey are provided', () => {
    expect(() =>
      validateConfig({
        ...validConfig,
        secretToken: 'token',
        apiKey: 'key',
      }),
    ).toThrow('secretToken and apiKey are mutually exclusive');
  });

  it('accepts secretToken alone', () => {
    expect(() => validateConfig({ ...validConfig, secretToken: 'token' })).not.toThrow();
  });

  it('accepts apiKey alone', () => {
    expect(() => validateConfig({ ...validConfig, apiKey: 'key' })).not.toThrow();
  });

  it('throws when sessionSamplingRate is below 0', () => {
    expect(() => validateConfig({ ...validConfig, sessionSamplingRate: -0.1 })).toThrow(
      'sessionSamplingRate must be between 0.0 and 1.0',
    );
  });

  it('throws when sessionSamplingRate is above 1', () => {
    expect(() => validateConfig({ ...validConfig, sessionSamplingRate: 1.5 })).toThrow(
      'sessionSamplingRate must be between 0.0 and 1.0',
    );
  });

  it('accepts sessionSamplingRate at boundaries', () => {
    expect(() => validateConfig({ ...validConfig, sessionSamplingRate: 0 })).not.toThrow();
    expect(() => validateConfig({ ...validConfig, sessionSamplingRate: 1 })).not.toThrow();
  });

  it('throws for invalid exportProtocol', () => {
    expect(() =>
      validateConfig({
        ...validConfig,
        exportProtocol: 'invalid' as EdotConfig['exportProtocol'],
      }),
    ).toThrow("exportProtocol must be 'otlp/http' or 'otlp/grpc'");
  });
});
