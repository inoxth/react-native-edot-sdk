const { device, element, by, expect, waitFor } = require('detox');

async function navigateBack() {
  if (device.getPlatform() === 'ios') {
    await element(by.type('_UIButtonBarButton')).atIndex(0).tap();
  } else {
    await device.pressBack();
  }
}

// Tab navigation via deep link — avoids Detox visibility bounds issues on
// iOS debug builds where tab buttons at non-zero indices are reported as
// not hittable. The edot-expo-router scheme routes straight to the tab screen.
async function goToTab(route) {
  await device.openURL({ url: `edot-expo-router:///${route}` });
}

describe('EDOT Expo Router Example', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await waitFor(element(by.id('home-status'))).toBeVisible().withTimeout(10000);
  });

  describe('Tab Navigation', () => {
    it('should show Home tab by default', async () => {
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should navigate to Demos tab', async () => {
      await goToTab('demos');
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should navigate to Settings tab', async () => {
      await goToTab('settings');
      await waitFor(element(by.id('settings-server-url'))).toBeVisible().withTimeout(3000);
    });

    it('should navigate back to Home tab', async () => {
      await goToTab('');
      await waitFor(element(by.id('home-status'))).toBeVisible().withTimeout(3000);
    });
  });

  describe('Home Screen Interactions', () => {
    beforeAll(async () => {
      await goToTab('');
    });

    it('should tap Set User button', async () => {
      await element(by.id('home-btn-set-user')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should tap Clear User button', async () => {
      await element(by.id('home-btn-clear-user')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should tap Set Session Attribute button', async () => {
      await element(by.id('home-btn-set-session-attr')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should tap Set Global Attribute button', async () => {
      await element(by.id('home-btn-set-global-attr')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should tap Remove Global Attribute button', async () => {
      await element(by.id('home-btn-remove-global-attr')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });
  });

  describe('Demo Screen Navigation', () => {
    beforeAll(async () => {
      await goToTab('demos');
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should open Network demo and go back', async () => {
      await element(by.id('demos-btn-network')).tap();
      await waitFor(element(by.id('network-btn-fetch'))).toBeVisible().withTimeout(3000);
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should open Tracing demo and go back', async () => {
      await element(by.id('demos-btn-tracing')).tap();
      await waitFor(element(by.id('tracing-btn-create-span'))).toBeVisible().withTimeout(3000);
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should open Metrics demo and go back', async () => {
      await element(by.id('demos-btn-metrics')).tap();
      await waitFor(element(by.id('metrics-btn-counter'))).toBeVisible().withTimeout(3000);
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should open Logs demo and go back', async () => {
      await element(by.id('demos-btn-logs')).tap();
      await waitFor(element(by.id('logs-btn-info'))).toBeVisible().withTimeout(3000);
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should open Errors demo and go back', async () => {
      await element(by.id('demos-btn-errors')).tap();
      await waitFor(element(by.id('errors-btn-js-error'))).toBeVisible().withTimeout(3000);
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });
  });

  describe('Network Demo', () => {
    beforeAll(async () => {
      await goToTab('demos');
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(3000);
      await element(by.id('demos-btn-network')).tap();
      await waitFor(element(by.id('network-btn-fetch'))).toBeVisible().withTimeout(3000);
    });

    afterAll(async () => {
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should tap Fetch Data button', async () => {
      await element(by.id('network-btn-fetch')).tap();
      await expect(element(by.id('network-btn-fetch'))).toBeVisible();
    });

    it('should tap Fetch Error button', async () => {
      await element(by.id('network-btn-fetch-error')).tap();
      await expect(element(by.id('network-btn-fetch-error'))).toBeVisible();
    });

    it('should tap Fetch Multiple button', async () => {
      await element(by.id('network-btn-fetch-multiple')).tap();
      await expect(element(by.id('network-btn-fetch-multiple'))).toBeVisible();
    });

    it('should tap XHR button', async () => {
      await element(by.id('network-btn-xhr')).tap();
      await expect(element(by.id('network-btn-xhr'))).toBeVisible();
    });
  });

  describe('Tracing Demo', () => {
    beforeAll(async () => {
      await goToTab('demos');
      await waitFor(element(by.id('demos-btn-tracing'))).toBeVisible().withTimeout(3000);
      await element(by.id('demos-btn-tracing')).tap();
      await waitFor(element(by.id('tracing-btn-create-span'))).toBeVisible().withTimeout(3000);
    });

    afterAll(async () => {
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should tap Create Span button', async () => {
      await element(by.id('tracing-btn-create-span')).tap();
      await expect(element(by.id('tracing-btn-create-span'))).toBeVisible();
    });

    it('should tap Nested Spans button', async () => {
      await element(by.id('tracing-btn-nested-spans')).tap();
      await expect(element(by.id('tracing-btn-nested-spans'))).toBeVisible();
    });
  });

  describe('Metrics Demo', () => {
    beforeAll(async () => {
      await goToTab('demos');
      await waitFor(element(by.id('demos-btn-metrics'))).toBeVisible().withTimeout(3000);
      await element(by.id('demos-btn-metrics')).tap();
      await waitFor(element(by.id('metrics-btn-counter'))).toBeVisible().withTimeout(3000);
    });

    afterAll(async () => {
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should tap Counter button', async () => {
      await element(by.id('metrics-btn-counter')).tap();
      await expect(element(by.id('metrics-btn-counter'))).toBeVisible();
    });

    it('should tap Histogram button', async () => {
      await element(by.id('metrics-btn-histogram')).tap();
      await expect(element(by.id('metrics-btn-histogram'))).toBeVisible();
    });

    it('should tap UpDownCounter button', async () => {
      await element(by.id('metrics-btn-updown')).tap();
      await expect(element(by.id('metrics-btn-updown'))).toBeVisible();
    });
  });

  describe('Logs Demo', () => {
    beforeAll(async () => {
      await goToTab('demos');
      await waitFor(element(by.id('demos-btn-logs'))).toBeVisible().withTimeout(3000);
      await element(by.id('demos-btn-logs')).tap();
      await waitFor(element(by.id('logs-btn-info'))).toBeVisible().withTimeout(3000);
    });

    afterAll(async () => {
      await navigateBack();
      await waitFor(element(by.text('Demo Screens'))).toBeVisible().withTimeout(3000);
    });

    it('should tap Info log button', async () => {
      await element(by.id('logs-btn-info')).tap();
      await expect(element(by.id('logs-btn-info'))).toBeVisible();
    });

    it('should tap Warning log button', async () => {
      await element(by.id('logs-btn-warn')).tap();
      await expect(element(by.id('logs-btn-warn'))).toBeVisible();
    });

    it('should tap Error log button', async () => {
      await element(by.id('logs-btn-error')).tap();
      await expect(element(by.id('logs-btn-error'))).toBeVisible();
    });
  });

  describe('Errors Demo', () => {
    beforeAll(async () => {
      await goToTab('demos');
      await waitFor(element(by.id('demos-btn-errors'))).toBeVisible().withTimeout(3000);
      await element(by.id('demos-btn-errors')).tap();
      await waitFor(element(by.id('errors-btn-promise-reject'))).toBeVisible().withTimeout(3000);
    });

    afterAll(async () => {
      // React Native's LogBox shows a render error overlay even when caught by an error
      // boundary. Relaunch to clear it so the Settings Screen tests are not blocked.
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
      await waitFor(element(by.id('home-status'))).toBeVisible().withTimeout(10000);
    });

    it('should tap Promise Reject button', async () => {
      await element(by.id('errors-btn-promise-reject')).tap();
      await expect(element(by.id('errors-btn-promise-reject'))).toBeVisible();
    });

    it('should tap Native Crash button', async () => {
      await element(by.id('errors-btn-native-crash')).tap();
      await expect(element(by.id('errors-btn-native-crash'))).toBeVisible();
    });

    it('should tap ErrorBoundary button', async () => {
      await element(by.id('errors-btn-error-boundary')).tap();
      // Debug builds show a Render Error overlay that covers the screen; use toExist()
      // (view-hierarchy check) instead of toBeVisible() which requires no occlusion.
      await expect(element(by.id('errors-btn-error-boundary'))).toExist();
    });
  });

  describe('Settings Screen', () => {
    beforeAll(async () => {
      await goToTab('settings');
    });

    it('should display server URL', async () => {
      await waitFor(element(by.id('settings-server-url'))).toBeVisible().withTimeout(5000);
    });

    it('should display service name', async () => {
      await waitFor(element(by.id('settings-service-name'))).toBeVisible().withTimeout(5000);
    });
  });
});
