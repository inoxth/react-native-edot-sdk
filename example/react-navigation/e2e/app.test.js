const { device, element, by, expect, waitFor } = require('detox');

describe('React Navigation Example', () => {
  beforeAll(async () => { await device.launchApp({ newInstance: true }); });

  describe('Tab Navigation', () => {
    it('shows bottom tabs', async () => {
      await expect(element(by.id('tab-home'))).toBeVisible();
      await expect(element(by.id('tab-demos'))).toBeVisible();
      await expect(element(by.id('tab-settings'))).toBeVisible();
    });
    it('switches to Demos tab', async () => {
      await element(by.id('tab-demos')).tap();
      await expect(element(by.id('demos-btn-network'))).toBeVisible();
    });
    it('switches to Settings tab', async () => {
      await element(by.id('tab-settings')).tap();
      await expect(element(by.id('settings-server-url'))).toBeVisible();
    });
    it('switches back to Home tab', async () => {
      await element(by.id('tab-home')).tap();
      await expect(element(by.id('home-status'))).toBeVisible();
    });
  });

  describe('Home Screen', () => {
    it('shows SDK status and session', async () => {
      await expect(element(by.id('home-status'))).toBeVisible();
      await expect(element(by.id('home-session'))).toBeVisible();
    });
    it('taps user and attribute buttons', async () => {
      await element(by.id('home-btn-set-user')).tap();
      await element(by.id('home-btn-clear-user')).tap();
      await element(by.id('home-btn-set-session-attr')).tap();
      await element(by.id('home-btn-set-global-attr')).tap();
      await element(by.id('home-btn-remove-global-attr')).tap();
    });
  });

  describe('Demo Screens', () => {
    beforeAll(async () => {
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(3000);
    });

    it('navigates to Network demo and interacts', async () => {
      await element(by.id('demos-btn-network')).tap();
      await waitFor(element(by.id('network-btn-fetch'))).toBeVisible().withTimeout(3000);
      await element(by.id('network-btn-fetch')).tap();
      await element(by.id('network-btn-fetch-error')).tap();
      await element(by.id('network-btn-xhr')).tap();
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-network'))).toBeVisible().withTimeout(3000);
    });

    it('navigates to Tracing demo and interacts', async () => {
      await element(by.id('demos-btn-tracing')).tap();
      await waitFor(element(by.id('tracing-btn-create-span'))).toBeVisible().withTimeout(3000);
      await element(by.id('tracing-btn-create-span')).tap();
      await element(by.id('tracing-btn-nested-spans')).tap();
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-tracing'))).toBeVisible().withTimeout(3000);
    });

    it('navigates to Metrics demo and interacts', async () => {
      await element(by.id('demos-btn-metrics')).tap();
      await waitFor(element(by.id('metrics-btn-counter'))).toBeVisible().withTimeout(3000);
      await element(by.id('metrics-btn-counter')).tap();
      await element(by.id('metrics-btn-histogram')).tap();
      await element(by.id('metrics-btn-updown')).tap();
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-metrics'))).toBeVisible().withTimeout(3000);
    });

    it('navigates to Logs demo and interacts', async () => {
      await element(by.id('demos-btn-logs')).tap();
      await waitFor(element(by.id('logs-btn-info'))).toBeVisible().withTimeout(3000);
      await element(by.id('logs-btn-info')).tap();
      await element(by.id('logs-btn-warn')).tap();
      await element(by.id('logs-btn-error')).tap();
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-logs'))).toBeVisible().withTimeout(3000);
    });

    it('navigates to Error demo and interacts', async () => {
      await element(by.id('demos-btn-errors')).tap();
      await waitFor(element(by.id('errors-btn-error-boundary'))).toBeVisible().withTimeout(3000);
      await element(by.id('errors-btn-error-boundary')).tap();
      await element(by.id('tab-demos')).tap();
      await waitFor(element(by.id('demos-btn-errors'))).toBeVisible().withTimeout(3000);
    });
  });
});
