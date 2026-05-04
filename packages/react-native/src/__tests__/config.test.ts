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

  it('accepts valid persistencePreset values', () => {
    expect(() => validateConfig({ ...validConfig, persistencePreset: 'default' })).not.toThrow();
    expect(() => validateConfig({ ...validConfig, persistencePreset: 'lowUsage' })).not.toThrow();
    expect(() => validateConfig({ ...validConfig, persistencePreset: 'highVolume' })).not.toThrow();
  });

  it('throws on invalid persistencePreset value', () => {
    expect(() =>
      validateConfig({ ...validConfig, persistencePreset: 'invalid' as 'default' }),
    ).toThrow('persistencePreset must be one of: default, lowUsage, highVolume');
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

  describe('attributeRedactions', () => {
    it('accepts valid drop rules', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: { spans: { drop: ['password', 'secret'] } },
        }),
      ).not.toThrow();
    });

    it('accepts valid dropPattern rule', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: { logs: { dropPattern: { source: '^internal\\..*', flags: 'i' } } },
        }),
      ).not.toThrow();
    });

    it('accepts valid mask rules', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: { spans: { mask: { 'user.token': '***' } } },
        }),
      ).not.toThrow();
    });

    it('accepts valid maskPattern rules', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: {
            spans: {
              maskPattern: [{ source: 'token.*', replacement: '[redacted]' }],
            },
          },
        }),
      ).not.toThrow();
    });

    it('accepts combined redaction rules on spans and logs', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: {
            spans: { drop: ['x-api-key'], mask: { 'user.email': '***' } },
            logs: {
              dropPattern: { source: '^debug\\..*' },
              maskPattern: [{ source: 'auth.*', replacement: '[masked]' }],
            },
          },
        }),
      ).not.toThrow();
    });

    it('rejects empty drop array item', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: { spans: { drop: ['valid', ''] } },
        }),
      ).toThrow('drop[1]: must be a non-empty string');
    });

    it('rejects malformed dropPattern regex source', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: { spans: { dropPattern: { source: '[invalid(' } } },
        }),
      ).toThrow('invalid regex source');
    });

    it('rejects non-string mask value', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: {
            spans: { mask: { 'user.email': 123 as unknown as string } },
          },
        }),
      ).toThrow('value must be a string');
    });

    it('rejects malformed maskPattern regex source', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          attributeRedactions: {
            spans: { maskPattern: [{ source: '(bad[', replacement: '***' }] },
          },
        }),
      ).toThrow('invalid regex source');
    });
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
});
