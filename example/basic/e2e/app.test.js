const { device, element, by, expect, waitFor } = require('detox');

// scrollTo('top'/'bottom') calls Espresso's scrollToEdge ViewAction, which
// blocks on the mqt_js LooperIdlingResource (any pending timer keeps it
// non-idle, deadlocking the test). Use scroll() instead — it uses touch
// injection and bypasses Espresso's idling-resource synchronization.

async function scrollToTop() {
  for (let i = 0; i < 3; i++) {
    await element(by.id('scroll-view')).scroll(3000, 'up');
  }
}

async function scrollToBottom() {
  for (let i = 0; i < 3; i++) {
    await element(by.id('scroll-view')).scroll(3000, 'down');
  }
}

async function scrollToButton(buttonId) {
  await scrollToTop();
  for (let i = 0; i < 20; i++) {
    try {
      await expect(element(by.id(buttonId))).toBeVisible();
      return;
    } catch {
      await element(by.id('scroll-view')).scroll(150, 'down');
    }
  }
}

describe('EDOT Example App', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Disable Detox's JS-thread idle synchronization — the EDOT SDK's background
    // timers keep the thread perpetually non-idle, which would otherwise hang.
    await device.disableSynchronization();
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
      await scrollToButton('btn-set-user');
      await element(by.id('btn-set-user')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Clear User button', async () => {
      await scrollToButton('btn-clear-user');
      await element(by.id('btn-clear-user')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Set Session Attr button', async () => {
      await scrollToButton('btn-set-session-attr');
      await element(by.id('btn-set-session-attr')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Set Global Attr button', async () => {
      await scrollToButton('btn-set-global-attr');
      await element(by.id('btn-set-global-attr')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Remove Global Attr button', async () => {
      await scrollToButton('btn-remove-global-attr');
      await element(by.id('btn-remove-global-attr')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Manual Tracing', () => {
    it('should tap Create Span button', async () => {
      await scrollToButton('btn-create-span');
      await element(by.id('btn-create-span')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Nested Spans button', async () => {
      await scrollToButton('btn-nested-spans');
      await element(by.id('btn-nested-spans')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Metrics', () => {
    it('should tap Counter button', async () => {
      await scrollToButton('btn-counter');
      await element(by.id('btn-counter')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Histogram button', async () => {
      await scrollToButton('btn-histogram');
      await element(by.id('btn-histogram')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap UpDownCounter button', async () => {
      await scrollToButton('btn-updown-counter');
      await element(by.id('btn-updown-counter')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Structured Logs', () => {
    it('should tap Log Info button', async () => {
      await scrollToButton('btn-log-info');
      await element(by.id('btn-log-info')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Log Warn button', async () => {
      await scrollToButton('btn-log-warn');
      await element(by.id('btn-log-warn')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Log Error button', async () => {
      await scrollToButton('btn-log-error');
      await element(by.id('btn-log-error')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Network Requests', () => {
    it('should tap Fetch Data and wait for response', async () => {
      await scrollToButton('btn-fetch-success');
      await element(by.id('btn-fetch-success')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Fetch Error button', async () => {
      await scrollToButton('btn-fetch-error');
      await element(by.id('btn-fetch-error')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Fetch Multiple button', async () => {
      await scrollToButton('btn-fetch-multiple');
      await element(by.id('btn-fetch-multiple')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap XHR Request button', async () => {
      await scrollToButton('btn-xhr-request');
      await element(by.id('btn-xhr-request')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });

  describe('Error Tracing', () => {
    it('should tap JS Error button and reload after crash', async () => {
      await scrollToBottom();
      try {
        await element(by.id('btn-throw-error')).tap();
        // Give the setTimeout a moment to fire before Detox detects the crash
        await new Promise(r => setTimeout(r, 500));
      } catch {
        // In Release mode, uncaught JS errors thrown in setTimeout are fatal
      }
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
      await waitFor(element(by.id('title'))).toBeVisible().withTimeout(10000);
    });

    it('should tap Promise Reject button', async () => {
      await scrollToBottom();
      await element(by.id('btn-reject-promise')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Error Boundary and show fallback', async () => {
      await scrollToBottom();
      await element(by.id('btn-error-boundary')).tap();
      // React processes setShouldCrash(true) asynchronously; waitFor polls
      // until the error boundary fallback is committed to the view hierarchy.
      await waitFor(element(by.id('error-boundary-fallback'))).toBeVisible().withTimeout(5000);
    });

    afterAll(async () => {
      // React Native's LogBox shows an error overlay for render errors even when
      // caught by an error boundary. Relaunch to clear the overlay so subsequent
      // tests can find scroll-view.
      await device.launchApp({ newInstance: true });
      await device.disableSynchronization();
      await waitFor(element(by.id('title'))).toBeVisible().withTimeout(10000);
    });
  });

  describe('User Interactions', () => {
    it('should tap Tracked button', async () => {
      await scrollToButton('btn-tracked');
      await element(by.id('btn-tracked')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });

    it('should tap Hook Action button', async () => {
      await scrollToButton('btn-hook-action');
      await element(by.id('btn-hook-action')).tap();
      await scrollToBottom();
      await expect(element(by.id('log-section'))).toBeVisible();
    });
  });
});
