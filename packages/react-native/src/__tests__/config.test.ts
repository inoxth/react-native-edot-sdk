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
      'serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)',
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

  it('rejects serviceName containing reserved characters', () => {
    expect(() => validateConfig({ ...validConfig, serviceName: 'foo,bar' })).toThrow(
      "serviceName must not contain ',' or '='",
    );
    expect(() => validateConfig({ ...validConfig, serviceName: 'foo=bar' })).toThrow(
      "serviceName must not contain ',' or '='",
    );
  });

  it('rejects serviceVersion containing reserved characters', () => {
    expect(() => validateConfig({ ...validConfig, serviceVersion: '1.0=beta' })).toThrow(
      "serviceVersion must not contain ',' or '='",
    );
  });

  it('rejects deploymentEnvironment containing reserved characters', () => {
    expect(() => validateConfig({ ...validConfig, deploymentEnvironment: 'prod,staging' })).toThrow(
      "deploymentEnvironment must not contain ',' or '='",
    );
  });

  it('accepts valid ios.persistencePreset values', () => {
    expect(() =>
      validateConfig({ ...validConfig, ios: { persistencePreset: 'default' } }),
    ).not.toThrow();
    expect(() =>
      validateConfig({ ...validConfig, ios: { persistencePreset: 'lowUsage' } }),
    ).not.toThrow();
    expect(() =>
      validateConfig({ ...validConfig, ios: { persistencePreset: 'highVolume' } }),
    ).not.toThrow();
  });

  it('throws on invalid ios.persistencePreset value', () => {
    expect(() =>
      validateConfig({ ...validConfig, ios: { persistencePreset: 'invalid' as 'default' } }),
    ).toThrow('ios.persistencePreset must be one of: default, lowUsage, highVolume');
  });

  it('accepts valid managementUrl', () => {
    expect(() =>
      validateConfig({ ...validConfig, managementUrl: 'https://config.example.com' }),
    ).not.toThrow();
    expect(() =>
      validateConfig({ ...validConfig, managementUrl: 'http://config.example.com:9200' }),
    ).not.toThrow();
  });

  it('throws on non-parseable managementUrl', () => {
    expect(() => validateConfig({ ...validConfig, managementUrl: 'not a url' })).toThrow(
      'managementUrl is not a valid URL',
    );
  });

  it('throws when managementUrl uses a non-http scheme', () => {
    expect(() =>
      validateConfig({ ...validConfig, managementUrl: 'ftp://config.example.com' }),
    ).toThrow('managementUrl must use http or https');
  });

  it('accepts disableAgent boolean', () => {
    expect(() => validateConfig({ ...validConfig, disableAgent: true })).not.toThrow();
    expect(() => validateConfig({ ...validConfig, disableAgent: false })).not.toThrow();
  });

  describe('ignoreSpanNames', () => {
    it('accepts exact string rules', () => {
      expect(() =>
        validateConfig({ ...validConfig, ignoreSpanNames: ['health-check', 'ping'] }),
      ).not.toThrow();
    });

    it('accepts regex source rules', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          ignoreSpanNames: [{ source: '^internal/.*', flags: 'i' }, 'exact-name'],
        }),
      ).not.toThrow();
    });

    it('rejects empty array', () => {
      expect(() => validateConfig({ ...validConfig, ignoreSpanNames: [] })).toThrow(
        'ignoreSpanNames must not be an empty array',
      );
    });

    it('rejects malformed regex source in ignoreSpanNames', () => {
      expect(() =>
        validateConfig({ ...validConfig, ignoreSpanNames: [{ source: '[bad(' }] }),
      ).toThrow('invalid regex source');
    });
  });

  describe('ignoreLogPatterns', () => {
    it('accepts name string rule', () => {
      expect(() =>
        validateConfig({ ...validConfig, ignoreLogPatterns: [{ name: 'debug-heartbeat' }] }),
      ).not.toThrow();
    });

    it('accepts name regex source rule', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          ignoreLogPatterns: [{ name: { source: '^heartbeat.*' } }],
        }),
      ).not.toThrow();
    });

    it('accepts minSeverity rule', () => {
      expect(() =>
        validateConfig({ ...validConfig, ignoreLogPatterns: [{ minSeverity: 'warn' }] }),
      ).not.toThrow();
    });

    it('accepts combined name + minSeverity rule', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          ignoreLogPatterns: [{ name: 'noisy-log', minSeverity: 'info' }],
        }),
      ).not.toThrow();
    });

    it('rejects empty array', () => {
      expect(() => validateConfig({ ...validConfig, ignoreLogPatterns: [] })).toThrow(
        'ignoreLogPatterns must not be an empty array',
      );
    });

    it('rejects malformed regex source in ignoreLogPatterns', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          ignoreLogPatterns: [{ name: { source: '(broken[' } }],
        }),
      ).toThrow('invalid regex source');
    });
  });

  describe('per-platform serviceName', () => {
    afterEach(() => {
      jest.dontMock('react-native');
      jest.resetModules();
    });

    function loadValidator(platformOS: 'ios' | 'android'): (config: EdotConfig) => void {
      jest.doMock('react-native', () => ({ Platform: { OS: platformOS } }));
      jest.resetModules();
      return require('../config').validateConfig;
    }

    function baseConfigWithoutServiceName(): EdotConfig {
      const { serviceName: _omit, ...rest } = validConfig;
      return rest;
    }

    it('accepts ios.serviceName when top-level serviceName is missing on iOS', () => {
      const validate = loadValidator('ios');
      expect(() =>
        validate({ ...baseConfigWithoutServiceName(), ios: { serviceName: 'myapp-ios' } }),
      ).not.toThrow();
    });

    it('accepts android.serviceName when top-level serviceName is missing on Android', () => {
      const validate = loadValidator('android');
      expect(() =>
        validate({ ...baseConfigWithoutServiceName(), android: { serviceName: 'myapp-android' } }),
      ).not.toThrow();
    });

    it('throws on Android when only ios.serviceName is provided', () => {
      const validate = loadValidator('android');
      expect(() =>
        validate({ ...baseConfigWithoutServiceName(), ios: { serviceName: 'myapp-ios' } }),
      ).toThrow(
        'serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)',
      );
    });

    it('throws on iOS when only android.serviceName is provided', () => {
      const validate = loadValidator('ios');
      expect(() =>
        validate({ ...baseConfigWithoutServiceName(), android: { serviceName: 'myapp-android' } }),
      ).toThrow(
        'serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)',
      );
    });

    it("rejects ios.serviceName containing ',' or '='", () => {
      const validate = loadValidator('ios');
      expect(() =>
        validate({ ...baseConfigWithoutServiceName(), ios: { serviceName: 'foo,bar' } }),
      ).toThrow("serviceName must not contain ',' or '='");
    });

    it('throws when active-platform serviceName is empty even with no top-level value', () => {
      const validate = loadValidator('ios');
      expect(() =>
        validate({ ...baseConfigWithoutServiceName(), ios: { serviceName: '' } }),
      ).toThrow(
        'serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)',
      );
    });
  });
});
