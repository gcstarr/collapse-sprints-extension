// Function to find all sprint toggle buttons
function findSprintToggleButtons() {
  // Look for the specific sprint toggle elements by their data-testid
  const toggleButtons = document.querySelectorAll(
    'div[role="button"][data-testid="software-backlog.card-list.left-side"]'
  );

  console.log(`Found ${toggleButtons.length} sprint toggle buttons`);

  return Array.from(toggleButtons);
}

// Function to collapse all sprints
function collapseAllSprints() {
  const buttons = findSprintToggleButtons();
  
  if (buttons.length === 0) {
    console.log('No sprint headers found');
    return { success: false, message: 'No sprints found' };
  }
  
  // Click all buttons immediately without delay
  let collapsedCount = 0;
  buttons.forEach((button) => {
    // Check if the sprint is filtered (hidden)
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    const outerContainer = innerContainer?.parentElement;
    if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
      // Skip filtered sprints
      return;
    }

    // Check if the sprint is expanded
    const isExpanded = button.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      button.click();
      collapsedCount++;
    }
  });

  console.log(`Collapsed ${collapsedCount} sprints`);
  return { success: true, message: `Collapsed ${collapsedCount} sprint${collapsedCount !== 1 ? 's' : ''}` };
}

// Function to expand all sprints
function expandAllSprints() {
  const buttons = findSprintToggleButtons();

  if (buttons.length === 0) {filtered (hidden)
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    const outerContainer = innerContainer?.parentElement;
    if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
      // Skip filtered sprints
      return;
    }

    // Check if the sprint is 
    console.log('No sprint headers found');
    return { success: false, message: 'No sprints found' };
  }

  // Click all buttons immediately without delay
  let expandedCount = 0;
  buttons.forEach((button) => {
    // Check if the sprint is collapsed
    const isCollapsed = button.getAttribute('aria-expanded') === 'false';

    if (isCollapsed) {
      button.click();
      expandedCount++;
    }
  });

  console.log(`Expanded ${expandedCount} sprints`);
  return { success: true, message: `Expanded ${expandedCount} sprint${expandedCount !== 1 ? 's' : ''}` };
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

  console.log(`Filter "${filterText}": Showing ${shownCount}, hiding ${hiddenCount}`);
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

  console.log(`Restored ${restoredCount} hidden sprints`);
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
  
  buttons.forEach((button) => {
    if (button.getAttribute('aria-expanded') === 'false') {
      collapsedCount++;
    } else {
      expandedCount++;
    }
  });
  
  // Check if any sprints are filtered (hidden)
  const anyFiltered = document.querySelector('[data-filtered-hidden="true"]') !== null;
  
  return {
    allCollapsed: collapsedCount === buttons.length && expandedCount === 0,
    allExpanded: expandedCount === buttons.length && collapsedCount === 0,
    anyFiltered: anyFiltered
  };
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'collapseAllSprints') {
    const result = collapseAllSprints();
    sendResponse(result);
  } else if (request.action === 'expandAllSprints') {
    const result = expandAllSprints();
    sendResponse(result);
  } else if (request.action === 'filterSprints') {
    const result = filterSprints(request.filter);
    sendResponse(result);
  } else if (request.action === 'showAllSprints') {
    const result = showAllSprints();
    sendResponse(result);
  } else if (request.action === 'checkPageSupport') {
    sendResponse({ supported: true });
  } else if (request.action === 'getSprintState') {
    const state = getSprintState();
    sendResponse(state);
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