import { getNativeModule } from '@inoxth/react-native-edot-shared';
import type { MeterProvider, Meter, Counter, Histogram, UpDownCounter } from './types';

function resolveAttributes(attributes?: Record<string, string>): Record<string, string> {
  return attributes ?? {};
}

function createMeter(_name: string, _version?: string): Meter {
  return {
    createCounter(name: string): Counter {
      return {
        add(value: number, attributes?: Record<string, string>): void {
          getNativeModule().recordMetric(name, value, resolveAttributes(attributes), 'counter');
        },
      };
    },

    createHistogram(name: string): Histogram {
      return {
        record(value: number, attributes?: Record<string, string>): void {
          getNativeModule().recordMetric(name, value, resolveAttributes(attributes), 'histogram');
        },
      };
    },

    createUpDownCounter(name: string): UpDownCounter {
      return {
        add(value: number, attributes?: Record<string, string>): void {
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
}
