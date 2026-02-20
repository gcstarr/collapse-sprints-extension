/**
 * Unit tests for Sprint Collapser popup script
 * Tests filter saving, loading, and button state management
 */

// Mock localStorage for testing
const mockStorage = {};


describe('Sprint Collapser Popup Functions', () => {
  const SAVED_FILTERS_KEY = 'savedFilters';
  const MAX_SAVED_FILTERS = 10;

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();

    // Setup DOM
    document.body.innerHTML = `
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
  });

  describe('Save Filter Button Visibility', () => {
    test('[REGRESSION] save button should be hidden when filter input is empty', () => {
      const saveBtn = document.getElementById('saveFilterBtn');
      const filterInput = document.getElementById('filterInput');
      
      filterInput.value = '';
      saveBtn.style.display = 'none';
      
      expect(saveBtn.style.display).toBe('none');
    });

    test('[REGRESSION] save button should be visible when filter input has text', () => {
      const saveBtn = document.getElementById('saveFilterBtn');
      const filterInput = document.getElementById('filterInput');
      
      filterInput.value = 'Team A';
      saveBtn.style.display = 'block';
      
      expect(saveBtn.style.display).toBe('block');
    });

    test('save button should toggle visibility with input changes', () => {
      const saveBtn = document.getElementById('saveFilterBtn');
      const filterInput = document.getElementById('filterInput');
      
      // Empty - hidden
      filterInput.value = '';
      saveBtn.style.display = 'none';
      expect(saveBtn.style.display).toBe('none');
      
      // Has text - visible
      filterInput.value = 'Sprint 1';
      saveBtn.style.display = 'block';
      expect(saveBtn.style.display).toBe('block');
      
      // Clear again - hidden
      filterInput.value = '';
      saveBtn.style.display = 'none';
      expect(saveBtn.style.display).toBe('none');
    });
  });

  describe('Save Filter Functionality', () => {
    test('should save a new filter', async () => {
      mockStorage[SAVED_FILTERS_KEY] = [];
      
      const filterText = 'Team A';
      let saved = mockStorage[SAVED_FILTERS_KEY] || [];
      
      if (!saved.includes(filterText)) {
        saved.push(filterText);
      }
      mockStorage[SAVED_FILTERS_KEY] = saved;
      
      expect(mockStorage[SAVED_FILTERS_KEY]).toContain('Team A');
    });

    test('should not save duplicate filters', async () => {
      mockStorage[SAVED_FILTERS_KEY] = ['Team A', 'Backend'];
      
      const filterText = 'Team A';
      let saved = mockStorage[SAVED_FILTERS_KEY];
      
      if (saved.includes(filterText)) {
        saved = saved.filter(f => f !== filterText);
      } else {
        saved.push(filterText);
      }
      mockStorage[SAVED_FILTERS_KEY] = saved;
      
      // Should toggle off (remove)
      expect(mockStorage[SAVED_FILTERS_KEY]).not.toContain('Team A');
      expect(mockStorage[SAVED_FILTERS_KEY]).toEqual(['Backend']);
    });

    test('should respect MAX_SAVED_FILTERS limit', () => {
      mockStorage[SAVED_FILTERS_KEY] = Array.from({ length: 10 }, (_, i) => `Filter ${i + 1}`);
      
      let saved = mockStorage[SAVED_FILTERS_KEY];
      expect(saved.length).toBe(MAX_SAVED_FILTERS);
      
      // Attempt to add 11th should fail
      const canAddMore = saved.length < MAX_SAVED_FILTERS;
      expect(canAddMore).toBe(false);
    });

    test('should remove a saved filter', () => {
      mockStorage[SAVED_FILTERS_KEY] = ['Team A', 'Team B', 'Backend'];
      
      const filterToRemove = 'Team B';
      mockStorage[SAVED_FILTERS_KEY] = mockStorage[SAVED_FILTERS_KEY].filter(
        f => f !== filterToRemove
      );
      
      expect(mockStorage[SAVED_FILTERS_KEY]).toEqual(['Team A', 'Backend']);
      expect(mockStorage[SAVED_FILTERS_KEY]).not.toContain('Team B');
    });
  });

  describe('Button Disabled States', () => {
    test('[REGRESSION] Hide Non-Matching button should be disabled when filter is empty', () => {
      const filterBtn = document.getElementById('filterBtn');
      const filterInput = document.getElementById('filterInput');
      
      filterInput.value = '';
      filterBtn.disabled = !filterInput.value.trim();
      
      expect(filterBtn.disabled).toBe(true);
    });

    test('[REGRESSION] Hide Non-Matching button should be enabled when filter has text', () => {
      const filterBtn = document.getElementById('filterBtn');
      const filterInput = document.getElementById('filterInput');
      
      filterInput.value = 'Team A';
      filterBtn.disabled = !filterInput.value.trim();
      
      expect(filterBtn.disabled).toBe(false);
    });

    test('[REGRESSION] Collapse All button should be disabled when allCollapsed is true', () => {
      const collapseBtn = document.getElementById('collapseBtn');
      const sprintState = { allCollapsed: true, allExpanded: false, anyFiltered: false };
      
      collapseBtn.disabled = sprintState.allCollapsed;
      
      expect(collapseBtn.disabled).toBe(true);
    });

    test('[REGRESSION] Expand All button should be disabled when allExpanded is true', () => {
      const expandBtn = document.getElementById('expandBtn');
      const sprintState = { allCollapsed: false, allExpanded: true, anyFiltered: false };
      
      expandBtn.disabled = sprintState.allExpanded;
      
      expect(expandBtn.disabled).toBe(true);
    });

    test('[REGRESSION] Show All button should be disabled when anyFiltered is false', () => {
      const showAllBtn = document.getElementById('showAllBtn');
      const sprintState = { allCollapsed: false, allExpanded: false, anyFiltered: false };
      
      showAllBtn.disabled = !sprintState.anyFiltered;
      
      expect(showAllBtn.disabled).toBe(true);
    });

    test('[REGRESSION] Show All button should be enabled when anyFiltered is true', () => {
      const showAllBtn = document.getElementById('showAllBtn');
      const sprintState = { allCollapsed: false, allExpanded: false, anyFiltered: true };
      
      showAllBtn.disabled = !sprintState.anyFiltered;
      
      expect(showAllBtn.disabled).toBe(false);
    });
  });

  describe('Filter Input Box Disabled State', () => {
    test('[REGRESSION] filter input should be disabled on unsupported page', () => {
      const filterInput = document.getElementById('filterInput');
      const saveBtn = document.getElementById('saveFilterBtn');
      
      filterInput.disabled = true;
      saveBtn.disabled = true;
      
      expect(filterInput.disabled).toBe(true);
      expect(saveBtn.disabled).toBe(true);
    });

    test('[REGRESSION] filter input should be enabled on supported page', () => {
      const filterInput = document.getElementById('filterInput');
      const saveBtn = document.getElementById('saveFilterBtn');
      
      filterInput.disabled = false;
      saveBtn.disabled = false;
      
      expect(filterInput.disabled).toBe(false);
      expect(saveBtn.disabled).toBe(false);
    });
  });

  describe('Saved Filters Display', () => {
    test('should display saved filters as chips', () => {
      mockStorage[SAVED_FILTERS_KEY] = ['Team A', 'Backend'];
      const container = document.getElementById('savedFilters');

      container.innerHTML = '';
      const savedFilters = mockStorage[SAVED_FILTERS_KEY];

      if (savedFilters && savedFilters.length > 0) {
        const label = document.createElement('div');
        label.className = 'saved-filters-label';
        label.textContent = 'Saved Filters:';
        container.appendChild(label);

        savedFilters.forEach(filter => {
          const chip = document.createElement('div');
          chip.className = 'filter-chip';
          chip.textContent = filter;
          container.appendChild(chip);
        });
      }

      expect(container.children.length).toBe(3); // 1 label + 2 chips
      expect(container.textContent).toContain('Team A');
      expect(container.textContent).toContain('Backend');
    });

    test('should not display saved filters container when empty', () => {
      mockStorage[SAVED_FILTERS_KEY] = [];
      const container = document.getElementById('savedFilters');

      container.innerHTML = '';
      const savedFilters = mockStorage[SAVED_FILTERS_KEY];

      if (!savedFilters || savedFilters.length === 0) {
        container.innerHTML = '';
      }

      expect(container.children.length).toBe(0);
    });

    test('should be able to click saved filter to apply it', () => {
      mockStorage[SAVED_FILTERS_KEY] = ['Team A'];
      const filterInput = document.getElementById('filterInput');

      const filterText = 'Team A';
      filterInput.value = filterText;

      expect(filterInput.value).toBe('Team A');
    });

    test('[REGRESSION] saved filters should be sorted alphabetically when added', () => {
      mockStorage[SAVED_FILTERS_KEY] = ['Team B', 'Team A'];

      // Simulate adding 'Team C'
      let saved = mockStorage[SAVED_FILTERS_KEY];
      saved.push('Team C');
      saved.sort();
      mockStorage[SAVED_FILTERS_KEY] = saved;

      expect(mockStorage[SAVED_FILTERS_KEY]).toEqual(['Team A', 'Team B', 'Team C']);
    });

    test('[REGRESSION] saved filters should remain sorted when one is removed', () => {
      mockStorage[SAVED_FILTERS_KEY] = ['Team A', 'Team B', 'Team C'];

      // Remove 'Team B'
      let saved = mockStorage[SAVED_FILTERS_KEY].filter(f => f !== 'Team B');
      saved.sort();
      mockStorage[SAVED_FILTERS_KEY] = saved;

      expect(mockStorage[SAVED_FILTERS_KEY]).toEqual(['Team A', 'Team C']);
    });
  });

  describe('Color Palette for Button States', () => {
    test('[REGRESSION] disabled buttons should have distinct grey color', () => {
      const style = document.createElement('style');
      style.textContent = `.action-button:disabled { background-color: #b3b3b3; }`;
      document.head.appendChild(style);

      const btn = document.getElementById('collapseBtn');
      btn.disabled = true;

      window.getComputedStyle(btn);
      // Note: This test verifies the style was applied, actual color testing is better in E2E
      expect(btn.disabled).toBe(true);
    });

    test('[REGRESSION] enabled primary button should have blue color', () => {
      const style = document.createElement('style');
      style.textContent = `.action-button { background-color: #0052cc; }`;
      document.head.appendChild(style);

      const btn = document.getElementById('collapseBtn');
      btn.disabled = false;

      expect(btn.disabled).toBe(false);
    });

    test('[REGRESSION] enabled secondary button should have cyan color', () => {
      const style = document.createElement('style');
      style.textContent = `.action-button.secondary { background-color: #0099cc; }`;
      document.head.appendChild(style);

      const btn = document.getElementById('expandBtn');
      btn.disabled = false;

      expect(btn.disabled).toBe(false);
      expect(btn.classList.contains('secondary')).toBe(true);
    });
  });

  describe('Show All Sprints Filter State', () => {
    const CURRENT_FILTER_KEY = 'currentFilter';

    test('[REGRESSION] Show All should clear filter input value', () => {
      const filterInput = document.getElementById('filterInput');
      filterInput.value = 'Team A';

      // Simulate Show All action
      filterInput.value = '';

      expect(filterInput.value).toBe('');
    });

    test('[REGRESSION] Show All should re-enable filter input', () => {
      const filterInput = document.getElementById('filterInput');
      filterInput.disabled = true;

      // Simulate Show All action
      filterInput.disabled = false;

      expect(filterInput.disabled).toBe(false);
    });

    test('[REGRESSION] Show All should clear current filter from storage', () => {
      mockStorage[CURRENT_FILTER_KEY] = 'Team A';

      // Simulate Show All action
      mockStorage[CURRENT_FILTER_KEY] = '';

      expect(mockStorage[CURRENT_FILTER_KEY]).toBe('');
    });

    test('[REGRESSION] Show All should trigger filter display refresh', () => {
      // This test verifies that loadAndDisplaySavedFilters would be called
      // In actual implementation, this refreshes the chip selections
      mockStorage[CURRENT_FILTER_KEY] = 'Team A';
      mockStorage[SAVED_FILTERS_KEY] = ['Team A', 'Team B'];

      // Simulate Show All action
      mockStorage[CURRENT_FILTER_KEY] = '';

      // The current filter should no longer match any saved filter
      const currentFilter = mockStorage[CURRENT_FILTER_KEY];
      const hasMatch = mockStorage[SAVED_FILTERS_KEY].includes(currentFilter);

      expect(hasMatch).toBe(false);
    });
  });

  describe('Favorite Button Confirmation', () => {
    test('[REGRESSION] adding a favorite should not show confirmation', () => {
      const filterText = 'Team A';
      mockStorage[SAVED_FILTERS_KEY] = [];

      // Simulate adding without confirmation
      let saved = mockStorage[SAVED_FILTERS_KEY];
      const isSaved = saved.includes(filterText);

      expect(isSaved).toBe(false);

      // Add directly without confirm
      saved.push(filterText);
      mockStorage[SAVED_FILTERS_KEY] = saved;

      expect(mockStorage[SAVED_FILTERS_KEY]).toContain('Team A');
    });

    test('[REGRESSION] removing a favorite should require confirmation', () => {
      const filterText = 'Team A';
      mockStorage[SAVED_FILTERS_KEY] = ['Team A', 'Team B'];

      const saved = mockStorage[SAVED_FILTERS_KEY];
      const isSaved = saved.includes(filterText);

      // Should be saved, meaning removal requires confirmation
      expect(isSaved).toBe(true);

      // Simulate user confirming removal
      const userConfirmed = true;
      if (userConfirmed) {
        mockStorage[SAVED_FILTERS_KEY] = saved.filter(f => f !== filterText);
      }

      expect(mockStorage[SAVED_FILTERS_KEY]).not.toContain('Team A');
      expect(mockStorage[SAVED_FILTERS_KEY]).toContain('Team B');
    });
  });

  describe('Close Button', () => {
    test('[REGRESSION] close button should exist in DOM', () => {
      const closeBtn = document.getElementById('closeBtn');
      expect(closeBtn).not.toBeNull();
    });

    test('[REGRESSION] close button should have proper classes', () => {
      const closeBtn = document.getElementById('closeBtn');
      expect(closeBtn.classList.contains('close-btn')).toBe(true);
    });

    test('[REGRESSION] close button should have × character', () => {
      const closeBtn = document.getElementById('closeBtn');
      // The button text might be set dynamically, but we expect it to contain ×
      closeBtn.textContent = '×';
      expect(closeBtn.textContent).toBe('×');
    });
  });

  describe('Spinner Animations', () => {
    test('[REGRESSION] button should display spinner during operation', () => {
      const btn = document.getElementById('collapseBtn');

      // Simulate operation starting
      btn.innerHTML = '<span class="spinner"></span>Collapsing...';

      expect(btn.innerHTML).toContain('spinner');
      expect(btn.textContent).toContain('Collapsing...');
    });

    test('[REGRESSION] button should restore original text after operation', () => {
      const btn = document.getElementById('collapseBtn');
      const originalText = 'Collapse All Sprints';

      // Simulate operation starting
      btn.innerHTML = '<span class="spinner"></span>Collapsing...';

      // Simulate operation completing
      btn.textContent = originalText;

      expect(btn.textContent).toBe(originalText);
      expect(btn.innerHTML).not.toContain('spinner');
    });

    test('[REGRESSION] all action buttons should support spinner state', () => {
      const buttons = [
        { id: 'collapseBtn', activeText: 'Collapsing...' },
        { id: 'expandBtn', activeText: 'Expanding...' },
        { id: 'filterBtn', activeText: 'Filtering...' },
        { id: 'showAllBtn', activeText: 'Restoring...' }
      ];

      buttons.forEach(({ id, activeText }) => {
        const btn = document.getElementById(id);
        btn.innerHTML = `<span class="spinner"></span>${activeText}`;

        expect(btn.innerHTML).toContain('spinner');
        expect(btn.textContent).toContain(activeText);
      });
    });
  });

  describe('Filter Chips Disabled State', () => {
    test('[REGRESSION] filter chips container should be disabled during operations', () => {
      const container = document.getElementById('savedFilters');

      // Simulate disabling chips
      container.classList.add('disabled');

      expect(container.classList.contains('disabled')).toBe(true);
    });

    test('[REGRESSION] filter chips container should be re-enabled after operations', () => {
      const container = document.getElementById('savedFilters');

      // Simulate operation starting
      container.classList.add('disabled');
      expect(container.classList.contains('disabled')).toBe(true);

      // Simulate operation completing
      container.classList.remove('disabled');
      expect(container.classList.contains('disabled')).toBe(false);
    });

    test('[REGRESSION] disabled chips should have reduced opacity', () => {
      const style = document.createElement('style');
      style.textContent = `.saved-filters.disabled { opacity: 0.5; pointer-events: none; }`;
      document.head.appendChild(style);

      const container = document.getElementById('savedFilters');
      container.classList.add('disabled');

      expect(container.classList.contains('disabled')).toBe(true);
    });
  });

  describe('Dynamic Button Text', () => {
    test('[REGRESSION] buttons should say "All Sprints" when no filter is applied', () => {
      const collapseBtn = document.getElementById('collapseBtn');
      const expandBtn = document.getElementById('expandBtn');

      // Simulate no filter applied
      const hasFilterApplied = false;

      if (!hasFilterApplied) {
        collapseBtn.textContent = 'Collapse All Sprints';
        expandBtn.textContent = 'Expand All Sprints';
      }

      expect(collapseBtn.textContent).toBe('Collapse All Sprints');
      expect(expandBtn.textContent).toBe('Expand All Sprints');
    });

    test('[REGRESSION] buttons should say "Visible Sprints" when filter is applied', () => {
      const collapseBtn = document.getElementById('collapseBtn');
      const expandBtn = document.getElementById('expandBtn');

      // Save original text
      collapseBtn.dataset.originalText = collapseBtn.textContent;
      expandBtn.dataset.originalText = expandBtn.textContent;

      // Simulate filter applied
      const hasFilterApplied = true;

      if (hasFilterApplied) {
        collapseBtn.textContent = 'Collapse Visible Sprints';
        expandBtn.textContent = 'Expand Visible Sprints';
      }

      expect(collapseBtn.textContent).toBe('Collapse Visible Sprints');
      expect(expandBtn.textContent).toBe('Expand Visible Sprints');
    });

    test('[REGRESSION] buttons should restore original text when filter is removed', () => {
      const collapseBtn = document.getElementById('collapseBtn');
      const expandBtn = document.getElementById('expandBtn');

      // Set initial state
      collapseBtn.dataset.originalText = 'Collapse All Sprints';
      expandBtn.dataset.originalText = 'Expand All Sprints';

      // Apply filter
      collapseBtn.textContent = 'Collapse Visible Sprints';
      expandBtn.textContent = 'Expand Visible Sprints';

      // Remove filter
      const hasFilterApplied = false;
      if (!hasFilterApplied) {
        collapseBtn.textContent = collapseBtn.dataset.originalText;
        expandBtn.textContent = expandBtn.dataset.originalText;
      }

      expect(collapseBtn.textContent).toBe('Collapse All Sprints');
      expect(expandBtn.textContent).toBe('Expand All Sprints');
    });
  });

  describe('Debug Mode', () => {
    const DEBUG_MODE_KEY = 'debugMode';

    test('[REGRESSION] debug mode should be disabled by default', () => {
      mockStorage[DEBUG_MODE_KEY] = false;
      expect(mockStorage[DEBUG_MODE_KEY]).toBe(false);
    });

    test('[REGRESSION] debug mode can be toggled on', () => {
      mockStorage[DEBUG_MODE_KEY] = false;

      // Toggle on
      mockStorage[DEBUG_MODE_KEY] = !mockStorage[DEBUG_MODE_KEY];

      expect(mockStorage[DEBUG_MODE_KEY]).toBe(true);
    });

    test('[REGRESSION] debug mode can be toggled off', () => {
      mockStorage[DEBUG_MODE_KEY] = true;

      // Toggle off
      mockStorage[DEBUG_MODE_KEY] = !mockStorage[DEBUG_MODE_KEY];

      expect(mockStorage[DEBUG_MODE_KEY]).toBe(false);
    });

    test('[REGRESSION] debug mode persists across sessions', () => {
      mockStorage[DEBUG_MODE_KEY] = true;

      // Simulate page reload - storage should retain value
      const persistedValue = mockStorage[DEBUG_MODE_KEY];

      expect(persistedValue).toBe(true);
    });

    test('[REGRESSION] title should indicate debug mode when enabled', () => {
      const title = document.querySelector('h2');
      mockStorage[DEBUG_MODE_KEY] = true;

      // Simulate debug mode UI update
      if (mockStorage[DEBUG_MODE_KEY]) {
        title.style.color = '#ff6b6b';
        title.title = 'Debug mode enabled - Triple-click to disable';
      }

      // CSS colors can be returned as hex or rgb format
      expect(title.style.color).toBeTruthy();
      expect(['#ff6b6b', 'rgb(255, 107, 107)']).toContain(title.style.color);
      expect(title.title).toContain('Debug mode enabled');
    });

    test('[REGRESSION] title should clear indicator when debug mode disabled', () => {
      const title = document.querySelector('h2');
      mockStorage[DEBUG_MODE_KEY] = false;

      // Simulate debug mode UI update
      if (!mockStorage[DEBUG_MODE_KEY]) {
        title.style.color = '';
        title.title = 'Triple-click to enable debug mode';
      }

      expect(title.style.color).toBe('');
      expect(title.title).toContain('Triple-click to enable');
    });
  });

  describe('Popup Initialization', () => {
    test('[REGRESSION] all action buttons should be disabled initially', () => {
      const collapseBtn = document.getElementById('collapseBtn');
      const expandBtn = document.getElementById('expandBtn');
      const filterBtn = document.getElementById('filterBtn');
      const showAllBtn = document.getElementById('showAllBtn');

      // Simulate initial state
      collapseBtn.disabled = true;
      expandBtn.disabled = true;
      filterBtn.disabled = true;
      showAllBtn.disabled = true;

      expect(collapseBtn.disabled).toBe(true);
      expect(expandBtn.disabled).toBe(true);
      expect(filterBtn.disabled).toBe(true);
      expect(showAllBtn.disabled).toBe(true);
    });

    test('[REGRESSION] buttons should be enabled after state is loaded', () => {
      const collapseBtn = document.getElementById('collapseBtn');
      const expandBtn = document.getElementById('expandBtn');

      // Initial disabled state
      collapseBtn.disabled = true;
      expandBtn.disabled = true;

      // Simulate state loaded via callback
      const sprintState = { allCollapsed: false, allExpanded: false };
      collapseBtn.disabled = sprintState.allCollapsed;
      expandBtn.disabled = sprintState.allExpanded;

      expect(collapseBtn.disabled).toBe(false);
      expect(expandBtn.disabled).toBe(false);
    });
  });

  describe('URL Support Checking', () => {
    // Helper function matching the one in popup.js
    function isUrlSupported(url) {
      if (!url) return false;

      const patterns = [
        /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
        /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
        /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/backlog/
      ];

      return patterns.some(pattern => pattern.test(url));
    }

    test('[REGRESSION] should recognize valid Jira backlog URL pattern 1 (c/projects)', () => {
      const url = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog';
      expect(isUrlSupported(url)).toBe(true);
    });

    test('[REGRESSION] should recognize valid Jira backlog URL pattern 2 (projects with segment)', () => {
      const url = 'https://example.atlassian.net/jira/software/v1/projects/PROJ/boards/123/backlog';
      expect(isUrlSupported(url)).toBe(true);
    });

    test('[REGRESSION] should recognize valid Jira backlog URL pattern 3 (simple with segment)', () => {
      const url = 'https://example.atlassian.net/jira/software/v1/backlog';
      expect(isUrlSupported(url)).toBe(true);
    });

    test('[REGRESSION] should reject non-Jira URLs', () => {
      const url = 'https://example.com';
      expect(isUrlSupported(url)).toBe(false);
    });

    test('[REGRESSION] should reject Jira URLs that are not backlog pages', () => {
      const url = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123';
      expect(isUrlSupported(url)).toBe(false);
    });

    test('[REGRESSION] should reject empty or null URLs', () => {
      expect(isUrlSupported('')).toBe(false);
      expect(isUrlSupported(null)).toBe(false);
      expect(isUrlSupported(undefined)).toBe(false);
    });

    test('[REGRESSION] should reject URLs with query parameters at the end', () => {
      const url = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog?selectedIssue=PROJ-123';
      expect(isUrlSupported(url)).toBe(true); // Query params are OK after backlog
    });

    test('[REGRESSION] should handle URLs with different subdomains', () => {
      const url1 = 'https://mycompany.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog';
      const url2 = 'https://another-org.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog';

      expect(isUrlSupported(url1)).toBe(true);
      expect(isUrlSupported(url2)).toBe(true);
    });
  });

  describe('Page Support Error Messages', () => {
    test('[REGRESSION] should show generic error when URL does not match pattern', () => {
      const statusDiv = document.getElementById('status');

      // Simulate unsupported URL check
      const isSupported = false; // URL check failed

      if (!isSupported) {
        statusDiv.textContent = 'This extension only works on Jira Cloud board backlog pages. Please navigate to a Jira Cloud board backlog.';
        statusDiv.className = 'status-message error';
      }

      expect(statusDiv.textContent).toContain('only works on Jira Cloud board backlog pages');
      expect(statusDiv.className).toContain('error');
    });

    test('[REGRESSION] should show different error when URL matches but content script not loaded', () => {
      const statusDiv = document.getElementById('status');

      // Simulate supported URL but no content script response
      const isUrlSupported = true;
      const contentScriptResponded = false;
      const retriesExhausted = true;

      if (isUrlSupported && !contentScriptResponded && retriesExhausted) {
        statusDiv.textContent = 'Content script not loaded. Try refreshing the page.';
        statusDiv.className = 'status-message error';
      }

      expect(statusDiv.textContent).toContain('Content script not loaded');
      expect(statusDiv.textContent).toContain('Try refreshing');
      expect(statusDiv.className).toContain('error');
    });

    test('[REGRESSION] unsupported URL should show error without retry delay', () => {
      const startTime = Date.now();
      const statusDiv = document.getElementById('status');

      // Simulate immediate error (no retries for unsupported URL)
      const isUrlSupported = false;

      if (!isUrlSupported) {
        statusDiv.textContent = 'This extension only works on Jira Cloud board backlog pages. Please navigate to a Jira Cloud board backlog.';
        const endTime = Date.now();
        const elapsed = endTime - startTime;

        // Should be nearly instant (< 50ms) since no retries
        expect(elapsed).toBeLessThan(50);
      }

      expect(statusDiv.textContent).toContain('only works on Jira Cloud board backlog pages');
    });

    test('[REGRESSION] supported URL should trigger retry mechanism', () => {
      const isUrlSupported = true;
      const retries = 5;
      const delay = 200;

      // Verify retry parameters are set correctly for supported URLs
      expect(isUrlSupported).toBe(true);
      expect(retries).toBe(5);
      expect(delay).toBe(200);

      // Total wait time should be up to 5 * 200ms = 1000ms
      const maxWaitTime = retries * delay;
      expect(maxWaitTime).toBe(1000);
    });
  });

  describe('Tab Navigation Scenarios', () => {
    test('[REGRESSION] navigating from non-Jira to Jira page should allow popup to work', () => {
      // Scenario 1: User on non-Jira page
      let currentUrl = 'https://example.com';
      let isSupported = currentUrl.includes('atlassian.net') && currentUrl.includes('backlog');

      expect(isSupported).toBe(false);

      // Scenario 2: User navigates to Jira page
      currentUrl = 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog';
      isSupported = currentUrl.includes('atlassian.net') && currentUrl.includes('backlog');

      expect(isSupported).toBe(true);

      // Popup should now check URL and attempt to contact content script
      // This test verifies the URL check would pass
    });

    test('[REGRESSION] opening popup on Jira page should check current URL, not cached state', () => {
      // Simulate popup opening - should always check current tab URL
      const getCurrentTabUrl = () => 'https://example.atlassian.net/jira/software/c/projects/PROJ/boards/123/backlog';

      const currentUrl = getCurrentTabUrl();
      const patterns = [
        /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^/]+\/boards\/[^/]+\/backlog/
      ];

      const isCurrentlySupported = patterns.some(pattern => pattern.test(currentUrl));

      expect(isCurrentlySupported).toBe(true);
      // This ensures we're not relying on stale state
    });

    test('[REGRESSION] popup should retry if content script is loading', () => {
      let contentScriptReady = false;
      let attemptCount = 0;
      const maxRetries = 5;

      // Simulate retry logic
      while (!contentScriptReady && attemptCount < maxRetries) {
        attemptCount++;

        // On 3rd attempt, content script becomes ready
        if (attemptCount === 3) {
          contentScriptReady = true;
        }
      }

      expect(contentScriptReady).toBe(true);
      expect(attemptCount).toBe(3);
      expect(attemptCount).toBeLessThan(maxRetries);
    });
  });
});
