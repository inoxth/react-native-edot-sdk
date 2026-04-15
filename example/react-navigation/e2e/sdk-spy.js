'use strict';

const { NativeModules } = require('react-native');
const React = require('react');
const { View } = require('react-native');

global.__edotSpy = {
  networkSpans: 0,
  errorReports: 0,
  metricRecords: 0,
  logEmissions: 0,
};

const nativeModule = NativeModules.EdotReactNative;
if (nativeModule) {
  const origStartSpan = nativeModule.startSpan.bind(nativeModule);
  nativeModule.startSpan = function (name) {
    if (typeof name === 'string' && (name.startsWith('HTTP ') || name.startsWith('GraphQL:'))) {
      global.__edotSpy.networkSpans++;
    }
    return origStartSpan.apply(this, arguments);
  };

  const origReportJsException = nativeModule.reportJsException.bind(nativeModule);
  nativeModule.reportJsException = function () {
    global.__edotSpy.errorReports++;
    return origReportJsException.apply(this, arguments);
  };

  const origRecordMetric = nativeModule.recordMetric.bind(nativeModule);
  nativeModule.recordMetric = function () {
    global.__edotSpy.metricRecords++;
    return origRecordMetric.apply(this, arguments);
  };

  const origEmitLog = nativeModule.emitLog.bind(nativeModule);
  nativeModule.emitLog = function () {
    global.__edotSpy.logEmissions++;
    return origEmitLog.apply(this, arguments);
  };
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
