/**
 * Unit tests for Sprint Collapser popup script
 * Tests filter saving, loading, and button state management using real exported functions.
 */

const BACKLOG_URL = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/1/backlog';
const NON_BACKLOG_URL = 'https://example.atlassian.net/jira/boards';

const POPUP_DOM = `
  <div class="popup-container">
    <button id="closeBtn" class="close-btn" title="Close">×</button>
    <h2>Sprint Collapser</h2>
    <button id="collapseBtn" class="action-button">Collapse All Sprints</button>
    <button id="expandBtn" class="action-button secondary">Expand All Sprints</button>
    <div class="divider"></div>
    <h3>Filter Sprints</h3>
    <div class="filter-input-wrapper">
      <input type="text" id="filterInput" class="filter-input" placeholder="Enter sprint name filter...">
      <button id="saveFilterBtn" class="save-filter-btn" title="Save filter"></button>
    </div>
    <div id="savedFilters" class="saved-filters"></div>
    <button id="filterBtn" class="action-button filter">Hide Non-Matching</button>
    <button id="showAllBtn" class="action-button secondary">Show All Sprints</button>
    <div id="status" class="status-message"></div>
  </div>
`;

function setupChromeMocks() {
  global.chrome = {
    tabs: {
      query: jest.fn((_, cb) => {
        const tabs = [{ id: 1, url: BACKLOG_URL }];
        if (cb) { cb(tabs); return; }
        return Promise.resolve(tabs);
      }),
      sendMessage: jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: false, anyFiltered: false });
        else if (msg.action === 'checkPageSupport')
          cb({ supported: true });
        else if (cb)
          cb({ success: true });
      }),
    },
    scripting: {
      executeScript: jest.fn((_, cb) => cb && cb()),
    },
    storage: {
      local: {
        get: jest.fn(() => Promise.resolve({ savedFilters: [], currentFilter: '', debugMode: false })),
        set: jest.fn(() => Promise.resolve()),
      },
    },
    runtime: { lastError: null },
  };
}

// -----------------------------------------------------------------------
describe('Sprint Collapser Popup Functions', () => {
  let popup;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    document.body.innerHTML = POPUP_DOM;
    setupChromeMocks();
    popup = require('../popup.js');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -----------------------------------------------------------------------
  describe('updateSaveButtonState', () => {
    test('[REGRESSION] save button hidden when filter input is empty', () => {
      document.getElementById('filterInput').value = '';
      popup.updateSaveButtonState();
      expect(document.getElementById('saveFilterBtn').style.display).toBe('none');
    });

    test('[REGRESSION] save button shows ☆ (unsaved state) when input has new text', () => {
      document.getElementById('filterInput').value = 'Team A';
      popup.updateSaveButtonState();
      const btn = document.getElementById('saveFilterBtn');
      expect(btn.style.display).toBe('block');
      expect(btn.textContent).toBe('☆');
      expect(btn.classList.contains('saved')).toBe(false);
    });

    test('[REGRESSION] save button shows ★ (saved state) when input matches a saved filter', async () => {
      await popup.saveFilter('Team A'); // adds 'Team A' to cachedSavedFilters
      document.getElementById('filterInput').value = 'Team A';
      popup.updateSaveButtonState();
      const btn = document.getElementById('saveFilterBtn');
      expect(btn.textContent).toBe('★');
      expect(btn.classList.contains('saved')).toBe(true);
    });

    test('[REGRESSION] save button has pulsing class when input has unsaved text', () => {
      document.getElementById('filterInput').value = 'Team A';
      popup.updateSaveButtonState();
      expect(document.getElementById('saveFilterBtn').classList.contains('pulsing')).toBe(true);
    });

    test('[REGRESSION] save button does not have pulsing class when input matches a saved filter', async () => {
      await popup.saveFilter('Team A');
      document.getElementById('filterInput').value = 'Team A';
      popup.updateSaveButtonState();
      expect(document.getElementById('saveFilterBtn').classList.contains('pulsing')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  describe('saveFilter', () => {
    test('saves a new filter and sorts the list alphabetically', async () => {
      await popup.saveFilter('Team B');
      await popup.saveFilter('Team A');
      const calls = global.chrome.storage.local.set.mock.calls;
      const lastSaved = calls[calls.length - 1][0].savedFilters;
      expect(lastSaved).toEqual(['Team A', 'Team B']);
    });

    test('removes a filter that is already saved (toggle-off behaviour)', async () => {
      await popup.saveFilter('Team A');
      await popup.saveFilter('Team A'); // toggle off
      const calls = global.chrome.storage.local.set.mock.calls;
      const lastSaved = calls[calls.length - 1][0].savedFilters;
      expect(lastSaved).toEqual([]);
    });

    test('rejects empty filter text without calling storage', async () => {
      await popup.saveFilter('');
      expect(global.chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('rejects whitespace-only filter text without calling storage', async () => {
      await popup.saveFilter('   ');
      expect(global.chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('rejects an 11th filter when MAX_SAVED_FILTERS (10) is reached', async () => {
      for (let i = 1; i <= 10; i++) {
        await popup.saveFilter(`Filter ${i}`);
      }
      const callsBefore = global.chrome.storage.local.set.mock.calls.length;
      await popup.saveFilter('Filter 11');
      expect(global.chrome.storage.local.set.mock.calls.length).toBe(callsBefore);
    });

    test('[REGRESSION] clears and re-enables filter input when the active saved filter is removed via save button', async () => {
      // Save 'Team A' and render chip as unselected
      await popup.saveFilter('Team A');
      popup.displaySavedFilters(['Team A']);

      // Click the chip to select it — synchronously sets cachedCurrentFilter before first await
      document.querySelector('.filter-chip').click();

      // Flush: storage.set → filterInput setup → getActiveTab → sendMessage
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // cachedCurrentFilter='Team A', filterInput.value='Team A', disabled=true
      // Now toggle it off via saveFilter (same path as clicking the ★ button)
      await popup.saveFilter('Team A');

      expect(document.getElementById('filterInput').value).toBe('');
      expect(document.getElementById('filterInput').disabled).toBe(false);
      const showAllCalls = global.chrome.tabs.sendMessage.mock.calls.filter(([, msg]) => msg.action === 'showAllSprints');
      expect(showAllCalls.length).toBe(1);
    });

    test('[REGRESSION] does not clear filter input when a non-active saved filter is removed via save button', async () => {
      // Save two filters; select 'Team B' via chip click
      await popup.saveFilter('Team A');
      await popup.saveFilter('Team B');
      popup.displaySavedFilters(['Team A', 'Team B']);

      const chips = document.querySelectorAll('.filter-chip');
      chips[1].click(); // click Team B chip
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // cachedCurrentFilter='Team B' — now remove Team A via saveFilter
      await popup.saveFilter('Team A');

      // Team B is still active — input should remain populated and disabled
      expect(document.getElementById('filterInput').value).toBe('Team B');
      expect(document.getElementById('filterInput').disabled).toBe(true);
      const showAllCalls = global.chrome.tabs.sendMessage.mock.calls.filter(([, msg]) => msg.action === 'showAllSprints');
      expect(showAllCalls.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  describe('removeSavedFilter', () => {
    test('removes the specified filter from the saved list', async () => {
      await popup.saveFilter('Team A');
      await popup.saveFilter('Team B');
      await popup.removeSavedFilter('Team A');
      const calls = global.chrome.storage.local.set.mock.calls;
      const lastSaved = calls[calls.length - 1][0].savedFilters;
      expect(lastSaved).toEqual(['Team B']);
    });

    test('does not write currentFilter to storage when removed filter is not the active filter', async () => {
      // cachedCurrentFilter starts as '' (no active filter), so removing 'Team A' should
      // only update savedFilters — not touch currentFilter in storage.
      await popup.saveFilter('Team A');
      await popup.removeSavedFilter('Team A');
      const lastCall = global.chrome.storage.local.set.mock.calls.at(-1)[0];
      expect(Object.keys(lastCall)).not.toContain('currentFilter');
      expect(lastCall.savedFilters).toEqual([]);
    });

    test('[REGRESSION] clears and re-enables filter input when the active filter is deleted', async () => {
      // Save 'Team A' and render its chip as unselected
      await popup.saveFilter('Team A');
      popup.displaySavedFilters(['Team A']);

      // Click the chip — the handler synchronously sets cachedCurrentFilter = 'Team A'
      // before its first await, so it is reliably set before removeSavedFilter runs.
      document.querySelector('.filter-chip').click();

      // Flush async continuations: storage.set → filterInput setup → getActiveTab → sendMessage
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // At this point cachedCurrentFilter='Team A', filterInput.value='Team A', disabled=true
      await popup.removeSavedFilter('Team A');

      expect(document.getElementById('filterInput').value).toBe('');
      expect(document.getElementById('filterInput').disabled).toBe(false);
      const showAllCalls = global.chrome.tabs.sendMessage.mock.calls.filter(([, msg]) => msg.action === 'showAllSprints');
      expect(showAllCalls.length).toBe(1);
    });

    test('[REGRESSION] does not clear filter input when a non-active saved filter is deleted', async () => {
      // Save two filters; select 'Team B' via chip click so cachedCurrentFilter='Team B'
      await popup.saveFilter('Team A');
      await popup.saveFilter('Team B');
      popup.displaySavedFilters(['Team A', 'Team B']);

      // Click the Team B chip (second chip) to make it the active filter
      const chips = document.querySelectorAll('.filter-chip');
      chips[1].click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // cachedCurrentFilter='Team B', filterInput.value='Team B', disabled=true
      await popup.removeSavedFilter('Team A');

      // Team B is still active — input should remain populated and disabled
      expect(document.getElementById('filterInput').value).toBe('Team B');
      expect(document.getElementById('filterInput').disabled).toBe(true);
      const showAllCalls = global.chrome.tabs.sendMessage.mock.calls.filter(([, msg]) => msg.action === 'showAllSprints');
      expect(showAllCalls.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  describe('displaySavedFilters', () => {
    test('renders nothing when the filter list is empty', () => {
      popup.displaySavedFilters([]);
      expect(document.getElementById('savedFilters').children.length).toBe(0);
    });

    test('renders a label and one chip per saved filter', () => {
      popup.displaySavedFilters(['Team A', 'Team B']);
      const container = document.getElementById('savedFilters');
      expect(container.children.length).toBe(3); // 1 label + 2 chips
      expect(container.textContent).toContain('Team A');
      expect(container.textContent).toContain('Team B');
    });

    test('marks the currently active filter chip with the "selected" class', () => {
      popup.displaySavedFilters(['Team A', 'Team B'], 'Team A');
      const chips = document.getElementById('savedFilters').querySelectorAll('.filter-chip');
      expect(chips[0].classList.contains('selected')).toBe(true);
      expect(chips[1].classList.contains('selected')).toBe(false);
    });

    test('selected chip label has ✓ prefix; unselected chip label does not', () => {
      popup.displaySavedFilters(['Team A', 'Team B'], 'Team A');
      const chips = document.getElementById('savedFilters').querySelectorAll('.filter-chip');
      expect(chips[0].querySelector('span').textContent).toBe('✓ Team A');
      expect(chips[1].querySelector('span').textContent).toBe('Team B');
    });

    test('selected chip title is "Click to deselect"; unselected chip title is "Click to apply filter"', () => {
      popup.displaySavedFilters(['Team A', 'Team B'], 'Team A');
      const chips = document.getElementById('savedFilters').querySelectorAll('.filter-chip');
      expect(chips[0].title).toBe('Click to deselect');
      expect(chips[1].title).toBe('Click to apply filter');
    });

    test('all chips have "Click to apply filter" title when no filter is active', () => {
      popup.displaySavedFilters(['Team A', 'Team B']);
      const chips = document.getElementById('savedFilters').querySelectorAll('.filter-chip');
      chips.forEach(chip => expect(chip.title).toBe('Click to apply filter'));
    });
  });

  // -----------------------------------------------------------------------
  describe('disableAllControls', () => {
    test('[REGRESSION] disables all interactive controls when called with true', () => {
      popup.disableAllControls(true);
      expect(document.getElementById('collapseBtn').disabled).toBe(true);
      expect(document.getElementById('expandBtn').disabled).toBe(true);
      expect(document.getElementById('filterBtn').disabled).toBe(true);
      expect(document.getElementById('showAllBtn').disabled).toBe(true);
      expect(document.getElementById('filterInput').disabled).toBe(true);
      expect(document.getElementById('saveFilterBtn').disabled).toBe(true);
    });

    test('[REGRESSION] re-enables all interactive controls when called with false', () => {
      popup.disableAllControls(true);
      popup.disableAllControls(false);
      expect(document.getElementById('collapseBtn').disabled).toBe(false);
      expect(document.getElementById('expandBtn').disabled).toBe(false);
      expect(document.getElementById('filterBtn').disabled).toBe(false);
      expect(document.getElementById('showAllBtn').disabled).toBe(false);
      expect(document.getElementById('filterInput').disabled).toBe(false);
      expect(document.getElementById('saveFilterBtn').disabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  describe('disableFilterChips', () => {
    test('[REGRESSION] adds "disabled" class to savedFilters container', () => {
      popup.disableFilterChips(true);
      expect(document.getElementById('savedFilters').classList.contains('disabled')).toBe(true);
    });

    test('[REGRESSION] removes "disabled" class from savedFilters container', () => {
      popup.disableFilterChips(true);
      popup.disableFilterChips(false);
      expect(document.getElementById('savedFilters').classList.contains('disabled')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  describe('updateCollapseExpandButtonText', () => {
    test('[REGRESSION] shows "Visible Sprints" text when a filter is applied', () => {
      popup.updateCollapseExpandButtonText(true);
      expect(document.getElementById('collapseBtn').textContent).toBe('Collapse Visible Sprints');
      expect(document.getElementById('expandBtn').textContent).toBe('Expand Visible Sprints');
    });

    test('[REGRESSION] restores "All Sprints" text when filter is removed', () => {
      popup.updateCollapseExpandButtonText(true);
      popup.updateCollapseExpandButtonText(false);
      expect(document.getElementById('collapseBtn').textContent).toBe('Collapse All Sprints');
      expect(document.getElementById('expandBtn').textContent).toBe('Expand All Sprints');
    });
  });

  // -----------------------------------------------------------------------
  describe('updateActionButtonStates', () => {
    test('[REGRESSION] collapseBtn disabled when allCollapsed is true', (done) => {
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: true, allExpanded: false, anyFiltered: false });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('collapseBtn').disabled).toBe(true);
        expect(document.getElementById('expandBtn').disabled).toBe(false);
        done();
      });
    });

    test('[REGRESSION] expandBtn disabled when allExpanded is true', (done) => {
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: true, anyFiltered: false });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('expandBtn').disabled).toBe(true);
        expect(document.getElementById('collapseBtn').disabled).toBe(false);
        done();
      });
    });

    test('[REGRESSION] showAllBtn disabled when no sprints are currently filtered', (done) => {
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: false, anyFiltered: false });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('showAllBtn').disabled).toBe(true);
        done();
      });
    });

    test('[REGRESSION] showAllBtn enabled when sprints are currently filtered', (done) => {
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: false, anyFiltered: true });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('showAllBtn').disabled).toBe(false);
        done();
      });
    });

    test('[REGRESSION] filterBtn disabled when filter input is empty', (done) => {
      // filterInput starts empty — hasFilterText is false regardless of filter state
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: false, anyFiltered: false });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('filterBtn').disabled).toBe(true);
        done();
      });
    });

    test('[REGRESSION] filterBtn enabled when filter text is present and no filter is applied', (done) => {
      document.getElementById('filterInput').value = 'Team A';
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: false, anyFiltered: false });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('filterBtn').disabled).toBe(false);
        done();
      });
    });

    test('[REGRESSION] filterBtn enabled when filter text differs from the currently applied filter', (done) => {
      // cachedCurrentFilter starts as '' — any non-empty input is a different filter
      document.getElementById('filterInput').value = 'Team B';
      global.chrome.tabs.sendMessage = jest.fn((_tabId, msg, cb) => {
        if (msg.action === 'getSprintState')
          cb({ allCollapsed: false, allExpanded: false, anyFiltered: true });
      });
      popup.updateActionButtonStates(1, () => {
        expect(document.getElementById('filterBtn').disabled).toBe(false);
        done();
      });
    });
  });

  // -----------------------------------------------------------------------
  describe('setButtonLoading', () => {
    test('replaces button content with a spinner element and loading text', () => {
      const btn = document.getElementById('collapseBtn');
      popup.setButtonLoading(btn, 'Collapsing...');
      expect(btn.querySelector('.spinner')).not.toBeNull();
      expect(btn.textContent).toContain('Collapsing...');
    });

    test('[REGRESSION] calling setButtonLoading again replaces previous state without duplicating spinners', () => {
      const btn = document.getElementById('collapseBtn');
      popup.setButtonLoading(btn, 'Collapsing...');
      popup.setButtonLoading(btn, 'Almost done...');
      expect(btn.querySelectorAll('.spinner')).toHaveLength(1);
      expect(btn.textContent).toContain('Almost done...');
    });
  });

  // -----------------------------------------------------------------------
  describe('toggleDebugMode', () => {
    test('[REGRESSION] turns title red and updates tooltip when debug mode is enabled', async () => {
      await popup.toggleDebugMode(); // starts false → true
      const title = document.querySelector('h2');
      expect(['#ff6b6b', 'rgb(255, 107, 107)']).toContain(title.style.color);
      expect(title.title).toContain('Debug mode enabled');
    });

    test('[REGRESSION] clears title color and resets tooltip when debug mode is disabled', async () => {
      await popup.toggleDebugMode(); // → true
      await popup.toggleDebugMode(); // → false
      const title = document.querySelector('h2');
      expect(title.style.color).toBe('');
      expect(title.title).toContain('Triple-click to enable');
    });
  });

});

// -----------------------------------------------------------------------
// URL Support Checking uses the pure isUrlSupported export — no chrome mocks needed.
// Requiring here (at describe-evaluation time) is safe: popup.js only exports without
// calling init() when typeof module !== 'undefined'.
describe('URL Support Checking', () => {
  const { isUrlSupported } = require('../popup.js');

  test('[REGRESSION] should recognize valid Jira backlog URL pattern 1 (c/projects)', () => {
    expect(isUrlSupported('https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog')).toBe(true);
  });

  test('[REGRESSION] should recognize valid Jira backlog URL pattern 2 (projects with segment)', () => {
    expect(isUrlSupported('https://example.atlassian.net/jira/software/v1/projects/PROJ/boards/123/backlog')).toBe(true);
  });

  test('[REGRESSION] should recognize valid Jira backlog URL pattern 3 (simple with segment)', () => {
    expect(isUrlSupported('https://example.atlassian.net/jira/software/v1/backlog')).toBe(true);
  });

  test('[REGRESSION] should reject non-Jira URLs', () => {
    expect(isUrlSupported('https://example.com')).toBe(false);
  });

  test('[REGRESSION] should reject Jira URLs that are not backlog pages', () => {
    expect(isUrlSupported('https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123')).toBe(false);
  });

  test('[REGRESSION] should reject empty, null, and undefined URLs', () => {
    expect(isUrlSupported('')).toBe(false);
    expect(isUrlSupported(null)).toBe(false);
    expect(isUrlSupported(undefined)).toBe(false);
  });

  test('[REGRESSION] should accept URLs with query parameters after /backlog', () => {
    expect(isUrlSupported('https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog?selectedIssue=PROJ-123')).toBe(true);
  });

  test('[REGRESSION] should handle different organisation subdomains', () => {
    expect(isUrlSupported('https://mycompany.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog')).toBe(true);
    expect(isUrlSupported('https://another-org.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog')).toBe(true);
  });

  test('[REGRESSION] should reject team-managed project URLs (format not currently supported)', () => {
    // Team-managed boards use /jira/software/projects/ with no segment prefix — none of the
    // three supported patterns match this shape. Documents current intentional behaviour.
    expect(isUrlSupported('https://example.atlassian.net/jira/software/projects/PROJ/boards/123/backlog')).toBe(false);
  });
});

// -----------------------------------------------------------------------
describe('checkSupportedPage', () => {
  let checkSupportedPage;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();

    document.body.innerHTML = POPUP_DOM;

    global.chrome = {
      tabs: {
        query: jest.fn((_, cb) => {
          const tabs = [{ id: 1, url: BACKLOG_URL }];
          if (cb) { cb(tabs); return; }
          return Promise.resolve(tabs);
        }),
        sendMessage: jest.fn((_tabId, msg, cb) => {
          if (msg.action === 'checkPageSupport') cb({ supported: true });
          else if (msg.action === 'getSprintState') cb({ allCollapsed: false, allExpanded: false, anyFiltered: false });
        }),
      },
      scripting: {
        executeScript: jest.fn((_, cb) => cb && cb()),
      },
      storage: {
        local: {
          get: jest.fn(() => Promise.resolve({ savedFilters: [], currentFilter: '', debugMode: false })),
          set: jest.fn(() => Promise.resolve()),
        },
      },
      runtime: { lastError: null },
    };

    ({ checkSupportedPage } = require('../popup.js'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('[REGRESSION] should recover when tab URL is stale on first check due to SPA navigation', () => {
    let callCount = 0;
    global.chrome.tabs.query = jest.fn((_, cb) => {
      callCount++;
      const tabs = [{ id: 1, url: callCount === 1 ? NON_BACKLOG_URL : BACKLOG_URL }];
      if (cb) { cb(tabs); return; }
      return Promise.resolve(tabs);
    });

    checkSupportedPage(3, 100);
    jest.runAllTimers();

    // Recovered successfully — no error message should appear
    expect(document.getElementById('status').textContent).toBe('');
  });

  test('[REGRESSION] should show URL error after all retries if URL never becomes valid', () => {
    global.chrome.tabs.query = jest.fn((_, cb) => {
      const tabs = [{ id: 1, url: NON_BACKLOG_URL }];
      if (cb) { cb(tabs); return; }
      return Promise.resolve(tabs);
    });

    checkSupportedPage(2, 100);
    jest.runAllTimers();

    expect(document.getElementById('status').textContent).toContain('only works on Jira Cloud board backlog pages');
  });

  test('[REGRESSION] should show content script error if URL is valid but script never responds', () => {
    global.chrome.tabs.sendMessage = jest.fn((_tabId, _msg, cb) => cb(undefined));

    checkSupportedPage(2, 100);
    jest.runAllTimers();

    expect(document.getElementById('status').textContent).toContain('Content script not loaded');
  });

  test('[REGRESSION] should recover silently via scripting injection when content script is absent (SPA navigation)', () => {
    // Simulate SPA navigation: content script never responds until after injection
    let injected = false;
    global.chrome.scripting.executeScript = jest.fn((_, cb) => {
      injected = true;
      if (cb) cb(); // injection succeeds, no lastError
    });
    global.chrome.tabs.sendMessage = jest.fn((_tabId, _msg, cb) => {
      // Responds only after injection (i.e., after executeScript has run)
      cb(injected ? { supported: true } : undefined);
    });

    checkSupportedPage(2, 100);
    jest.runAllTimers();

    // Recovered via injection — no error shown (status is cleared synchronously before async init)
    expect(document.getElementById('status').textContent).toBe('');
    // Verify executeScript was invoked with the content script file
    expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ files: ['content.js'] }),
      expect.any(Function)
    );
  });

  test('[REGRESSION] should show content script error when scripting injection itself fails', () => {
    // Simulate injection being denied (e.g., extension lacks host permissions for the tab)
    global.chrome.tabs.sendMessage = jest.fn((_tabId, _msg, cb) => cb(undefined));
    global.chrome.scripting.executeScript = jest.fn((_, cb) => {
      global.chrome.runtime.lastError = { message: 'Cannot access tab' };
      if (cb) cb();
      global.chrome.runtime.lastError = null;
    });

    checkSupportedPage(2, 100);
    jest.runAllTimers();

    expect(document.getElementById('status').textContent).toContain('Content script not loaded');
  });

  test('[REGRESSION] should show no error when content script responds on first attempt', () => {
    checkSupportedPage(3, 100);
    // No timer advancement — first attempt succeeds synchronously

    expect(document.getElementById('status').textContent).toBe('');
  });

  test('[REGRESSION] should show no error and leave controls disabled when no active tab is found', () => {
    global.chrome.tabs.query = jest.fn((_, cb) => {
      if (cb) cb([]); // empty — no active tab
    });

    checkSupportedPage(1, 100);
    jest.runAllTimers();

    // Silent no-op: no error status, controls remain disabled (set at the start of checkSupportedPage)
    expect(document.getElementById('status').textContent).toBe('');
    expect(document.getElementById('collapseBtn').disabled).toBe(true);
  });
});
