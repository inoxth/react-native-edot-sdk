import type { MeterProvider, Meter, Counter, Histogram, UpDownCounter } from './types';

interface NativeModule {
  recordMetric(
    name: string,
    value: number,
    attributes: Record<string, string | number | boolean>,
    metricType: string,
  ): void;
}

let nativeModule: NativeModule | null = null;

function getNativeModule(): NativeModule {
  if (!nativeModule) {
    const mod = require('@inox/react-native-edot-sdk/nativeModule') as {
      EdotNativeModule: NativeModule;
    };
    nativeModule = mod.EdotNativeModule;
  }
  return nativeModule;
}

function resolveAttributes(
  attributes?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return attributes ?? {};
}

function createMeter(_name: string, _version?: string): Meter {
  return {
    createCounter(name: string): Counter {
      return {
        add(value: number, attributes?: Record<string, string | number | boolean>): void {
          getNativeModule().recordMetric(name, value, resolveAttributes(attributes), 'counter');
        },
      };
    },

    createHistogram(name: string): Histogram {
      return {
        record(value: number, attributes?: Record<string, string | number | boolean>): void {
          getNativeModule().recordMetric(name, value, resolveAttributes(attributes), 'histogram');
        },
      };
    },

    createUpDownCounter(name: string): UpDownCounter {
      return {
        add(value: number, attributes?: Record<string, string | number | boolean>): void {
          getNativeModule().recordMetric(
            name,
            value,
            resolveAttributes(attributes),
            'upDownCounter',
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
