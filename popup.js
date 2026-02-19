// Constants
const SAVED_FILTERS_KEY = 'savedFilters';
const CURRENT_FILTER_KEY = 'currentFilter';
const DEBUG_MODE_KEY = 'debugMode';
const MAX_SAVED_FILTERS = 10;

// Debug logging helper
let debugModeEnabled = false;

async function loadDebugMode() {
  const data = await chrome.storage.local.get(DEBUG_MODE_KEY);
  debugModeEnabled = data[DEBUG_MODE_KEY] || false;
  updateDebugIndicator();
}

async function toggleDebugMode() {
  debugModeEnabled = !debugModeEnabled;
  await chrome.storage.local.set({ [DEBUG_MODE_KEY]: debugModeEnabled });
  updateDebugIndicator();
  // Always log toggle events (even when disabling) so user can see the change
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

// Helper to wait for batching to complete
async function waitForBatchingComplete(expectedState) {
  // With 113 buttons at 10/frame, we need time for:
  // 1. All clicks to be processed (113/10 = ~12 frames)
  // 2. Jira's React to reconcile the DOM changes
  // 3. aria-expanded attributes to be updated
  // Using 3.5 seconds to account for Jira's slower React reconciliation
  await new Promise(resolve => setTimeout(resolve, 3500));
}

// Load and display saved filters
async function loadAndDisplaySavedFilters() {
  const data = await chrome.storage.local.get([SAVED_FILTERS_KEY, CURRENT_FILTER_KEY]);
  const savedFilters = data[SAVED_FILTERS_KEY] || [];
  
  displaySavedFilters(savedFilters, data[CURRENT_FILTER_KEY]);
}

// Only called on popup load to restore the filter state
async function restoreFilterState() {
  const data = await chrome.storage.local.get(CURRENT_FILTER_KEY);
  const currentFilter = data[CURRENT_FILTER_KEY] || '';
  
  if (currentFilter) {
    // Disable input since a saved filter is selected
    document.getElementById('filterInput').disabled = true;
    applyFilterDirect(currentFilter);
  } else {
    // No saved filter - ensure input is cleared and enabled
    document.getElementById('filterInput').value = '';
    document.getElementById('filterInput').disabled = false;
  }
}

async function displaySavedFilters(savedFilters, currentFilter = '') {
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
        await chrome.storage.local.set({ [CURRENT_FILTER_KEY]: '' });
        document.getElementById('filterInput').value = '';
        document.getElementById('filterInput').disabled = false;
        
        // Send message to clear filter on content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'showAllSprints' }, () => {
          updateSaveButtonState();
          updateActionButtonStates();
          // Just refresh the display, don't re-apply
          loadAndDisplaySavedFilters();
        });
      } else {
        // Select: apply filter and disable input
        await chrome.storage.local.set({ [CURRENT_FILTER_KEY]: filter });
        document.getElementById('filterInput').value = filter;
        document.getElementById('filterInput').disabled = true;
        
        // Send message to apply filter on content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'filterSprints', filter }, () => {
          updateSaveButtonState();
          updateActionButtonStates();
          // Just refresh the display, don't re-apply
          loadAndDisplaySavedFilters();
        });
      }
    });

    container.appendChild(chip);
  });
}

async function removeSavedFilter(filterText) {
  const data = await chrome.storage.local.get(SAVED_FILTERS_KEY);
  let savedFilters = data[SAVED_FILTERS_KEY] || [];
  savedFilters = savedFilters.filter((f) => f !== filterText).sort();
  await chrome.storage.local.set({ [SAVED_FILTERS_KEY]: savedFilters });
  loadAndDisplaySavedFilters();
  updateSaveButtonState();
}

async function saveFilter(filterText) {
  if (!filterText.trim()) {
    updateStatus('Cannot save empty filter', false);
    return;
  }

  const data = await chrome.storage.local.get(SAVED_FILTERS_KEY);
  let savedFilters = data[SAVED_FILTERS_KEY] || [];

  if (savedFilters.includes(filterText)) {
    // Remove if already saved
    savedFilters = savedFilters.filter((f) => f !== filterText);
  } else {
    // Add new filter
    if (savedFilters.length >= MAX_SAVED_FILTERS) {
      updateStatus(`Maximum ${MAX_SAVED_FILTERS} saved filters`, false);
      return;
    }
    savedFilters.push(filterText);
  }

  // Sort alphabetically before saving
  savedFilters.sort();

  await chrome.storage.local.set({ [SAVED_FILTERS_KEY]: savedFilters });
  loadAndDisplaySavedFilters();
  updateSaveButtonState();
}

async function updateSaveButtonState() {
  const filterInput = document.getElementById('filterInput');
  const saveBtn = document.getElementById('saveFilterBtn');
  const currentFilter = filterInput.value.trim();

  if (!currentFilter) {
    saveBtn.style.display = 'none';
    return;
  }

  saveBtn.style.display = 'block';

  const data = await chrome.storage.local.get(SAVED_FILTERS_KEY);
  const savedFilters = data[SAVED_FILTERS_KEY] || [];
  const isSaved = savedFilters.includes(currentFilter);

  if (isSaved) {
    saveBtn.classList.add('saved');
    saveBtn.textContent = '★';
  } else {
    saveBtn.classList.remove('saved');
    saveBtn.textContent = '☆';
  }
}

function applyFilterDirect(filterText) {
  document.getElementById('filterInput').value = filterText;
  updateSaveButtonState();
  setTimeout(() => applyFilter(), 50);
}

document.getElementById('collapseBtn').addEventListener('click', async () => {
  const btn = document.getElementById('collapseBtn');
  const originalText = btn.textContent;

  // Show loading state with spinner and disable chips
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Collapsing...';
  disableFilterChips(true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'collapseAllSprints' }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Sprint Collapser Popup] Error sending message:', chrome.runtime.lastError);
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);
      updateStatus('Error: ' + chrome.runtime.lastError.message, false);
    } else if (response) {
      debugLog('Collapse response:', response);
      updateStatus(response.message, response.success !== false);

      // Wait for all DOM updates to settle
      debugLog('Waiting for collapse to complete...');
      await waitForBatchingComplete();
      debugLog('Collapse complete');

      // Restore button state and re-enable chips
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);

      // After collapse, we KNOW:
      // - Collapse button should be disabled (all collapsed)
      // - Expand button should be enabled (can expand)
      document.getElementById('collapseBtn').disabled = true;
      document.getElementById('expandBtn').disabled = false;
    } else {
      console.warn('[Sprint Collapser Popup] No response from content script');
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);
      updateStatus('Failed to collapse sprints', false);
    }
  });
});

document.getElementById('expandBtn').addEventListener('click', async () => {
  const btn = document.getElementById('expandBtn');
  const originalText = btn.textContent;

  // Show loading state with spinner and disable chips
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Expanding...';
  disableFilterChips(true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'expandAllSprints' }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Sprint Collapser Popup] Error sending message:', chrome.runtime.lastError);
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);
      updateStatus('Error: ' + chrome.runtime.lastError.message, false);
    } else if (response) {
      debugLog('Expand response:', response);
      updateStatus(response.message, response.success !== false);

      // Wait for all DOM updates to settle
      debugLog('Waiting for expand to complete...');
      await waitForBatchingComplete();
      debugLog('Expand complete');

      // Restore button state and re-enable chips
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);

      // After expand, we KNOW:
      // - Expand button should be disabled (all expanded)
      // - Collapse button should be enabled (can collapse)
      document.getElementById('expandBtn').disabled = true;
      document.getElementById('collapseBtn').disabled = false;
    } else {
      console.warn('[Sprint Collapser Popup] No response from content script');
      btn.disabled = false;
      btn.textContent = originalText;
      disableFilterChips(false);
      updateStatus('Failed to expand sprints', false);
    }
  });
});

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
  btn.innerHTML = '<span class="spinner"></span>Filtering...';
  disableFilterChips(true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'filterSprints', filter: filterText }, (response) => {
    // Restore button state and re-enable chips
    btn.disabled = false;
    btn.textContent = originalText;
    disableFilterChips(false);

    if (response) {
      updateStatus(response.message, response.success);

      // Only save to CURRENT_FILTER_KEY if it's a saved filter
      const data = chrome.storage.local.get(SAVED_FILTERS_KEY, (result) => {
        const savedFilters = result[SAVED_FILTERS_KEY] || [];
        if (!savedFilters.includes(filterText)) {
          // Custom filter - clear CURRENT_FILTER_KEY so no chip appears selected
          chrome.storage.local.set({ [CURRENT_FILTER_KEY]: '' });
        }
        // If it IS a saved filter, CURRENT_FILTER_KEY was already set when the chip was clicked
        loadAndDisplaySavedFilters();
      });
    } else {
      updateStatus('Failed to filter sprints', false);
    }

    // Update button states after action completes
    updateActionButtonStates();
  });
}

document.getElementById('filterBtn').addEventListener('click', applyFilter);

document.getElementById('closeBtn').addEventListener('click', () => {
  window.close();
});

document.getElementById('saveFilterBtn').addEventListener('click', async () => {
  const filterText = document.getElementById('filterInput').value.trim();
  const data = await chrome.storage.local.get(SAVED_FILTERS_KEY);
  const savedFilters = data[SAVED_FILTERS_KEY] || [];
  const isSaved = savedFilters.includes(filterText);

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

document.getElementById('filterInput').addEventListener('input', async () => {
  updateSaveButtonState();
  updateActionButtonStates();
});

document.getElementById('showAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('showAllBtn');
  const originalText = btn.textContent;

  // Show loading state with spinner and disable chips
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Showing...';
  disableFilterChips(true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'showAllSprints' }, (response) => {
    // Restore button state and re-enable chips
    btn.disabled = false;
    btn.textContent = originalText;
    disableFilterChips(false);

    if (response) {
      updateStatus(response.message, true);

      // Clear the filter input and saved filter
      document.getElementById('filterInput').value = '';
      document.getElementById('filterInput').disabled = false;
      chrome.storage.local.set({ [CURRENT_FILTER_KEY]: '' });
      updateSaveButtonState();

      // Refresh saved filters display to remove selected state
      loadAndDisplaySavedFilters();
    } else {
      updateStatus('Failed to show sprints', false);
    }

    // Update button states after action completes
    updateActionButtonStates();
  });
});

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

async function updateActionButtonStates(callback) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(
    tab.id,
    { action: 'getSprintState' },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        if (callback) callback();
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

      if (callback) callback();
    }
  );
}

// Check if URL matches supported page patterns
function isUrlSupported(url) {
  if (!url) return false;

  const patterns = [
    /^https:\/\/[^\/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^\/]+\/boards\/[^\/]+\/backlog/,
    /^https:\/\/[^\/]+\.atlassian\.net\/jira\/software\/[^\/]+\/projects\/[^\/]+\/boards\/[^\/]+\/backlog/,
    /^https:\/\/[^\/]+\.atlassian\.net\/jira\/software\/[^\/]+\/backlog/
  ];

  return patterns.some(pattern => pattern.test(url));
}

// Check if we're on a supported page when popup loads
async function checkSupportedPage(retries = 5, delay = 200) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
    debugLog(`Attempting to reach content script (${5 - retriesLeft + 1}/5)`);

    // Try to send a test message to see if content script is active
    chrome.tabs.sendMessage(
      tab.id,
      { action: 'checkPageSupport' },
      async (response) => {
        // If no response or error, retry or show error if out of retries
        if (chrome.runtime.lastError || !response) {
          debugLog(`No response:`, chrome.runtime.lastError?.message);
          if (retriesLeft > 0) {
            // Retry with a small delay
            debugLog(`Retrying in ${delay}ms...`);
            setTimeout(() => attemptCheck(retriesLeft - 1), delay);
          } else {
            // Out of retries, show error with more helpful message
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
          loadAndDisplaySavedFilters();
          await restoreFilterState();
          // Update button states based on current sprint state
          // Callback fires after state is loaded, popup is now ready
          updateActionButtonStates(() => {
            debugLog('Popup initialized and ready');
          });
        }
      }
    );
  };

  attemptCheck(retries);
}

// Initialize debug mode
loadDebugMode();

// Add triple-click handler to title for debug toggle
document.querySelector('h2').addEventListener('click', (e) => {
  if (e.detail === 3) {
    toggleDebugMode();
  }
});

// Run check when popup opens
checkSupportedPage();