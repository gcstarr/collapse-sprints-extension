// Debug logging helper
let debugModeEnabled = false;

function debugLog(...args) {
  if (debugModeEnabled) {
    console.log('[Sprint Collapser]', ...args);
  }
}

// Guard chrome API calls so this module can be imported in tests
if (typeof chrome !== 'undefined' && chrome.storage) {
  // Load debug mode from storage on script initialization
  chrome.storage.local.get('debugMode', (data) => {
    debugModeEnabled = data.debugMode || false;
    debugLog('Content script loaded, debug mode:', debugModeEnabled);
    debugLog('Content script loaded and ready!');
  });

  // Listen for debug mode changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.debugMode) {
      debugModeEnabled = changes.debugMode.newValue;
      // Always log debug mode changes so user can see the change
      console.log('[Sprint Collapser] Debug mode changed to:', debugModeEnabled);
    }
  });
}

// Helper to check if a sprint is filtered (hidden) by the current filter
function isSprintFiltered(button) {
  const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
  const outerContainer = innerContainer?.parentElement;
  return outerContainer?.getAttribute('data-filtered-hidden') === 'true';
}

// Function to find all sprint toggle buttons
function findSprintToggleButtons() {
  // Look for the specific sprint toggle elements by their data-testid
  // NOTE: This selector depends on Jira's internal test IDs which can change on updates.
  const toggleButtons = document.querySelectorAll(
    'div[role="button"][data-testid="software-backlog.card-list.left-side"]'
  );

  debugLog(`Found ${toggleButtons.length} sprint toggle buttons`);

  return Array.from(toggleButtons);
}

// Function to collapse all sprints.
// onComplete(result) is called asynchronously after all batch clicks have been fired.
function collapseAllSprints(onComplete) {
  const buttons = findSprintToggleButtons();

  if (buttons.length === 0) {
    debugLog('No sprint headers found');
    const result = { success: false, message: 'No sprints found' };
    if (onComplete) onComplete(result);
    return;
  }

  let collapsedCount = 0;
  let buttonIndex = 0;

  const processBatch = () => {
    const batchSize = 10;
    const endIndex = Math.min(buttonIndex + batchSize, buttons.length);

    for (let i = buttonIndex; i < endIndex; i++) {
      const button = buttons[i];
      if (isSprintFiltered(button)) continue;

      if (button.getAttribute('aria-expanded') === 'true') {
        button.click();
        collapsedCount++;
      }
    }

    buttonIndex = endIndex;

    if (buttonIndex < buttons.length) {
      requestAnimationFrame(processBatch);
    } else {
      const result = {
        success: true,
        message: `Collapsed ${collapsedCount} sprint${collapsedCount !== 1 ? 's' : ''}`
      };
      debugLog(`Collapsed ${collapsedCount} sprints`);
      if (onComplete) onComplete(result);
    }
  };

  requestAnimationFrame(processBatch);
}

// Function to expand all sprints.
// onComplete(result) is called asynchronously after all batch clicks have been fired.
function expandAllSprints(onComplete) {
  const buttons = findSprintToggleButtons();

  if (buttons.length === 0) {
    debugLog('No sprint headers found');
    const result = { success: false, message: 'No sprints found' };
    if (onComplete) onComplete(result);
    return;
  }

  let expandedCount = 0;
  let buttonIndex = 0;

  const processBatch = () => {
    const batchSize = 10;
    const endIndex = Math.min(buttonIndex + batchSize, buttons.length);

    for (let i = buttonIndex; i < endIndex; i++) {
      const button = buttons[i];
      if (isSprintFiltered(button)) continue;

      if (button.getAttribute('aria-expanded') === 'false') {
        button.click();
        expandedCount++;
      }
    }

    buttonIndex = endIndex;

    if (buttonIndex < buttons.length) {
      requestAnimationFrame(processBatch);
    } else {
      const result = {
        success: true,
        message: `Expanded ${expandedCount} sprint${expandedCount !== 1 ? 's' : ''}`
      };
      debugLog(`Expanded ${expandedCount} sprints`);
      if (onComplete) onComplete(result);
    }
  };

  requestAnimationFrame(processBatch);
}

// Function to filter sprints by name
function filterSprints(filterText) {
  if (!filterText) {
    return { success: false, message: 'No filter text provided' };
  }

  const toggleButtons = findSprintToggleButtons();

  if (toggleButtons.length === 0) {
    return { success: false, message: 'No sprints found' };
  }

  let hiddenCount = 0;
  let shownCount = 0;

  toggleButtons.forEach((button) => {
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    if (!innerContainer) return;

    const outerContainer = innerContainer.parentElement;
    if (!outerContainer) return;

    // NOTE: This relies on Jira rendering sprint names in an h2 element.
    const sprintNameElement = innerContainer.querySelector('h2');
    const sprintName = sprintNameElement ? sprintNameElement.textContent : '';

    const matches = sprintName.toLowerCase().includes(filterText.toLowerCase());

    if (matches) {
      outerContainer.style.display = '';
      outerContainer.removeAttribute('data-filtered-hidden');

      const nextSibling = outerContainer.nextElementSibling;
      if (nextSibling && nextSibling.getAttribute('data-testid') === 'software-backlog.card-list.divider.container') {
        nextSibling.style.display = '';
        nextSibling.removeAttribute('data-filtered-hidden');
      }

      const prevSibling = outerContainer.previousElementSibling;
      if (prevSibling && prevSibling.getAttribute('data-testid') === 'software-backlog.card-list.divider.container') {
        prevSibling.style.display = '';
        prevSibling.removeAttribute('data-filtered-hidden');
      }

      shownCount++;
    } else {
      outerContainer.style.display = 'none';
      outerContainer.setAttribute('data-filtered-hidden', 'true');

      const nextSibling = outerContainer.nextElementSibling;
      if (nextSibling && nextSibling.getAttribute('data-testid') === 'software-backlog.card-list.divider.container') {
        nextSibling.style.display = 'none';
        nextSibling.setAttribute('data-filtered-hidden', 'true');
      }

      const prevSibling = outerContainer.previousElementSibling;
      if (prevSibling && prevSibling.getAttribute('data-testid') === 'software-backlog.card-list.divider.container') {
        prevSibling.style.display = 'none';
        prevSibling.setAttribute('data-filtered-hidden', 'true');
      }

      hiddenCount++;
    }
  });

  debugLog(`Filter "${filterText}": Showing ${shownCount}, hiding ${hiddenCount}`);
  return {
    success: true,
    message: `Showing ${shownCount} sprint${shownCount !== 1 ? 's' : ''}, hiding ${hiddenCount}`
  };
}

// Function to show all sprints (remove filter)
function showAllSprints() {
  const toggleButtons = findSprintToggleButtons();

  if (toggleButtons.length === 0) {
    return { success: false, message: 'No sprints found' };
  }

  let restoredCount = 0;

  toggleButtons.forEach((button) => {
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    if (!innerContainer) return;

    const outerContainer = innerContainer.parentElement;
    if (!outerContainer) return;

    if (outerContainer.getAttribute('data-filtered-hidden') === 'true') {
      outerContainer.style.display = '';
      outerContainer.removeAttribute('data-filtered-hidden');

      const nextSibling = outerContainer.nextElementSibling;
      if (nextSibling && nextSibling.getAttribute('data-testid') === 'software-backlog.card-list.divider.container') {
        if (nextSibling.getAttribute('data-filtered-hidden') === 'true') {
          nextSibling.style.display = '';
          nextSibling.removeAttribute('data-filtered-hidden');
        }
      }

      const prevSibling = outerContainer.previousElementSibling;
      if (prevSibling && prevSibling.getAttribute('data-testid') === 'software-backlog.card-list.divider.container') {
        if (prevSibling.getAttribute('data-filtered-hidden') === 'true') {
          prevSibling.style.display = '';
          prevSibling.removeAttribute('data-filtered-hidden');
        }
      }

      restoredCount++;
    }
  });

  debugLog(`Restored ${restoredCount} hidden sprints`);
  return {
    success: true,
    message: `Showing all ${toggleButtons.length} sprints`
  };
}

// Function to check current sprint state
function getSprintState() {
  const buttons = findSprintToggleButtons();

  if (buttons.length === 0) {
    return { allCollapsed: false, allExpanded: false, anyFiltered: false };
  }

  let collapsedCount = 0;
  let expandedCount = 0;
  let unknownCount = 0;

  buttons.forEach((button) => {
    const ariaExpanded = button.getAttribute('aria-expanded');
    if (ariaExpanded === 'false') {
      collapsedCount++;
    } else if (ariaExpanded === 'true') {
      expandedCount++;
    } else {
      // Attribute is null or has unexpected value
      unknownCount++;
      debugLog('Button with unknown aria-expanded value:', ariaExpanded, button);
    }
  });

  debugLog(`State counts - Collapsed: ${collapsedCount}, Expanded: ${expandedCount}, Unknown: ${unknownCount}, Total: ${buttons.length}`);

  const anyFiltered = document.querySelector('[data-filtered-hidden="true"]') !== null;

  return {
    allCollapsed: collapsedCount === buttons.length && expandedCount === 0,
    allExpanded: expandedCount === buttons.length && collapsedCount === 0,
    anyFiltered: anyFiltered
  };
}

// Listen for messages from the popup
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      debugLog('Received message:', request.action);

      if (request.action === 'collapseAllSprints') {
        collapseAllSprints(sendResponse);
        return true; // Keep message channel open for async response
      } else if (request.action === 'expandAllSprints') {
        expandAllSprints(sendResponse);
        return true; // Keep message channel open for async response
      } else if (request.action === 'filterSprints') {
        sendResponse(filterSprints(request.filter));
      } else if (request.action === 'showAllSprints') {
        sendResponse(showAllSprints());
      } else if (request.action === 'checkPageSupport') {
        debugLog('Page support check - responding with supported: true');
        sendResponse({ supported: true });
      } else if (request.action === 'getSprintState') {
        const state = getSprintState();
        debugLog('Sprint state:', state);
        sendResponse(state);
      }
    } catch (error) {
      console.error('[Sprint Collapser] Error handling message:', error);
      sendResponse({ success: false, message: 'Error: ' + error.message });
    }
  });
}

// Export functions for unit testing (CommonJS)
if (typeof module !== 'undefined') {
  module.exports = {
    findSprintToggleButtons,
    collapseAllSprints,
    expandAllSprints,
    filterSprints,
    showAllSprints,
    getSprintState,
  };
}
