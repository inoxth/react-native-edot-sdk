const { device, element, by, expect } = require('detox');

describe('EDOT Expo Router Example', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Tab Navigation', () => {
    it('should show Home tab by default', async () => {
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should navigate to Demos tab', async () => {
      await element(by.id('tab-demos')).tap();
      await expect(element(by.text('Demo Screens'))).toBeVisible();
    });

    it('should navigate to Settings tab', async () => {
      await element(by.id('tab-settings')).tap();
      await expect(element(by.id('settings-server-url'))).toBeVisible();
    });

    it('should navigate back to Home tab', async () => {
      await element(by.id('tab-home')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });
  });

  describe('Home Screen Interactions', () => {
    beforeAll(async () => {
      await element(by.id('tab-home')).tap();
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
      await element(by.id('tab-demos')).tap();
    });

    it('should open Network demo and go back', async () => {
      await element(by.id('demos-btn-network')).tap();
      await expect(element(by.id('network-btn-fetch'))).toBeVisible();
      await device.pressBack();
    });

    it('should open Tracing demo and go back', async () => {
      await element(by.id('demos-btn-tracing')).tap();
      await expect(element(by.id('tracing-btn-create-span'))).toBeVisible();
      await device.pressBack();
    });

    it('should open Metrics demo and go back', async () => {
      await element(by.id('demos-btn-metrics')).tap();
      await expect(element(by.id('metrics-btn-counter'))).toBeVisible();
      await device.pressBack();
    });

    it('should open Logs demo and go back', async () => {
      await element(by.id('demos-btn-logs')).tap();
      await expect(element(by.id('logs-btn-info'))).toBeVisible();
      await device.pressBack();
    });

    it('should open Errors demo and go back', async () => {
      await element(by.id('demos-btn-errors')).tap();
      await expect(element(by.id('errors-btn-js-error'))).toBeVisible();
      await device.pressBack();
    });
  });

  describe('Network Demo', () => {
    beforeAll(async () => {
      await element(by.id('tab-demos')).tap();
      await element(by.id('demos-btn-network')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
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
      await element(by.id('tab-demos')).tap();
      await element(by.id('demos-btn-tracing')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
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
      await element(by.id('tab-demos')).tap();
      await element(by.id('demos-btn-metrics')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
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
      await element(by.id('tab-demos')).tap();
      await element(by.id('demos-btn-logs')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
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
      await element(by.id('tab-demos')).tap();
      await element(by.id('demos-btn-errors')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
    });

    it('should tap Promise Reject button', async () => {
      await element(by.id('errors-btn-promise-reject')).tap();
      await expect(element(by.id('errors-btn-promise-reject'))).toBeVisible();
    });

    it('should tap ErrorBoundary button', async () => {
      await element(by.id('errors-btn-error-boundary')).tap();
      await expect(element(by.id('errors-btn-error-boundary'))).toBeVisible();
    });

    it('should tap Native Crash button', async () => {
      await element(by.id('errors-btn-native-crash')).tap();
      await expect(element(by.id('errors-btn-native-crash'))).toBeVisible();
    });
  });

  describe('Settings Screen', () => {
    beforeAll(async () => {
      await element(by.id('tab-settings')).tap();
    });

    it('should display server URL', async () => {
      await expect(element(by.id('settings-server-url'))).toBeVisible();
    });

    it('should display service name', async () => {
      await expect(element(by.id('settings-service-name'))).toBeVisible();
    });
  });
});
