/**
 * Regression tests for Sprint Collapser background service worker.
 * Tests icon management and content script injection logic.
 *
 * background.js registers listeners at module-load time; each test captures
 * those listeners from the mock and invokes them directly.
 */

const BACKLOG_URL   = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1/backlog';
const BACKLOG_QUERY = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1/backlog?sprints=14400';
const BOARD_URL     = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1';

// Minimal OffscreenCanvas stand-in — setGreyIcon / setFilterIcon use it to
// composite image pixels; we only care that it doesn't throw.
class FakeOffscreenCanvas {
  constructor(w, h) {
    const len = w * h * 4;
    this._ctx = {
      drawImage:    jest.fn(),
      beginPath:    jest.fn(),
      arc:          jest.fn(),
      fill:         jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(len) })),
      fillStyle: '',
    };
  }
  getContext() { return this._ctx; }
}

function setupChromeMocks() {
  global.OffscreenCanvas    = FakeOffscreenCanvas;
  global.fetch              = jest.fn(() =>
    Promise.resolve({ blob: () => Promise.resolve(new Blob()) })
  );
  global.createImageBitmap  = jest.fn(() => Promise.resolve({ width: 16, height: 16 }));

  global.chrome = {
    tabs: {
      onUpdated:  { addListener: jest.fn() },
      onActivated:{ addListener: jest.fn() },
      get:        jest.fn(),
    },
    scripting: { executeScript: jest.fn() },
    action: {
      setIcon:  jest.fn(),
      setPopup: jest.fn(),
      setTitle: jest.fn(),
    },
    runtime: {
      onMessage: { addListener: jest.fn() },
      getURL:    jest.fn(p => `chrome-extension://testid/${p}`),
      lastError: null,
    },
  };
}

// ---------------------------------------------------------------------------

describe('Background Service Worker', () => {
  let onUpdated, onActivated, onMessage;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    setupChromeMocks();
    require('../background.js');
    onUpdated  = global.chrome.tabs.onUpdated.addListener.mock.calls[0][0];
    onActivated= global.chrome.tabs.onActivated.addListener.mock.calls[0][0];
    onMessage  = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
  });

  // -------------------------------------------------------------------------
  // isBacklogUrl — tested through clearFilterIcon's synchronous side-effects
  // when status='loading' and changeInfo.url is a known URL.
  // -------------------------------------------------------------------------
  describe('isBacklogUrl URL pattern matching', () => {
    function expectBacklog(url) {
      onUpdated(1, { url, status: 'loading' }, {});
      expect(global.chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'popup.html', tabId: 1 });
    }

    test('[REGRESSION] pattern 1 — /c/projects/*/boards/*/backlog', () => {
      expectBacklog('https://org.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog');
    });

    test('[REGRESSION] pattern 2 — /segment/projects/*/boards/*/backlog', () => {
      expectBacklog('https://org.atlassian.net/jira/software/v1/projects/PROJ/boards/123/backlog');
    });

    test('[REGRESSION] pattern 3 — /segment/backlog', () => {
      expectBacklog('https://org.atlassian.net/jira/software/v1/backlog');
    });

    test('[REGRESSION] accepts backlog URL with query parameters', () => {
      expectBacklog(BACKLOG_QUERY);
    });

    test('[REGRESSION] board URL (no /backlog) is not recognised as a backlog page', () => {
      // BOARD_URL + status=loading hits setGreyIcon (async), not clearFilterIcon.
      // clearFilterIcon calls setPopup('popup.html') — verify that did NOT happen.
      onUpdated(1, { url: BOARD_URL, status: 'loading' }, { url: BOARD_URL });
      expect(global.chrome.action.setPopup).not.toHaveBeenCalledWith(
        expect.objectContaining({ popup: 'popup.html' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Full-page load to a backlog URL — icon must turn blue immediately
  // -------------------------------------------------------------------------
  describe('tabs.onUpdated — full page load to backlog URL', () => {
    test('[REGRESSION] blue icon set immediately when backlog URL starts loading (changeInfo.url present)', () => {
      onUpdated(1, { url: BACKLOG_URL, status: 'loading' }, { url: BACKLOG_URL });
      expect(global.chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'popup.html', tabId: 1 });
      expect(global.chrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.any(Object), tabId: 1 })
      );
    });

    test('[REGRESSION] blue icon set when tab.url resolves to backlog on status=loading (no changeInfo.url)', () => {
      // Chrome omits changeInfo.url for repeat status events; tab.url is used instead.
      onUpdated(1, { status: 'loading' }, { url: BACKLOG_URL });
      expect(global.chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'popup.html', tabId: 1 });
    });

    test('[REGRESSION] content.js is NOT injected on status=loading (manifest handles injection)', () => {
      onUpdated(1, { url: BACKLOG_URL, status: 'loading' }, { url: BACKLOG_URL });
      expect(global.chrome.scripting.executeScript).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // status=complete injection — the fix for auto-applying filters after Jira's
  // rapid redirect chain prevents manifest content_scripts from firing reliably.
  // -------------------------------------------------------------------------
  describe('[REGRESSION] tabs.onUpdated — status=complete injection (Jira redirect-chain fix)', () => {
    test('injects content.js when status=complete and tab.url is a backlog URL', () => {
      onUpdated(1, { status: 'complete' }, { url: BACKLOG_URL });
      expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({ target: { tabId: 1 }, files: ['content.js'] }),
        expect.any(Function)
      );
    });

    test('injects content.js when tab.url has query parameters after /backlog', () => {
      onUpdated(1, { status: 'complete' }, { url: BACKLOG_QUERY });
      expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({ target: { tabId: 1 }, files: ['content.js'] }),
        expect.any(Function)
      );
    });

    test('does NOT inject when status=complete but tab.url is a board (non-backlog) URL', () => {
      onUpdated(1, { status: 'complete' }, { url: BOARD_URL });
      expect(global.chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    test('does NOT inject when status=complete and tab.url is undefined (non-atlassian tab)', () => {
      onUpdated(1, { status: 'complete' }, {});
      expect(global.chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    test('injects exactly once after a full Jira redirect chain (multiple status=loading, then complete)', () => {
      // Mirrors the real-world Chrome log observed during debugging:
      //   /boards/500 (loading) → /boards/500?sprints=… (loading) →
      //   /backlog (loading) → /backlog?sprints=… (loading) → /backlog (complete)
      // ALL events have status set — the SPA injection path never fires.
      const tabId = 99;
      onUpdated(tabId, { url: BOARD_URL,    status: 'loading' }, { url: BOARD_URL });
      onUpdated(tabId, {                    status: 'loading' }, { url: BOARD_URL });
      onUpdated(tabId, { url: BACKLOG_URL,  status: 'loading' }, { url: BACKLOG_URL });
      onUpdated(tabId, { url: BACKLOG_QUERY,status: 'loading' }, { url: BACKLOG_QUERY });
      onUpdated(tabId, {                    status: 'loading' }, { url: BACKLOG_URL });
      // Page fully settled:
      onUpdated(tabId, {                    status: 'complete'}, { url: BACKLOG_URL });

      expect(global.chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
      expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({ target: { tabId }, files: ['content.js'] }),
        expect.any(Function)
      );
    });
  });

  // -------------------------------------------------------------------------
  // SPA navigation (Jira pushState — changeInfo.url present, no changeInfo.status)
  // -------------------------------------------------------------------------
  describe('tabs.onUpdated — SPA navigation', () => {
    test('[REGRESSION] blue icon set on SPA navigation to backlog URL', () => {
      onUpdated(1, { url: BACKLOG_URL }, {});
      expect(global.chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'popup.html', tabId: 1 });
      expect(global.chrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.any(Object), tabId: 1 })
      );
    });

    test('[REGRESSION] content.js injected on SPA navigation to backlog URL', () => {
      onUpdated(1, { url: BACKLOG_URL }, {});
      expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({ target: { tabId: 1 }, files: ['content.js'] }),
        expect.any(Function)
      );
    });

    test('[REGRESSION] setGreyIcon skipped on SPA navigation to intermediate non-backlog URL', () => {
      // Jira emits intermediate board URLs before settling on /backlog during SPA nav.
      // Graying here would cause a visible icon flash.
      onUpdated(1, { url: BOARD_URL }, {});
      // setGreyIcon calls fetch() synchronously before its first await, so a non-call
      // confirms the early-return guard fired rather than setGreyIcon just being pending.
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // runtime.onMessage routing
  // -------------------------------------------------------------------------
  describe('runtime.onMessage routing', () => {
    test('[REGRESSION] clearFilterIcon from content script (sender.tab.id) sets blue icon', () => {
      onMessage({ action: 'clearFilterIcon' }, { tab: { id: 5 } });
      expect(global.chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'popup.html', tabId: 5 });
      expect(global.chrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.any(Object), tabId: 5 })
      );
    });

    test('[REGRESSION] clearFilterIcon from popup (explicit message.tabId) sets blue icon', () => {
      onMessage({ action: 'clearFilterIcon', tabId: 7 }, {});
      expect(global.chrome.action.setPopup).toHaveBeenCalledWith({ popup: 'popup.html', tabId: 7 });
    });

    test('[REGRESSION] message.tabId takes precedence over sender.tab.id', () => {
      onMessage({ action: 'clearFilterIcon', tabId: 7 }, { tab: { id: 5 } });
      expect(global.chrome.action.setIcon).toHaveBeenCalledWith(
        expect.objectContaining({ tabId: 7 })
      );
    });

    test('[REGRESSION] ignores message when neither message.tabId nor sender.tab.id is present', () => {
      onMessage({ action: 'clearFilterIcon' }, {});
      expect(global.chrome.action.setIcon).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // tabs.onActivated — switching tabs
  // -------------------------------------------------------------------------
  describe('tabs.onActivated', () => {
    test('[REGRESSION] skips setGreyIcon for a tab already marked active by clearFilterIcon', () => {
      // Mark tab 3 as active via a clearFilterIcon message
      onMessage({ action: 'clearFilterIcon', tabId: 3 }, {});
      jest.clearAllMocks(); // reset call counts; tab 3 remains in _activeTabIds

      global.chrome.tabs.get = jest.fn((_id, cb) => cb({ url: undefined }));
      onActivated({ tabId: 3 });

      // setGreyIcon calls fetch() synchronously before its first await, so a non-call
      // confirms the _activeTabIds guard fired rather than setGreyIcon just being pending.
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
