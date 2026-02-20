// Constants
const SAVED_FILTERS_KEY = 'savedFilters';
const CURRENT_FILTER_KEY = 'currentFilter';
const DEBUG_MODE_KEY = 'debugMode';
const MAX_SAVED_FILTERS = 10;

// Debug logging helper
let debugModeEnabled = false;

// In-memory caches to avoid repeated storage reads
let cachedSavedFilters = [];
let cachedCurrentFilter = '';

async function loadDebugMode() {
  const data = await chrome.storage.local.get(DEBUG_MODE_KEY);
  debugModeEnabled = data[DEBUG_MODE_KEY] || false;
  updateDebugIndicator();
}

async function toggleDebugMode() {
  debugModeEnabled = !debugModeEnabled;
  await chrome.storage.local.set({ [DEBUG_MODE_KEY]: debugModeEnabled });
  updateDebugIndicator();
  // Always log toggle events so user can see the change
  console.log('[Sprint Collapser Popup] Debug mode:', debugModeEnabled ? 'ENABLED' : 'DISABLED');
}

function updateDebugIndicator() {
  const title = document.querySelector('h2');
  if (debugModeEnabled) {
    title.style.color = '#ff6b6b';
    title.title = 'Debug mode enabled - Triple-click to disable';
  } else {
    title.style.color = '';
    title.title = 'Triple-click to enable debug mode';
  }
}

function debugLog(...args) {
  if (debugModeEnabled) {
    console.log('[Sprint Collapser Popup]', ...args);
  }
}

// Returns the active tab, or null if none found
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// Sets a button into a loading state using createElement (avoids innerHTML)
function setButtonLoading(btn, text) {
  btn.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  btn.appendChild(spinner);
  btn.appendChild(document.createTextNode(text));
}

// Initializes both saved-filter list and current filter state with a single storage read
async function initializeFilterState() {
  const data = await chrome.storage.local.get([SAVED_FILTERS_KEY, CURRENT_FILTER_KEY]);
  cachedSavedFilters = data[SAVED_FILTERS_KEY] || [];
  cachedCurrentFilter = data[CURRENT_FILTER_KEY] || '';
  displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);

  if (cachedCurrentFilter) {
    // Only disable the input when the active filter came from a saved chip.
    // Custom filter text should remain editable on re-open.
    const isSavedFilter = cachedSavedFilters.includes(cachedCurrentFilter);
    document.getElementById('filterInput').disabled = isSavedFilter;
    applyFilterDirect(cachedCurrentFilter);
  } else {
    document.getElementById('filterInput').value = '';
    document.getElementById('filterInput').disabled = false;
  }
}

function displaySavedFilters(savedFilters, currentFilter = '') {
  const container = document.getElementById('savedFilters');
  container.innerHTML = '';

  if (savedFilters.length === 0) {
    return;
  }

  const label = document.createElement('div');
  label.className = 'saved-filters-label';
  label.textContent = 'Saved Filters:';
  container.appendChild(label);

  savedFilters.forEach((filter) => {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    const isSelected = filter === currentFilter;
    if (isSelected) {
      chip.classList.add('selected');
    }

    const text = document.createElement('span');
    text.textContent = filter;
    text.style.marginRight = '2px';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'filter-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete filter "${filter}"?`)) {
        removeSavedFilter(filter);
      }
    });

    chip.appendChild(text);
    chip.appendChild(removeBtn);

    chip.addEventListener('click', async (e) => {
      // Don't toggle if clicking the remove button
      if (e.target === removeBtn) return;

      if (isSelected) {
        // Deselect: clear filter and enable input
        cachedCurrentFilter = '';
        await chrome.storage.local.set({ [CURRENT_FILTER_KEY]: '' });
        document.getElementById('filterInput').value = '';
        document.getElementById('filterInput').disabled = false;

        // Send message to clear filter on content script
        const tab = await getActiveTab();
        if (!tab) return;
        chrome.tabs.sendMessage(tab.id, { action: 'showAllSprints' }, () => {
          updateSaveButtonState();
          updateActionButtonStates(tab.id);
          displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);
        });
      } else {
        // Select: apply filter and disable input
        cachedCurrentFilter = filter;
        await chrome.storage.local.set({ [CURRENT_FILTER_KEY]: filter });
        document.getElementById('filterInput').value = filter;
        document.getElementById('filterInput').disabled = true;

        // Send message to apply filter on content script
        const tab = await getActiveTab();
        if (!tab) return;
        chrome.tabs.sendMessage(tab.id, { action: 'filterSprints', filter }, () => {
          updateSaveButtonState();
          updateActionButtonStates(tab.id);
          displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);
        });
      }
    });

    container.appendChild(chip);
  });
}

async function removeSavedFilter(filterText) {
  cachedSavedFilters = cachedSavedFilters.filter((f) => f !== filterText).sort();
  const updates = { [SAVED_FILTERS_KEY]: cachedSavedFilters };
  if (cachedCurrentFilter === filterText) {
    cachedCurrentFilter = '';
    updates[CURRENT_FILTER_KEY] = '';
  }
  await chrome.storage.local.set(updates);
  displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);
  updateSaveButtonState();
}

async function saveFilter(filterText) {
  if (!filterText.trim()) {
    updateStatus('Cannot save empty filter', false);
    return;
  }

  if (cachedSavedFilters.includes(filterText)) {
    // Remove if already saved
    cachedSavedFilters = cachedSavedFilters.filter((f) => f !== filterText);
  } else {
    // Add new filter
    if (cachedSavedFilters.length >= MAX_SAVED_FILTERS) {
      updateStatus(`Maximum ${MAX_SAVED_FILTERS} saved filters`, false);
      return;
    }
    cachedSavedFilters = [...cachedSavedFilters, filterText];
  }

  // Sort alphabetically before saving
  cachedSavedFilters.sort();

  await chrome.storage.local.set({ [SAVED_FILTERS_KEY]: cachedSavedFilters });
  displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);
  updateSaveButtonState();
}

// Synchronous: uses in-memory cache instead of a storage read
function updateSaveButtonState() {
  const filterInput = document.getElementById('filterInput');
  const saveBtn = document.getElementById('saveFilterBtn');
  const currentFilter = filterInput.value.trim();

  if (!currentFilter) {
    saveBtn.style.display = 'none';
    saveBtn.classList.remove('pulsing');
    return;
  }

  saveBtn.style.display = 'block';

  const isSaved = cachedSavedFilters.includes(currentFilter);
  if (isSaved) {
    saveBtn.classList.add('saved');
    saveBtn.classList.remove('pulsing');
    saveBtn.textContent = '★';
  } else {
    saveBtn.classList.remove('saved');
    saveBtn.classList.add('pulsing');
    saveBtn.textContent = '☆';
  }
}

function applyFilterDirect(filterText) {
  document.getElementById('filterInput').value = filterText;
  updateSaveButtonState();
  applyFilter();
}

function updateStatus(message, isSuccess) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = 'status-message ' + (isSuccess ? 'success' : 'error');

  setTimeout(() => {
    statusDiv.textContent = '';
    statusDiv.className = 'status-message';
  }, 3000);
}

function disableAllControls(disabled) {
  document.getElementById('collapseBtn').disabled = disabled;
  document.getElementById('expandBtn').disabled = disabled;
  document.getElementById('filterBtn').disabled = disabled;
  document.getElementById('showAllBtn').disabled = disabled;
  document.getElementById('filterInput').disabled = disabled;
  document.getElementById('saveFilterBtn').disabled = disabled;
}

function disableFilterChips(disabled) {
  const savedFiltersContainer = document.getElementById('savedFilters');
  if (disabled) {
    savedFiltersContainer.classList.add('disabled');
  } else {
    savedFiltersContainer.classList.remove('disabled');
  }
}

function updateCollapseExpandButtonText(hasFilterApplied) {
  const collapseBtn = document.getElementById('collapseBtn');
  const expandBtn = document.getElementById('expandBtn');

  if (hasFilterApplied) {
    // Store original text if not already stored
    if (!collapseBtn.dataset.originalText) {
      collapseBtn.dataset.originalText = collapseBtn.textContent;
    }
    if (!expandBtn.dataset.originalText) {
      expandBtn.dataset.originalText = expandBtn.textContent;
    }

    collapseBtn.textContent = 'Collapse Visible Sprints';
    expandBtn.textContent = 'Expand Visible Sprints';
  } else {
    // Restore original text or use default
    collapseBtn.textContent = collapseBtn.dataset.originalText || 'Collapse All Sprints';
    expandBtn.textContent = expandBtn.dataset.originalText || 'Expand All Sprints';
  }
}

async function updateActionButtonStates(tabIdOrCallback, callback) {
  let tabId, cb;
  if (typeof tabIdOrCallback === 'number') {
    tabId = tabIdOrCallback;
    cb = callback;
  } else {
    cb = tabIdOrCallback;
    const tab = await getActiveTab();
    if (!tab) { if (cb) cb(); return; }
    tabId = tab.id;
  }

  chrome.tabs.sendMessage(
    tabId,
    { action: 'getSprintState' },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        if (cb) cb();
        return; // Not on supported page
      }

      const filterInput = document.getElementById('filterInput');
      const hasFilterText = filterInput.value.trim() !== '';
      const hasFilterApplied = response.anyFiltered;

      // Update button text based on filter state
      updateCollapseExpandButtonText(hasFilterApplied);

      // Disable Hide Non-Matching if no text OR if a filter is already applied
      document.getElementById('filterBtn').disabled = !hasFilterText || hasFilterApplied;

      // Disable Show All if no sprints are filtered
      document.getElementById('showAllBtn').disabled = !hasFilterApplied;

      // Disable Collapse All if all already collapsed
      document.getElementById('collapseBtn').disabled = response.allCollapsed;

      // Disable Expand All if all already expanded
      document.getElementById('expandBtn').disabled = response.allExpanded;

      if (cb) cb();
    }
  );
}

// Check if URL matches supported page patterns
function isUrlSupported(url) {
  if (!url) return false;

  const patterns = [
    /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
    /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
    /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/backlog/
  ];

  return patterns.some(pattern => pattern.test(url));
}

// Check if we're on a supported page when popup loads
async function checkSupportedPage(retries = 5, delay = 200) {
  const tab = await getActiveTab();
  if (!tab) return;

  const totalRetries = retries;

  // Disable action buttons initially until state is loaded
  document.getElementById('collapseBtn').disabled = true;
  document.getElementById('expandBtn').disabled = true;
  document.getElementById('filterBtn').disabled = true;
  document.getElementById('showAllBtn').disabled = true;

  // First check if the URL matches supported patterns
  const urlSupported = isUrlSupported(tab.url);

  if (!urlSupported) {
    // URL doesn't match - show error immediately without retrying
    debugLog('URL not supported:', tab.url);
    disableAllControls(true);
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'This extension only works on Jira Cloud board backlog pages. Please navigate to a Jira Cloud board backlog.';
    statusDiv.className = 'status-message error';
    statusDiv.style.marginTop = '16px';
    return;
  }

  // URL is supported, so content script should be present
  // Try to reach it with retries (handles timing issues and SPA navigation)
  debugLog('URL is supported, attempting to reach content script');

  const attemptCheck = (retriesLeft) => {
    debugLog(`Attempting to reach content script (${totalRetries - retriesLeft + 1}/${totalRetries})`);

    chrome.tabs.sendMessage(
      tab.id,
      { action: 'checkPageSupport' },
      async (response) => {
        if (chrome.runtime.lastError || !response) {
          debugLog(`No response:`, chrome.runtime.lastError?.message);
          if (retriesLeft > 0) {
            debugLog(`Retrying in ${delay}ms...`);
            setTimeout(() => attemptCheck(retriesLeft - 1), delay);
          } else {
            debugLog('Max retries reached, content script not responding');
            disableAllControls(true);
            const statusDiv = document.getElementById('status');
            statusDiv.textContent = 'Content script not loaded. Try refreshing the page.';
            statusDiv.className = 'status-message error';
            statusDiv.style.marginTop = '16px';
          }
        } else {
          // Successful response, initialize popup
          debugLog('Content script responded, initializing popup');
          await initializeFilterState();
          // Update button states based on current sprint state
          updateActionButtonStates(() => {
            debugLog('Popup initialized and ready');
          });
        }
      }
    );
  };

  attemptCheck(retries);
}

async function applyFilter() {
  const filterText = document.getElementById('filterInput').value.trim();

  if (!filterText) {
    updateStatus('Please enter a filter', false);
    return;
  }

  const btn = document.getElementById('filterBtn');
  const originalText = btn.textContent;

  // Show loading state with spinner and disable chips
  btn.disabled = true;
  setButtonLoading(btn, 'Filtering...');
  disableFilterChips(true);

  const tab = await getActiveTab();
  if (!tab) {
    btn.textContent = originalText;
    btn.disabled = false;
    disableFilterChips(false);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'filterSprints', filter: filterText }, (response) => {
    // Restore button state and re-enable chips
    btn.disabled = false;
    btn.textContent = originalText;
    disableFilterChips(false);

    if (response) {
      updateStatus(response.message, response.success);

      // Always persist the active filter text so it's restored when the popup reopens.
      // Chip selection is determined by whether the text matches a saved filter — no
      // separate flag needed.
      if (!cachedSavedFilters.includes(filterText)) {
        cachedCurrentFilter = filterText;
        chrome.storage.local.set({ [CURRENT_FILTER_KEY]: filterText });
      }
      // If it IS a saved filter, CURRENT_FILTER_KEY was already set when the chip was clicked
      displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);
    } else {
      updateStatus('Failed to filter sprints', false);
    }

    // Update button states after action completes
    updateActionButtonStates(tab.id);
  });
}

function init() {
  document.getElementById('collapseBtn').addEventListener('click', async () => {
    const btn = document.getElementById('collapseBtn');
    const originalText = btn.textContent;

    btn.disabled = true;
    setButtonLoading(btn, 'Collapsing...');
    disableFilterChips(true);

    const tab = await getActiveTab();
    if (!tab) {
      btn.textContent = originalText;
      btn.disabled = false;
      disableFilterChips(false);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'collapseAllSprints' }, async (response) => {
      btn.textContent = originalText;
      btn.disabled = false;
      disableFilterChips(false);

      if (chrome.runtime.lastError) {
        console.error('[Sprint Collapser Popup] Error sending message:', chrome.runtime.lastError);
        updateStatus('Error: ' + chrome.runtime.lastError.message, false);
      } else if (response) {
        debugLog('Collapse response:', response);
        updateStatus(response.message, response.success !== false);
        // Brief wait for Jira's React renderer to process the click events before querying state
        await new Promise(resolve => setTimeout(resolve, 800));
        updateActionButtonStates(tab.id);
      } else {
        console.warn('[Sprint Collapser Popup] No response from content script');
        updateStatus('Failed to collapse sprints', false);
      }
    });
  });

  document.getElementById('expandBtn').addEventListener('click', async () => {
    const btn = document.getElementById('expandBtn');
    const originalText = btn.textContent;

    btn.disabled = true;
    setButtonLoading(btn, 'Expanding...');
    disableFilterChips(true);

    const tab = await getActiveTab();
    if (!tab) {
      btn.textContent = originalText;
      btn.disabled = false;
      disableFilterChips(false);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'expandAllSprints' }, async (response) => {
      btn.textContent = originalText;
      btn.disabled = false;
      disableFilterChips(false);

      if (chrome.runtime.lastError) {
        console.error('[Sprint Collapser Popup] Error sending message:', chrome.runtime.lastError);
        updateStatus('Error: ' + chrome.runtime.lastError.message, false);
      } else if (response) {
        debugLog('Expand response:', response);
        updateStatus(response.message, response.success !== false);
        // Brief wait for Jira's React renderer to process the click events before querying state
        await new Promise(resolve => setTimeout(resolve, 800));
        updateActionButtonStates(tab.id);
      } else {
        console.warn('[Sprint Collapser Popup] No response from content script');
        updateStatus('Failed to expand sprints', false);
      }
    });
  });

  document.getElementById('filterBtn').addEventListener('click', applyFilter);

  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });

  document.getElementById('saveFilterBtn').addEventListener('click', async () => {
    const filterText = document.getElementById('filterInput').value.trim();
    const isSaved = cachedSavedFilters.includes(filterText);

    if (isSaved) {
      // Only show confirmation when removing
      if (confirm(`Remove "${filterText}" from saved filters?`)) {
        saveFilter(filterText);
      }
    } else {
      // No confirmation when adding
      saveFilter(filterText);
    }
  });

  document.getElementById('filterInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      applyFilter();
    }
  });

  document.getElementById('filterInput').addEventListener('input', () => {
    updateSaveButtonState();
    updateActionButtonStates();
  });

  document.getElementById('showAllBtn').addEventListener('click', async () => {
    const btn = document.getElementById('showAllBtn');
    const originalText = btn.textContent;

    btn.disabled = true;
    setButtonLoading(btn, 'Showing...');
    disableFilterChips(true);

    const tab = await getActiveTab();
    if (!tab) {
      btn.textContent = originalText;
      btn.disabled = false;
      disableFilterChips(false);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'showAllSprints' }, (response) => {
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);

      if (response) {
        updateStatus(response.message, true);

        // Clear the filter input and saved filter
        document.getElementById('filterInput').value = '';
        document.getElementById('filterInput').disabled = false;
        cachedCurrentFilter = '';
        chrome.storage.local.set({ [CURRENT_FILTER_KEY]: '' });
        updateSaveButtonState();

        // Refresh saved filters display to remove selected state
        displaySavedFilters(cachedSavedFilters, cachedCurrentFilter);
      } else {
        updateStatus('Failed to show sprints', false);
      }

      // Update button states after action completes
      updateActionButtonStates(tab.id);
    });
  });

  // Add triple-click handler to title for debug toggle
  document.querySelector('h2').addEventListener('click', (e) => {
    if (e.detail === 3) {
      toggleDebugMode();
    }
  });

  // Initialize debug mode and check page support
  loadDebugMode();
  checkSupportedPage();
}

// Defer initialization until DOM is ready. For a script at the bottom of <body>,
// the DOM is already parsed, so init() runs immediately in practice.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
