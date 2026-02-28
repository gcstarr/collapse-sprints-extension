// Debug logging helper
// var used intentionally: re-declaration is silently ignored if content.js is ever
// injected more than once into the same context, whereas let/const throw a SyntaxError.
var debugModeEnabled = false;

function debugLog(...args) {
  if (debugModeEnabled) {
    console.log('[Sprint Collapser]', ...args);
  }
}

// Guard chrome API calls so this module can be imported in tests.
// Use flags to prevent double-initialization if injected programmatically more than once
// (e.g., via chrome.scripting.executeScript as a fallback for SPA navigation).
if (typeof chrome !== 'undefined' && chrome.storage && !window.__sprintCollapserInited) {
  window.__sprintCollapserInited = true;
  console.log('[SC] content.js init on', window.location.href);
  // Immediately mark the icon active — we're confirmed on a backlog page.  Sending
  // clearFilterIcon here (before the async storage read) ensures the icon turns blue
  // right away on full page loads, rather than waiting for sprint elements to be found.
  chrome.runtime.sendMessage({ action: 'clearFilterIcon' });
  // Use the same URL-scoped key that popup.js writes so the filter persists across page loads.
  const _normalized = window.location.origin + window.location.pathname.replace(/\/$/, '');
  const _currentFilterKey = `currentFilter_${_normalized}`;
  // Load debug mode, current filter, and auto-apply-on-load setting from storage
  chrome.storage.local.get(['debugMode', _currentFilterKey, 'autoApplyOnLoad'], (data) => {
    debugModeEnabled = data.debugMode || false;
    debugLog('Content script loaded, debug mode:', debugModeEnabled);
    debugLog('Content script loaded and ready!');
    const autoApplyOnLoad = data.autoApplyOnLoad !== undefined ? data.autoApplyOnLoad : true;
    const currentFilter = data[_currentFilterKey];
    console.log('[SC] storage read: autoApplyOnLoad=', autoApplyOnLoad, 'filter=', currentFilter, 'key=', _currentFilterKey);
    if (autoApplyOnLoad && currentFilter) {
      debugLog('Restoring filter on page load:', currentFilter);
      waitForSprintsAndFilter(currentFilter);
    }
    // else: clearFilterIcon already sent above — nothing more to do
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

// Nudges the backlog scroll container by 1px and restores it to force virtual-list
// re-render. Jira's backlog cards are windowed; after hiding sprint containers with
// display:none the card virtual lists don't re-render until a scroll event fires on
// the correct scroll container (not window). The defer gives React time to process
// the display:none mutations before the scroll event triggers re-measurement.
function triggerVirtualListRefresh() {
  const container = document.querySelector('[data-testid="software-backlog.backlog-content.scrollable"]');
  if (!container) return;
  setTimeout(() => {
    const saved = container.scrollTop;
    container.scrollTop = saved + 1;
    requestAnimationFrame(() => { container.scrollTop = saved; });
  }, 50);
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
  let visibleCount = 0;

  // Only count visible (non-filtered) sprints for allCollapsed/allExpanded so that
  // collapse/expand buttons disable correctly when a filter is active.
  buttons.forEach((button) => {
    if (isSprintFiltered(button)) return;

    visibleCount++;
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

  debugLog(`State counts - Collapsed: ${collapsedCount}, Expanded: ${expandedCount}, Unknown: ${unknownCount}, Visible: ${visibleCount}, Total: ${buttons.length}`);

  const anyFiltered = document.querySelector('[data-filtered-hidden="true"]') !== null;

  return {
    allCollapsed: visibleCount > 0 && collapsedCount === visibleCount && expandedCount === 0,
    allExpanded: visibleCount > 0 && expandedCount === visibleCount && collapsedCount === 0,
    anyFiltered: anyFiltered
  };
}

// Waits for sprint toggle buttons to appear in the DOM, then applies the filter.
// Used on page load/refresh when Jira's SPA hasn't rendered sprints yet.
function waitForSprintsAndFilter(filterText) {
  console.log('[SC] waitForSprintsAndFilter called, filter=', filterText);
  const applyAndRefresh = () => {
    console.log('[SC] applyAndRefresh: buttons found=', findSprintToggleButtons().length);
    const result = filterSprints(filterText);
    console.log('[SC] filterSprints result=', result);
    // Notify the background to show the filter badge. Guarded for the test environment
    // where chrome is not defined.
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'setFilterIcon' });
    }
    // Jira mounts card virtual lists asynchronously after sprint buttons appear.
    // Retry the scroll nudge at increasing intervals so at least one fires after
    // those IntersectionObservers are set up.
    triggerVirtualListRefresh();
    setTimeout(() => triggerVirtualListRefresh(), 500);
    setTimeout(() => triggerVirtualListRefresh(), 1500);
  };

  const initialCount = findSprintToggleButtons().length;
  console.log('[SC] initial button count=', initialCount);
  if (initialCount > 0) {
    applyAndRefresh();
    return;
  }

  const observer = new MutationObserver(() => {
    if (findSprintToggleButtons().length > 0) {
      console.log('[SC] observer fired, buttons found');
      observer.disconnect();
      applyAndRefresh();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  // Safety valve: don't observe indefinitely if the page never renders sprints
  setTimeout(() => { console.log('[SC] observer timeout'); observer.disconnect(); }, 15000);
}

// Listen for messages from the popup
if (typeof chrome !== 'undefined' && chrome.runtime && !window.__sprintCollapserListening) {
  window.__sprintCollapserListening = true;

  // Poll window.location.href to detect SPA navigation.
  // Patching history.pushState in a content script only affects the isolated world —
  // it does NOT intercept calls made by the page's own JavaScript (e.g. Jira's router).
  // Polling is therefore the only reliable approach without requiring the `tabs` permission.
  const BACKLOG_PATTERNS = [
    /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
    /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
    /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/backlog/,
  ];

  let _pollPrevUrl = window.location.href;
  const _pollInterval = setInterval(() => {
    // Stop polling if the extension has been reloaded/updated — Chrome API calls on an
    // invalidated context throw "Extension context invalidated" errors.
    if (!chrome.runtime?.id) {
      clearInterval(_pollInterval);
      return;
    }
    const currentUrl = window.location.href;
    if (currentUrl === _pollPrevUrl) return;
    const wasBacklog = BACKLOG_PATTERNS.some(p => p.test(_pollPrevUrl));
    const isBacklog  = BACKLOG_PATTERNS.some(p => p.test(currentUrl));
    _pollPrevUrl = currentUrl;

    if (wasBacklog && !isBacklog) {
      // Left the backlog — grey out the icon.
      chrome.runtime.sendMessage({ action: 'setGreyIcon' });
    } else if (!wasBacklog && isBacklog) {
      // Arrived at the backlog via SPA navigation — re-apply stored filter if enabled.
      const normalized = window.location.origin + window.location.pathname.replace(/\/$/, '');
      const currentFilterKey = `currentFilter_${normalized}`;
      chrome.storage.local.get([currentFilterKey, 'autoApplyOnLoad'], (data) => {
        // Re-check: context may have been invalidated while the storage read was in flight.
        if (!chrome.runtime?.id) return;
        const autoApplyOnLoad = data.autoApplyOnLoad !== undefined ? data.autoApplyOnLoad : true;
        const currentFilter = data[currentFilterKey];
        if (autoApplyOnLoad && currentFilter) {
          debugLog('Re-applying filter after SPA navigation to backlog:', currentFilter);
          waitForSprintsAndFilter(currentFilter);
        } else {
          // No filter to apply — ensure the badge is cleared.
          chrome.runtime.sendMessage({ action: 'clearFilterIcon' });
        }
      });
    }
  }, 500);

  // Actions that call sendResponse asynchronously — listener must return true for these
  // to keep the message channel open.
  const asyncActions = new Set(['collapseAllSprints', 'expandAllSprints']);

  const messageHandlers = {
    collapseAllSprints: (_request, sendResponse) => { collapseAllSprints(sendResponse); },
    expandAllSprints:   (_request, sendResponse) => { expandAllSprints(sendResponse); },
    filterSprints:      (request, sendResponse)  => { const result = filterSprints(request.filter); triggerVirtualListRefresh(); sendResponse(result); },
    showAllSprints:     (_request, sendResponse) => { sendResponse(showAllSprints()); },
    checkPageSupport:   (_request, sendResponse) => {
      debugLog('Page support check - responding with supported: true');
      sendResponse({ supported: true });
    },
    getSprintState: (_request, sendResponse) => {
      const state = getSprintState();
      debugLog('Sprint state:', state);
      sendResponse(state);
    },
  };

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    debugLog('Received message:', request.action);
    const handler = messageHandlers[request.action];
    if (!handler) return;
    try {
      handler(request, sendResponse);
    } catch (error) {
      console.error('[Sprint Collapser] Error handling message:', error);
      sendResponse({ success: false, message: 'Error: ' + error.message });
    }
    return asyncActions.has(request.action);
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
    triggerVirtualListRefresh,
    waitForSprintsAndFilter,
  };
}
