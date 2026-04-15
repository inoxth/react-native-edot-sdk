const { device, element, by, expect, waitFor } = require('detox');

async function navigateBack() {
  if (device.getPlatform() === 'ios') {
    await element(by.type('_UIButtonBarButton')).atIndex(0).tap();
  } else {
    await device.pressBack();
  }
}

describe('React Navigation Example', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await waitFor(element(by.id('tab-home'))).toBeVisible().withTimeout(10000);
  });

  describe('Tab Navigation', () => {
    it('shows bottom tabs', async () => {
      await expect(element(by.id('tab-home'))).toBeVisible();
      await expect(element(by.id('tab-demos'))).toBeVisible();
      await expect(element(by.id('tab-settings'))).toBeVisible();
    });
    it('switches to Demos tab', async () => {
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(5000);
    });
    it('switches to Settings tab', async () => {
      await element(by.id('tab-settings')).tap();
      await waitFor(element(by.id('settings-server-url'))).toBeVisible().withTimeout(5000);
    });
    it('switches back to Home tab', async () => {
      await element(by.id('tab-home')).tap();
      await waitFor(element(by.id('home-status'))).toBeVisible().withTimeout(5000);
    });
  });

  describe('Home Screen', () => {
    it('shows SDK status and session', async () => {
      await waitFor(element(by.id('home-status'))).toBeVisible().withTimeout(5000);
      await waitFor(element(by.id('home-session'))).toBeVisible().withTimeout(5000);
    });
    it('taps user and attribute buttons', async () => {
      await waitFor(element(by.id('home-btn-set-user'))).toBeVisible().withTimeout(3000);
      await element(by.id('home-btn-set-user')).tap();
      await waitFor(element(by.id('home-btn-clear-user'))).toBeVisible().withTimeout(5000);
      await element(by.id('home-btn-clear-user')).tap();
      await waitFor(element(by.id('home-btn-set-session-attr'))).toBeVisible().withTimeout(5000);
      await element(by.id('home-btn-set-session-attr')).tap();
      await waitFor(element(by.id('home-btn-set-global-attr'))).toBeVisible().withTimeout(5000);
      await element(by.id('home-btn-set-global-attr')).tap();
      await waitFor(element(by.id('home-btn-remove-global-attr'))).toBeVisible().withTimeout(5000);
      await element(by.id('home-btn-remove-global-attr')).tap();
    });
  });

  describe('Demo Screens', () => {
    beforeAll(async () => {
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(5000);
    });

    it('navigates to Network demo and interacts', async () => {
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(5000);
      await element(by.id('demos-btn-network')).tap();

      await waitFor(element(by.id('network-btn-fetch'))).toBeVisible().withTimeout(5000);
      await element(by.id('network-btn-fetch')).tap();
      await waitFor(element(by.id('sdk-network-spans-1'))).toExist().withTimeout(10000);

      await waitFor(element(by.id('network-btn-fetch-error'))).toBeVisible().withTimeout(5000);
      await element(by.id('network-btn-fetch-error')).tap();
      await waitFor(element(by.id('sdk-network-spans-2'))).toExist().withTimeout(10000);

      await waitFor(element(by.id('network-btn-fetch-multiple'))).toBeVisible().withTimeout(5000);
      await element(by.id('network-btn-fetch-multiple')).tap();
      await waitFor(element(by.id('sdk-network-spans-5'))).toExist().withTimeout(15000);

      await waitFor(element(by.id('network-btn-xhr'))).toBeVisible().withTimeout(5000);
      await element(by.id('network-btn-xhr')).tap();
      await waitFor(element(by.id('sdk-network-spans-6'))).toExist().withTimeout(10000);

      await navigateBack();
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(5000);
    });

    it('navigates to Tracing demo and interacts', async () => {
      await waitFor(element(by.id('demos-btn-tracing'))).toBeVisible().withTimeout(5000);
      await element(by.id('demos-btn-tracing')).tap();
      await waitFor(element(by.id('tracing-btn-create-span'))).toBeVisible().withTimeout(5000);
      await element(by.id('tracing-btn-create-span')).tap();
      await waitFor(element(by.id('tracing-btn-nested-spans'))).toBeVisible().withTimeout(5000);
      await element(by.id('tracing-btn-nested-spans')).tap();
      await navigateBack();
      await waitFor(element(by.id('demos-btn-tracing'))).toBeVisible().withTimeout(5000);
    });

    it('navigates to Metrics demo and interacts', async () => {
      await waitFor(element(by.id('demos-btn-metrics'))).toBeVisible().withTimeout(5000);
      await element(by.id('demos-btn-metrics')).tap();

      await waitFor(element(by.id('metrics-btn-counter'))).toBeVisible().withTimeout(5000);
      await element(by.id('metrics-btn-counter')).tap();
      await waitFor(element(by.id('sdk-metric-records-1'))).toExist().withTimeout(5000);

      await waitFor(element(by.id('metrics-btn-histogram'))).toBeVisible().withTimeout(5000);
      await element(by.id('metrics-btn-histogram')).tap();
      await waitFor(element(by.id('sdk-metric-records-2'))).toExist().withTimeout(5000);

      await waitFor(element(by.id('metrics-btn-updown'))).toBeVisible().withTimeout(5000);
      await element(by.id('metrics-btn-updown')).tap();
      await waitFor(element(by.id('sdk-metric-records-3'))).toExist().withTimeout(5000);

      await waitFor(element(by.id('metrics-btn-updown-decrement'))).toBeVisible().withTimeout(5000);
      await element(by.id('metrics-btn-updown-decrement')).tap();
      await waitFor(element(by.id('sdk-metric-records-4'))).toExist().withTimeout(5000);

      await navigateBack();
      await waitFor(element(by.id('demos-btn-metrics'))).toBeVisible().withTimeout(5000);
    });

    it('navigates to Logs demo and interacts', async () => {
      await waitFor(element(by.id('demos-btn-logs'))).toBeVisible().withTimeout(5000);
      await element(by.id('demos-btn-logs')).tap();

      await waitFor(element(by.id('logs-btn-info'))).toBeVisible().withTimeout(5000);
      await element(by.id('logs-btn-info')).tap();
      await waitFor(element(by.id('sdk-log-emissions-1'))).toExist().withTimeout(5000);

      await waitFor(element(by.id('logs-btn-warn'))).toBeVisible().withTimeout(5000);
      await element(by.id('logs-btn-warn')).tap();
      await waitFor(element(by.id('sdk-log-emissions-2'))).toExist().withTimeout(5000);

      await waitFor(element(by.id('logs-btn-error'))).toBeVisible().withTimeout(5000);
      await element(by.id('logs-btn-error')).tap();
      await waitFor(element(by.id('sdk-log-emissions-3'))).toExist().withTimeout(5000);

      await navigateBack();
      await waitFor(element(by.id('demos-btn-logs'))).toBeVisible().withTimeout(5000);
    });

    it('navigates to Error demo and interacts', async () => {
      await waitFor(element(by.id('demos-btn-errors'))).toBeVisible().withTimeout(5000);
      await element(by.id('demos-btn-errors')).tap();

      // Promise reject — non-fatal unhandled rejection; SDK captures it
      await waitFor(element(by.id('errors-btn-promise-reject'))).toBeVisible().withTimeout(5000);
      await element(by.id('errors-btn-promise-reject')).tap();
      await waitFor(element(by.id('sdk-error-reports-1'))).toExist().withTimeout(5000);

      // Native crash — shows an Alert placeholder, dismiss it (no SDK call)
      await waitFor(element(by.id('errors-btn-native-crash'))).toBeVisible().withTimeout(5000);
      await element(by.id('errors-btn-native-crash')).tap();
      await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(3000);
      await element(by.text('OK')).tap();

      // JS error — thrown in setTimeout; fatal in release, red screen in debug
      await waitFor(element(by.id('errors-btn-js-error'))).toBeVisible().withTimeout(5000);
      try {
        await element(by.id('errors-btn-js-error')).tap();
        await new Promise(r => setTimeout(r, 500));
      } catch {
        // Fatal in release mode
      }
      // Relaunch to clear the error state; spy counters reset to 0
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
      await waitFor(element(by.id('tab-home'))).toBeVisible().withTimeout(10000);
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-errors'))).toBeVisible().withTimeout(5000);
      await element(by.id('demos-btn-errors')).tap();

      // Error boundary — triggers a render crash caught by EdotErrorBoundary; SDK reports it
      await waitFor(element(by.id('errors-btn-error-boundary'))).toBeVisible().withTimeout(5000);
      await element(by.id('errors-btn-error-boundary')).tap();
      // Debug builds show a Render Error overlay — dismiss it before asserting
      try {
        await waitFor(element(by.text('Dismiss'))).toBeVisible().withTimeout(3000);
        await element(by.text('Dismiss')).tap();
      } catch {
        // No overlay in release/non-debug builds
      }
      // errorReports restarted from 0 after relaunch; error boundary tap = 1
      await waitFor(element(by.id('sdk-error-reports-1'))).toExist().withTimeout(5000);
      await navigateBack();
      await waitFor(element(by.id('demos-btn-errors'))).toBeVisible().withTimeout(5000);
    });
  });
});
