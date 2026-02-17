// Constants
const SAVED_FILTERS_KEY = 'savedFilters';
const MAX_SAVED_FILTERS = 10;

// Load and display saved filters
async function loadAndDisplaySavedFilters() {
  const data = await chrome.storage.local.get(SAVED_FILTERS_KEY);
  const savedFilters = data[SAVED_FILTERS_KEY] || [];
  displaySavedFilters(savedFilters);
}

function displaySavedFilters(savedFilters) {
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

    const text = document.createElement('span');
    text.textContent = filter;
    text.style.marginRight = '2px';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'filter-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeSavedFilter(filter);
    });

    chip.appendChild(text);
    chip.appendChild(removeBtn);

    chip.addEventListener('click', () => {
      applyFilterDirect(filter);
    });

    container.appendChild(chip);
  });
}

async function removeSavedFilter(filterText) {
  const data = await chrome.storage.local.get(SAVED_FILTERS_KEY);
  let savedFilters = data[SAVED_FILTERS_KEY] || [];
  savedFilters = savedFilters.filter((f) => f !== filterText);
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

  // Show loading state
  btn.disabled = true;
  btn.textContent = 'Collapsing...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'collapseAllSprints' }, (response) => {
    // Restore button state
    btn.disabled = false;
    btn.textContent = originalText;

    if (response) {
      updateStatus(response.message, true);
    } else {
      updateStatus('Failed to collapse sprints', false);
    }
    
    // Update button states after action completes
    updateActionButtonStates();
  });
});

document.getElementById('expandBtn').addEventListener('click', async () => {
  const btn = document.getElementById('expandBtn');
  const originalText = btn.textContent;

  // Show loading state
  btn.disabled = true;
  btn.textContent = 'Expanding...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'expandAllSprints' }, (response) => {
    // Restore button state
    btn.disabled = false;
    btn.textContent = originalText;

    if (response) {
      updateStatus(response.message, true);
    } else {
      updateStatus('Failed to expand sprints', false);
    }
    
    // Update button states after action completes
    updateActionButtonStates();
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

  // Show loading state
  btn.disabled = true;
  btn.textContent = 'Filtering...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'filterSprints', filter: filterText }, (response) => {
    // Restore button state
    btn.disabled = false;
    btn.textContent = originalText;

    if (response) {
      updateStatus(response.message, response.success);
    } else {
      updateStatus('Failed to filter sprints', false);
    }
    
    // Update button states after action completes
    updateActionButtonStates();
  });
}

document.getElementById('filterBtn').addEventListener('click', applyFilter);

document.getElementById('saveFilterBtn').addEventListener('click', async () => {
  const filterText = document.getElementById('filterInput').value.trim();
  await saveFilter(filterText);
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

  // Show loading state
  btn.disabled = true;
  btn.textContent = 'Showing...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'showAllSprints' }, (response) => {
    // Restore button state
    btn.disabled = false;
    btn.textContent = originalText;

    if (response) {
      updateStatus(response.message, true);
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

async function updateActionButtonStates() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(
    tab.id,
    { action: 'getSprintState' },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        return; // Not on supported page
      }
      
      const filterInput = document.getElementById('filterInput');
      const hasFilter = filterInput.value.trim() !== '';
      
      // Disable Hide Non-Matching if no filter text
      document.getElementById('filterBtn').disabled = !hasFilter;
      
      // Disable Show All if no sprints are filtered
      document.getElementById('showAllBtn').disabled = !response.anyFiltered;
      
      // Disable Collapse All if all already collapsed
      document.getElementById('collapseBtn').disabled = response.allCollapsed;
      
      // Disable Expand All if all already expanded
      document.getElementById('expandBtn').disabled = response.allExpanded;
    }
  );
}

// Check if we're on a supported page when popup loads
async function checkSupportedPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Try to send a test message to see if content script is active
  chrome.tabs.sendMessage(
    tab.id,
    { action: 'checkPageSupport' },
    (response) => {
      // If no response or error, content script is not loaded (unsupported page)
      if (chrome.runtime.lastError || !response) {
        disableAllControls(true);
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'This extension only works on Jira Cloud board backlog pages. Please navigate to a Jira Cloud board backlog.';
        statusDiv.className = 'status-message error';
        statusDiv.style.marginTop = '16px';
      } else {
        // Load and display saved filters when on supported page
        loadAndDisplaySavedFilters();
        // Update button states based on current sprint state
        updateActionButtonStates();
      }
    }
  );
}

// Run check when popup opens
checkSupportedPage();