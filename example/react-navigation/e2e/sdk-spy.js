'use strict';

const React = require('react');
const { View } = require('react-native');

global.__edotSpy = {
  networkSpans: 0,
  errorReports: 0,
  metricRecords: 0,
  logEmissions: 0,
};

// Require the SDK's nativeModule via the metro subpath alias so we get the
// exact same cached module object that fetch.ts / errors.ts / metrics access.
// We replace the EdotNativeModule export property with a Proxy so that every
// live _nativeModule.EdotNativeModule property lookup in the SDK picks up our
// wrapper, without needing to mutate the TurboModule host object directly.
const nativeMod = require('@inox/react-native-edot-sdk/nativeModule');
if (nativeMod && nativeMod.EdotNativeModule) {
  const original = nativeMod.EdotNativeModule;
  nativeMod.EdotNativeModule = new Proxy(original, {
    get(target, prop) {
      const value = target[prop];
      if (prop === 'startSpan') {
        return function (name) {
          if (typeof name === 'string' && (name.startsWith('HTTP ') || name.startsWith('GraphQL:'))) {
            global.__edotSpy.networkSpans++;
          }
          return value.apply(target, arguments);
        };
      }
      if (prop === 'reportJsException') {
        return function () {
          global.__edotSpy.errorReports++;
          return value.apply(target, arguments);
        };
      }
      if (prop === 'recordMetric') {
        return function () {
          global.__edotSpy.metricRecords++;
          return value.apply(target, arguments);
        };
      }
      if (prop === 'emitLog') {
        return function () {
          global.__edotSpy.logEmissions++;
          return value.apply(target, arguments);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function SdkSpyOverlay() {
  const [counts, setCounts] = React.useState(Object.assign({}, global.__edotSpy));

  React.useEffect(function () {
    const id = setInterval(function () {
      setCounts(Object.assign({}, global.__edotSpy));
    }, 200);
    return function () { clearInterval(id); };
  }, []);

  return React.createElement(
    View,
    { testID: 'sdk-spy-overlay', style: { position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' } },
    React.createElement(View, { testID: 'sdk-network-spans-' + counts.networkSpans, style: { width: 1, height: 1 } }),
    React.createElement(View, { testID: 'sdk-error-reports-' + counts.errorReports, style: { width: 1, height: 1 } }),
    React.createElement(View, { testID: 'sdk-metric-records-' + counts.metricRecords, style: { width: 1, height: 1 } }),
    React.createElement(View, { testID: 'sdk-log-emissions-' + counts.logEmissions, style: { width: 1, height: 1 } }),
  );
}

module.exports = { SdkSpyOverlay };
