const { device, element, by, expect } = require('detox');

describe('EDOT Wix Navigation Example', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Tab navigation', () => {
    it('should show Home tab by default', async () => {
      await expect(element(by.id('home-status'))).toBeVisible();
    });

    it('should navigate to Demos tab', async () => {
      await element(by.id('tab-demos')).tap();
      await expect(element(by.id('demos-btn-network'))).toBeVisible();
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

  describe('Home screen interactions', () => {
    beforeAll(async () => {
      await element(by.id('tab-home')).tap();
    });

    it('should show status and session', async () => {
      await expect(element(by.id('home-status'))).toBeVisible();
      await expect(element(by.id('home-session'))).toBeVisible();
    });

    it('should tap Set User', async () => {
      await element(by.id('home-btn-set-user')).tap();
    });

    it('should tap Clear User', async () => {
      await element(by.id('home-btn-clear-user')).tap();
    });

    it('should tap Set Session Attr', async () => {
      await element(by.id('home-btn-set-session-attr')).tap();
    });

    it('should tap Set Global Attr', async () => {
      await element(by.id('home-btn-set-global-attr')).tap();
    });

    it('should tap Remove Global Attr', async () => {
      await element(by.id('home-btn-remove-global-attr')).tap();
    });
  });

  describe('Network demo', () => {
    beforeAll(async () => {
      await element(by.id('tab-demos')).tap();
      await element(by.id('demos-btn-network')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
    });

    it('should tap Fetch Data', async () => {
      await element(by.id('network-btn-fetch')).tap();
    });

    it('should tap Fetch Error', async () => {
      await element(by.id('network-btn-fetch-error')).tap();
    });

    it('should tap Fetch Multiple', async () => {
      await element(by.id('network-btn-fetch-multiple')).tap();
    });

    it('should tap XHR Request', async () => {
      await element(by.id('network-btn-xhr')).tap();
    });
  });

  describe('Tracing demo', () => {
    beforeAll(async () => {
      await element(by.id('demos-btn-tracing')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
    });

    it('should tap Create Span', async () => {
      await element(by.id('tracing-btn-create-span')).tap();
    });

    it('should tap Nested Spans', async () => {
      await element(by.id('tracing-btn-nested-spans')).tap();
    });
  });

  describe('Metrics demo', () => {
    beforeAll(async () => {
      await element(by.id('demos-btn-metrics')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
    });

    it('should tap Counter', async () => {
      await element(by.id('metrics-btn-counter')).tap();
    });

    it('should tap Histogram', async () => {
      await element(by.id('metrics-btn-histogram')).tap();
    });

    it('should tap UpDownCounter', async () => {
      await element(by.id('metrics-btn-updown')).tap();
    });
  });

  describe('Logs demo', () => {
    beforeAll(async () => {
      await element(by.id('demos-btn-logs')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
    });

    it('should tap Info Log', async () => {
      await element(by.id('logs-btn-info')).tap();
    });

    it('should tap Warn Log', async () => {
      await element(by.id('logs-btn-warn')).tap();
    });

    it('should tap Error Log', async () => {
      await element(by.id('logs-btn-error')).tap();
    });
  });

  describe('Error demo', () => {
    beforeAll(async () => {
      await element(by.id('demos-btn-errors')).tap();
    });

    afterAll(async () => {
      await device.pressBack();
    });

    it('should tap Error Boundary', async () => {
      await element(by.id('errors-btn-error-boundary')).tap();
    });

    it('should tap Native Crash', async () => {
      await element(by.id('errors-btn-native-crash')).tap();
    });
  });

  describe('Settings screen', () => {
    beforeAll(async () => {
      await element(by.id('tab-settings')).tap();
    });

    it('should show Server URL', async () => {
      await expect(element(by.id('settings-server-url'))).toBeVisible();
    });

    it('should show Service Name', async () => {
      await expect(element(by.id('settings-service-name'))).toBeVisible();
    });
  });
});
