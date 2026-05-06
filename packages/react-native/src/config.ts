import { Platform } from 'react-native';
import type {
  AttributeRedactions,
  EdotConfig,
  IgnoreLogRule,
  IgnoreSpanRule,
  RedactionRules,
  RegexSource,
} from './types';

const REQUIRED_FIELDS: (keyof EdotConfig)[] = [
  'serverUrl',
  'serviceVersion',
  'deploymentEnvironment',
];

const RESOURCE_IDENTITY_FIELDS: (keyof EdotConfig)[] = ['serviceVersion', 'deploymentEnvironment'];

type ResourceField = 'serviceName';

export function resolveResourceField(config: EdotConfig, field: ResourceField): string | undefined {
  const platformBlock =
    Platform.OS === 'ios' ? config.ios : Platform.OS === 'android' ? config.android : undefined;
  return platformBlock?.[field] ?? config[field];
}

function assertValidRegexSource(source: string, flags: string | undefined, field: string): void {
  try {
    new RegExp(source, flags);
  } catch {
    throw new Error(
      `[EDOT] ${field}: invalid regex source ${JSON.stringify(source)}` +
        (flags !== undefined ? ` with flags ${JSON.stringify(flags)}` : ''),
    );
  }
}

function validateRegexSource(value: RegexSource, field: string): void {
  assertValidRegexSource(value.source, value.flags, field);
}

function validateRedactionRules(rules: RedactionRules, prefix: string): void {
  if (rules.drop !== undefined) {
    for (let i = 0; i < rules.drop.length; i++) {
      const key = rules.drop[i];
      if (typeof key !== 'string' || key.length === 0) {
        throw new Error(`[EDOT] ${prefix}.drop[${i}]: must be a non-empty string`);
      }
    }
  }

  if (rules.dropPattern !== undefined) {
    validateRegexSource(rules.dropPattern, `${prefix}.dropPattern`);
  }

  if (rules.mask !== undefined) {
    for (const [key, value] of Object.entries(rules.mask)) {
      if (key.length === 0) {
        throw new Error(`[EDOT] ${prefix}.mask: keys must be non-empty strings`);
      }
      if (typeof value !== 'string') {
        throw new Error(`[EDOT] ${prefix}.mask[${JSON.stringify(key)}]: value must be a string`);
      }
    }
  }

  if (rules.maskPattern !== undefined) {
    for (let i = 0; i < rules.maskPattern.length; i++) {
      const entry = rules.maskPattern[i];
      validateRegexSource(entry, `${prefix}.maskPattern[${i}]`);
    }
  }
}

function validateAttributeRedactions(redactions: AttributeRedactions): void {
  if (redactions.spans !== undefined) {
    validateRedactionRules(redactions.spans, 'attributeRedactions.spans');
  }
  if (redactions.logs !== undefined) {
    validateRedactionRules(redactions.logs, 'attributeRedactions.logs');
  }
}

function validateIgnoreSpanRule(rule: IgnoreSpanRule, field: string): void {
  if (typeof rule === 'string') {
    return;
  }
  validateRegexSource(rule, field);
}

function validateIgnoreLogRule(rule: IgnoreLogRule, field: string): void {
  if (rule.name !== undefined) {
    if (typeof rule.name !== 'string') {
      validateRegexSource(rule.name, `${field}.name`);
    }
  }
}

export function validateConfig(config: EdotConfig): void {
  for (const field of REQUIRED_FIELDS) {
    if (!config[field]) {
      throw new Error(`[EDOT] ${field} is required`);
    }
  }

  const resolvedServiceName = resolveResourceField(config, 'serviceName');
  if (!resolvedServiceName) {
    throw new Error(
      '[EDOT] serviceName is required (set top-level serviceName or ios.serviceName / android.serviceName)',
    );
  }
  if (/[,=]/.test(resolvedServiceName)) {
    throw new Error(
      `[EDOT] serviceName must not contain ',' or '=' characters (got: ${JSON.stringify(resolvedServiceName)})`,
    );
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

  const PERSISTENCE_PRESETS = ['default', 'lowUsage', 'highVolume'] as const;
  if (
    config.ios?.persistencePreset !== undefined &&
    !PERSISTENCE_PRESETS.includes(config.ios.persistencePreset)
  ) {
    throw new Error(
      `[EDOT] ios.persistencePreset must be one of: ${PERSISTENCE_PRESETS.join(', ')}`,
    );
  }

  if (config.managementUrl !== undefined) {
    let parsed: URL;
    try {
      parsed = new URL(config.managementUrl);
    } catch {
      throw new Error(`[EDOT] managementUrl is not a valid URL: ${config.managementUrl}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `[EDOT] managementUrl must use http or https (got: ${parsed.protocol.replace(':', '')})`,
      );
    }
  }

  if (config.attributeRedactions !== undefined) {
    validateAttributeRedactions(config.attributeRedactions);
  }

  if (config.ignoreSpanNames !== undefined) {
    if (config.ignoreSpanNames.length === 0) {
      throw new Error('[EDOT] ignoreSpanNames must not be an empty array');
    }
    for (let i = 0; i < config.ignoreSpanNames.length; i++) {
      validateIgnoreSpanRule(config.ignoreSpanNames[i], `ignoreSpanNames[${i}]`);
    }
  }

  if (config.ignoreLogPatterns !== undefined) {
    if (config.ignoreLogPatterns.length === 0) {
      throw new Error('[EDOT] ignoreLogPatterns must not be an empty array');
    }
    for (let i = 0; i < config.ignoreLogPatterns.length; i++) {
      validateIgnoreLogRule(config.ignoreLogPatterns[i], `ignoreLogPatterns[${i}]`);
    }
  }
}
