const { device, element, by, expect, waitFor } = require('detox');

describe('EDOT Example App', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('should show the app title', async () => {
    await expect(element(by.id('title'))).toBeVisible();
  });

  it('should show SDK status after init', async () => {
    await expect(element(by.id('status-text'))).toBeVisible();
  });

  it('should show session ID after init', async () => {
    await expect(element(by.id('session-text'))).toBeVisible();
  });

  describe('User & Session', () => {
    it('should tap Set User button', async () => {
      await element(by.id('btn-set-user')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Clear User button', async () => {
      await element(by.id('btn-clear-user')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Set Session Attr button', async () => {
      await element(by.id('btn-set-session-attr')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Set Global Attr button', async () => {
      await element(by.id('btn-set-global-attr')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Remove Global Attr button', async () => {
      await element(by.id('btn-remove-global-attr')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Manual Tracing', () => {
    it('should tap Create Span button', async () => {
      await element(by.id('scroll-view')).scrollTo('top');
      await element(by.id('btn-create-span')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Nested Spans button', async () => {
      await element(by.id('btn-nested-spans')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Metrics', () => {
    it('should tap Counter button', async () => {
      await element(by.id('btn-counter')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Histogram button', async () => {
      await element(by.id('btn-histogram')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap UpDownCounter button', async () => {
      await element(by.id('btn-updown-counter')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Structured Logs', () => {
    it('should tap Log Info button', async () => {
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.id('btn-log-info')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Log Warn button', async () => {
      await element(by.id('btn-log-warn')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Log Error button', async () => {
      await element(by.id('btn-log-error')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Network Requests', () => {
    it('should tap Fetch Data and wait for response', async () => {
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.id('btn-fetch-success')).tap();
      await waitFor(element(by.text(/Fetch OK/)))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should tap Fetch Error button', async () => {
      await element(by.id('btn-fetch-error')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Fetch Multiple button', async () => {
      await element(by.id('btn-fetch-multiple')).tap();
      await waitFor(element(by.text(/Sequential fetches complete/)))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('should tap XHR Request button', async () => {
      await element(by.id('btn-xhr-request')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Error Tracing', () => {
    it('should tap JS Error button and app should recover', async () => {
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.id('btn-throw-error')).tap();
      await expect(element(by.id('title'))).toBeVisible();
    });

    it('should tap Promise Reject button', async () => {
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.id('btn-reject-promise')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Error Boundary and show fallback', async () => {
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.id('btn-error-boundary')).tap();
      await expect(element(by.id('error-boundary-fallback'))).toBeVisible();
    });
  });

  describe('User Interactions', () => {
    it('should tap Tracked button', async () => {
      await element(by.id('scroll-view')).scrollTo('bottom');
      await element(by.id('btn-tracked')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Hook Action button', async () => {
      await element(by.id('btn-hook-action')).tap();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });
});
