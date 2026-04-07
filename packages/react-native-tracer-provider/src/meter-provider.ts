import type { MeterProvider, Meter, Counter, Histogram, UpDownCounter } from './types';

interface NativeModule {
  recordMetric(name: string, value: number, attributes: Record<string, string>, metricType: string): void;
}

let nativeModule: NativeModule | null = null;

function getNativeModule(): NativeModule {
  if (!nativeModule) {
    const mod = require('@inox-edot/react-native/nativeModule') as {
      EdotNativeModule: NativeModule;
    };
    nativeModule = mod.EdotNativeModule;
  }
  return nativeModule;
}

function stringifyAttributes(
  attributes?: Record<string, string | number | boolean>,
): Record<string, string> {
  if (!attributes) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    result[key] = String(value);
  }
  return result;
}

function createMeter(_name: string, _version?: string): Meter {
  return {
    createCounter(name: string): Counter {
      return {
        add(value: number, attributes?: Record<string, string | number | boolean>): void {
          getNativeModule().recordMetric(name, value, stringifyAttributes(attributes), 'counter');
        },
      };
    },

    createHistogram(name: string): Histogram {
      return {
        record(value: number, attributes?: Record<string, string | number | boolean>): void {
          getNativeModule().recordMetric(name, value, stringifyAttributes(attributes), 'histogram');
        },
      };
    },

    createUpDownCounter(name: string): UpDownCounter {
      return {
        add(value: number, attributes?: Record<string, string | number | boolean>): void {
          getNativeModule().recordMetric(
            name,
            value,
            stringifyAttributes(attributes),
            'up_down_counter',
          );
        },
      };
    },
  };
}

let meterProviderInstance: MeterProvider | null = null;

export function getMeterProvider(): MeterProvider {
  if (!meterProviderInstance) {
    meterProviderInstance = {
      getMeter(name: string, version?: string): Meter {
        return createMeter(name, version);
      },
    };
  }
  return meterProviderInstance;
}

export function resetMeterForTesting(): void {
  meterProviderInstance = null;
  nativeModule = null;
}
