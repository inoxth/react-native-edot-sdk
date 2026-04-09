const { device, element, by, expect } = require('detox');

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

  it('should tap Test Fetch and see log update', async () => {
    await element(by.id('btn-test-fetch')).tap();
    await expect(element(by.id('log-section'))).toBeVisible();
  });
});
