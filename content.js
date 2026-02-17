// Debug logging helper
let debugModeEnabled = false;

// Load debug mode from storage
chrome.storage.local.get('debugMode', (data) => {
  debugModeEnabled = data.debugMode || false;
  debugLog('Content script loaded, debug mode:', debugModeEnabled);
});

// Listen for debug mode changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.debugMode) {
    debugModeEnabled = changes.debugMode.newValue;
    // Always log debug mode changes (even when disabling) so user can see the change
    console.log('[Sprint Collapser] Debug mode changed to:', debugModeEnabled);
  }
});

function debugLog(...args) {
  if (debugModeEnabled) {
    console.log('[Sprint Collapser]', ...args);
  }
}

// Function to find all sprint toggle buttons
function findSprintToggleButtons() {
  // Look for the specific sprint toggle elements by their data-testid
  const toggleButtons = document.querySelectorAll(
    'div[role="button"][data-testid="software-backlog.card-list.left-side"]'
  );

  debugLog(`Found ${toggleButtons.length} sprint toggle buttons`);

  return Array.from(toggleButtons);
}

// Function to collapse all sprints
function collapseAllSprints() {
  const buttons = findSprintToggleButtons();
  
  if (buttons.length === 0) {
    debugLog('No sprint headers found');
    return { success: false, message: 'No sprints found' };
  }
  
  // Count how many will be collapsed upfront (before batching starts)
  let willCollapseCount = 0;
  buttons.forEach((button) => {
    // Check if the sprint is filtered (hidden)
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    const outerContainer = innerContainer?.parentElement;
    if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
      return;
    }

    // Check if the sprint is expanded
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    if (isExpanded) {
      willCollapseCount++;
    }
  });

  // Batch clicks using requestAnimationFrame for better performance
  let buttonIndex = 0;
  
  const processBatch = () => {
    // Process up to 10 buttons per frame
    const batchSize = 10;
    const endIndex = Math.min(buttonIndex + batchSize, buttons.length);
    
    for (let i = buttonIndex; i < endIndex; i++) {
      const button = buttons[i];
      
      // Check if the sprint is filtered (hidden)
      const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
      const outerContainer = innerContainer?.parentElement;
      if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
        continue;
      }

      // Check if the sprint is expanded
      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      if (isExpanded) {
        button.click();
      }
    }
    
    buttonIndex = endIndex;
    
    // Process more buttons if any remain
    if (buttonIndex < buttons.length) {
      requestAnimationFrame(processBatch);
    }
  };
  
  // Start batching
  requestAnimationFrame(processBatch);

  debugLog(`Collapsed ${willCollapseCount} sprints`);
  return { success: true, message: `Collapsed ${willCollapseCount} sprint${willCollapseCount !== 1 ? 's' : ''}` };
}

// Function to expand all sprints
function expandAllSprints() {
  const buttons = findSprintToggleButtons();

  if (buttons.length === 0) {
    debugLog('No sprint headers found');
    return { success: false, message: 'No sprints found' };
  }

  // Count how many will be expanded upfront (before batching starts)
  let willExpandCount = 0;
  buttons.forEach((button) => {
    // Check if the sprint is filtered (hidden)
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    const outerContainer = innerContainer?.parentElement;
    if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
      return;
    }

    // Check if the sprint is collapsed
    const isCollapsed = button.getAttribute('aria-expanded') === 'false';
    if (isCollapsed) {
      willExpandCount++;
    }
  });

  // Batch clicks using requestAnimationFrame for better performance
  let buttonIndex = 0;
  
  const processBatch = () => {
    // Process up to 10 buttons per frame
    const batchSize = 10;
    const endIndex = Math.min(buttonIndex + batchSize, buttons.length);
    
    for (let i = buttonIndex; i < endIndex; i++) {
      const button = buttons[i];
      
      // Check if the sprint is filtered (hidden)
      const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
      const outerContainer = innerContainer?.parentElement;
      if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
        continue;
      }

      // Check if the sprint is collapsed
      const isCollapsed = button.getAttribute('aria-expanded') === 'false';

      if (isCollapsed) {
        button.click();
      }
    }
    
    buttonIndex = endIndex;
    
    // Process more buttons if any remain
    if (buttonIndex < buttons.length) {
      requestAnimationFrame(processBatch);
    }
  };
  
  // Start batching
  requestAnimationFrame(processBatch);

  debugLog(`Expanded ${willExpandCount} sprints`);
  return { success: true, message: `Expanded ${willExpandCount} sprint${willExpandCount !== 1 ? 's' : ''}` };
}



// Function to filter sprints by name
function filterSprints(filterText) {
  // Find all sprint containers (the parent of the toggle button)
  const toggleButtons = findSprintToggleButtons();

  if (toggleButtons.length === 0) {
    return { success: false, message: 'No sprints found' };
  }

  let hiddenCount = 0;
  let shownCount = 0;

  toggleButtons.forEach((button) => {
    // Find the sprint container (go up to the root sprint element)
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    if (!innerContainer) return;

    // Find the outer container (the one with the testid)
    const outerContainer = innerContainer.parentElement;
    if (!outerContainer) return;

    // Find the sprint name within the container
    const sprintNameElement = innerContainer.querySelector('h2');
    const sprintName = sprintNameElement ? sprintNameElement.textContent : '';

    // Check if sprint name matches the filter (case-insensitive)
    const matches = sprintName.toLowerCase().includes(filterText.toLowerCase());

    if (matches) {
      // Show this sprint
      outerContainer.style.display = '';
      outerContainer.removeAttribute('data-filtered-hidden');

      // Show associated dividers (both before and after)
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
      // Hide this sprint
      outerContainer.style.display = 'none';
      outerContainer.setAttribute('data-filtered-hidden', 'true');

      // Hide associated dividers (both before and after)
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

      // Restore associated dividers (both before and after)
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

  // Check if any sprints are filtered (hidden)
  const anyFiltered = document.querySelector('[data-filtered-hidden="true"]') !== null;

  return {
    allCollapsed: collapsedCount === buttons.length && expandedCount === 0,
    allExpanded: expandedCount === buttons.length && collapsedCount === 0,
    anyFiltered: anyFiltered
  };
}

// Content script is loaded
debugLog('Content script loaded and ready!');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    debugLog('Received message:', request.action);
    
    if (request.action === 'collapseAllSprints') {
      const result = collapseAllSprints();
      debugLog('Collapse result:', result);
      sendResponse(result);
    } else if (request.action === 'expandAllSprints') {
      const result = expandAllSprints();
      debugLog('Expand result:', result);
      sendResponse(result);
    } else if (request.action === 'filterSprints') {
      const result = filterSprints(request.filter);
      debugLog('Filter result:', result);
      sendResponse(result);
    } else if (request.action === 'showAllSprints') {
      const result = showAllSprints();
      debugLog('Show all result:', result);
      sendResponse(result);
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

// Add a button to the page (optional: for direct access without popup)
function addPageButton() {
  const backlogTab = document.querySelector('[href*="backlog"]');
  if (backlogTab && !document.getElementById('collapse-all-button')) {
    const button = document.createElement('button');
    button.id = 'collapse-all-button';
    button.textContent = 'Collapse All Sprints';
    button.style.marginLeft = '10px';
    button.style.padding = '8px 12px';
    button.style.backgroundColor = '#0052cc';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    
    button.addEventListener('click', collapseAllSprints);
    
    // Try to append to the toolbar area
    const toolbar = document.querySelector('[role="toolbar"]') || 
                   document.querySelector('.toolbar') ||
                   document.querySelector('.aui-buttons');
    
    if (toolbar) {
      toolbar.appendChild(button);
    }
  }
}

// Run when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addPageButton);
} else {
  addPageButton();
}