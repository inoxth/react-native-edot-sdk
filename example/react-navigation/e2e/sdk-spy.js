'use strict';

const React = require('react');
const { View } = require('react-native');

function SdkSpyOverlay() {
  const [counts, setCounts] = React.useState(Object.assign({}, global.__edotSpy));

  React.useEffect(function () {
    const id = setInterval(function () {
      setCounts(Object.assign({}, global.__edotSpy));
    }, 200);
    return function () { clearInterval(id); };
  }, []);

  // No opacity:0 — iOS hides zero-alpha views from the accessibility tree,
  // making them invisible to XCUITest (and therefore Detox's toExist()).
  return React.createElement(
    View,
    { testID: 'sdk-spy-overlay', style: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, overflow: 'visible' }, pointerEvents: 'none' },
    React.createElement(View, { testID: 'sdk-network-spans-' + counts.networkSpans, style: { width: 1, height: 1 } }),
    React.createElement(View, { testID: 'sdk-error-reports-' + counts.errorReports, style: { width: 1, height: 1 } }),
    React.createElement(View, { testID: 'sdk-metric-records-' + counts.metricRecords, style: { width: 1, height: 1 } }),
    React.createElement(View, { testID: 'sdk-log-emissions-' + counts.logEmissions, style: { width: 1, height: 1 } }),
  );
}

global.__edotSpy = {
  networkSpans: 0,
  errorReports: 0,
  metricRecords: 0,
  logEmissions: 0,
  SdkSpyOverlay: SdkSpyOverlay,
};

try {
  var nativeMod = require('@inox/react-native-edot-sdk/nativeModule');
  if (nativeMod && nativeMod.EdotNativeModule) {
    var original = nativeMod.EdotNativeModule;
    nativeMod.EdotNativeModule = new Proxy(original, {
      get: function (target, prop) {
        var value = target[prop];
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
} catch (_e) {
  // nativeModule not resolvable — counters won't increment but overlay still renders
}

module.exports = { SdkSpyOverlay: SdkSpyOverlay };
