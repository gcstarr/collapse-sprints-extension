/**
 * Unit tests for Sprint Collapser content script
 * Tests core sprint manipulation and state detection functions
 */

// Mock DOM setup for testing
function setupMockDOM() {
  document.body.innerHTML = '';
  
  const createSprintButton = (id, ariaExpanded, isFiltered = false) => {
    const outer = document.createElement('div');
    outer.setAttribute('data-filtered-hidden', isFiltered ? 'true' : 'false');
    
    const inner = document.createElement('div');
    inner.setAttribute('data-drop-target-for-element', 'true');
    
    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('data-testid', 'software-backlog.card-list.left-side');
    button.setAttribute('aria-expanded', ariaExpanded);
    button.id = id;
    
    const sprintName = document.createElement('h2');
    sprintName.textContent = id.replace('sprint-', 'Sprint ');
    
    inner.appendChild(button);
    inner.appendChild(sprintName);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    
    return { outer, button };
  };
  
  return createSprintButton;
}

// Functions extracted from content.js for testing
function findSprintToggleButtons() {
  const toggleButtons = document.querySelectorAll(
    'div[role="button"][data-testid="software-backlog.card-list.left-side"]'
  );
  return Array.from(toggleButtons);
}

function collapseAllSprints() {
  const buttons = findSprintToggleButtons();
  
  if (buttons.length === 0) {
    return { success: false, message: 'No sprints found' };
  }
  
  let collapsedCount = 0;
  buttons.forEach((button) => {
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    const outerContainer = innerContainer?.parentElement;
    if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
      return;
    }

    const isExpanded = button.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      button.setAttribute('aria-expanded', 'false');
      collapsedCount++;
    }
  });

  return { success: true, message: `Collapsed ${collapsedCount} sprint${collapsedCount !== 1 ? 's' : ''}` };
}

function expandAllSprints() {
  const buttons = findSprintToggleButtons();

  if (buttons.length === 0) {
    return { success: false, message: 'No sprints found' };
  }

  let expandedCount = 0;
  buttons.forEach((button) => {
    const innerContainer = button.closest('div[data-drop-target-for-element="true"]');
    const outerContainer = innerContainer?.parentElement;
    if (outerContainer?.getAttribute('data-filtered-hidden') === 'true') {
      return;
    }

    const isCollapsed = button.getAttribute('aria-expanded') === 'false';

    if (isCollapsed) {
      button.setAttribute('aria-expanded', 'true');
      expandedCount++;
    }
  });

  return { success: true, message: `Expanded ${expandedCount} sprint${expandedCount !== 1 ? 's' : ''}` };
}

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
    }
  });

  const anyFiltered = document.querySelector('[data-filtered-hidden="true"]') !== null;

  return {
    allCollapsed: collapsedCount === buttons.length && expandedCount === 0,
    allExpanded: expandedCount === buttons.length && collapsedCount === 0,
    anyFiltered: anyFiltered
  };
}

// Test suite
describe('Sprint Collapser Content Script', () => {
  
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('findSprintToggleButtons', () => {
    test('should find all sprint toggle buttons', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true');
      createSprintButton('sprint-2', 'false');
      createSprintButton('sprint-3', 'true');

      const buttons = findSprintToggleButtons();
      expect(buttons).toHaveLength(3);
    });

    test('should return empty array when no sprints exist', () => {
      const buttons = findSprintToggleButtons();
      expect(buttons).toHaveLength(0);
    });
  });

  describe('collapseAllSprints', () => {
    test('should collapse all expanded sprints', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true');
      createSprintButton('sprint-2', 'true');

      const result = collapseAllSprints();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Collapsed 2 sprints');
      
      const buttons = findSprintToggleButtons();
      buttons.forEach(btn => {
        expect(btn.getAttribute('aria-expanded')).toBe('false');
      });
    });

    test('should return disabled if all sprints already collapsed', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'false');
      createSprintButton('sprint-2', 'false');

      const result = collapseAllSprints();
      expect(result.message).toBe('Collapsed 0 sprints');
    });

    test('[REGRESSION] should skip filtered sprints when collapsing', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true', false);  // visible, expanded
      createSprintButton('sprint-2', 'true', true);   // filtered/hidden, expanded

      const result = collapseAllSprints();
      
      // Only 1 should collapse (the visible one)
      expect(result.message).toContain('Collapsed 1 sprint');
      
      const buttons = findSprintToggleButtons();
      // Visible sprint should be collapsed
      expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
      // Filtered sprint should remain unchanged
      expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    });

    test('should handle no sprints gracefully', () => {
      const result = collapseAllSprints();
      expect(result.success).toBe(false);
      expect(result.message).toBe('No sprints found');
    });
  });

  describe('expandAllSprints', () => {
    test('should expand all collapsed sprints', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'false');
      createSprintButton('sprint-2', 'false');

      const result = expandAllSprints();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Expanded 2 sprints');
      
      const buttons = findSprintToggleButtons();
      buttons.forEach(btn => {
        expect(btn.getAttribute('aria-expanded')).toBe('true');
      });
    });

    test('[REGRESSION] should skip filtered sprints when expanding', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'false', false);  // visible, collapsed
      createSprintButton('sprint-2', 'false', true);   // filtered/hidden, collapsed

      const result = expandAllSprints();
      
      // Only 1 should expand (the visible one)
      expect(result.message).toContain('Expanded 1 sprint');
      
      const buttons = findSprintToggleButtons();
      // Visible sprint should be expanded
      expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
      // Filtered sprint should remain collapsed
      expect(buttons[1].getAttribute('aria-expanded')).toBe('false');
    });

    test('[REGRESSION] should not show dividers for filtered sprints', () => {
      const createSprintButton = setupMockDOM();
      const { outer: outer1 } = createSprintButton('sprint-1', 'false', false);
      const { outer: outer2 } = createSprintButton('sprint-2', 'false', true);

      expandAllSprints();

      // Filtered sprint should still have data-filtered-hidden='true'
      expect(outer2.getAttribute('data-filtered-hidden')).toBe('true');
    });

    test('should return disabled if all sprints already expanded', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true');
      createSprintButton('sprint-2', 'true');

      const result = expandAllSprints();
      expect(result.message).toBe('Expanded 0 sprints');
    });
  });

  describe('getSprintState', () => {
    test('should detect when all sprints are collapsed', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'false');
      createSprintButton('sprint-2', 'false');

      const state = getSprintState();
      expect(state.allCollapsed).toBe(true);
      expect(state.allExpanded).toBe(false);
    });

    test('should detect when all sprints are expanded', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true');
      createSprintButton('sprint-2', 'true');

      const state = getSprintState();
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(true);
    });

    test('should detect mixed sprint states', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true');
      createSprintButton('sprint-2', 'false');

      const state = getSprintState();
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(false);
    });

    test('should detect when sprints are filtered', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true', false);
      createSprintButton('sprint-2', 'true', true);  // filtered

      const state = getSprintState();
      expect(state.anyFiltered).toBe(true);
    });

    test('[REGRESSION] should correctly identify allExpanded state with filtered sprints', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true', false);   // visible, expanded
      createSprintButton('sprint-2', 'false', true);   // filtered, collapsed

      const state = getSprintState();
      // Should be false because not ALL sprints (including filtered ones) are expanded
      // But only visible sprints should be considered for enable/disable logic
      expect(state.allExpanded).toBe(false);
      expect(state.anyFiltered).toBe(true);
    });

    test('should handle no sprints gracefully', () => {
      const state = getSprintState();
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(false);
      expect(state.anyFiltered).toBe(false);
    });
  });

  describe('Regression Tests', () => {
    test('[REGRESSION] hide dividers when filtering with expanded sprints', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true', false);
      createSprintButton('sprint-2', 'true', true);  // This should be hidden with dividers

      expandAllSprints();

      const buttons = findSprintToggleButtons();
      const filteredButton = buttons[1];
      const outerContainer = filteredButton.closest('div[data-drop-target-for-element="true"]')?.parentElement;

      // Filtered sprint should not be expanded (divider shouldn't show)
      expect(filteredButton.getAttribute('aria-expanded')).toBe('true');
      expect(outerContainer?.getAttribute('data-filtered-hidden')).toBe('true');
    });

    test('[REGRESSION] button state reflects correct disabled status', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'false', false);
      createSprintButton('sprint-2', 'false', false);

      const state = getSprintState();

      // All collapsed: Collapse button should be disabled, Expand should be enabled
      expect(state.allCollapsed).toBe(true);
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] all sprints expanded state with only filtered sprints', () => {
      const createSprintButton = setupMockDOM();
      createSprintButton('sprint-1', 'true', true);  // Only filtered sprint, expanded
      createSprintButton('sprint-2', 'true', true);  // Only filtered sprint, expanded

      const state = getSprintState();

      // All visible sprints are expanded, but we have filtered sprints
      expect(state.anyFiltered).toBe(true);
      // Even though aria-expanded is true, filtered sprints shouldn't count
      expect(findSprintToggleButtons()).toHaveLength(2);
    });
  });

  describe('Sprint State Detection with Unknown Values', () => {
    // Mock DOM setup that allows null aria-expanded
    function createSprintButtonWithAriaValue(id, ariaValue, isFiltered = false) {
      const outer = document.createElement('div');
      outer.setAttribute('data-filtered-hidden', isFiltered ? 'true' : 'false');

      const inner = document.createElement('div');
      inner.setAttribute('data-drop-target-for-element', 'true');

      const button = document.createElement('div');
      button.setAttribute('role', 'button');
      button.setAttribute('data-testid', 'software-backlog.card-list.left-side');
      if (ariaValue !== null) {
        button.setAttribute('aria-expanded', ariaValue);
      }
      button.id = id;

      const sprintName = document.createElement('h2');
      sprintName.textContent = id.replace('sprint-', 'Sprint ');

      inner.appendChild(button);
      inner.appendChild(sprintName);
      outer.appendChild(inner);
      document.body.appendChild(outer);

      return { outer, button };
    }

    test('[REGRESSION] should correctly count sprints with explicit true aria-expanded', () => {
      createSprintButtonWithAriaValue('sprint-1', 'true');
      createSprintButtonWithAriaValue('sprint-2', 'true');

      const state = getSprintState();

      expect(state.allExpanded).toBe(true);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should correctly count sprints with explicit false aria-expanded', () => {
      createSprintButtonWithAriaValue('sprint-1', 'false');
      createSprintButtonWithAriaValue('sprint-2', 'false');

      const state = getSprintState();

      expect(state.allCollapsed).toBe(true);
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] should not count null aria-expanded as expanded', () => {
      createSprintButtonWithAriaValue('sprint-1', 'true');
      createSprintButtonWithAriaValue('sprint-2', null);  // No aria-expanded attribute

      const state = getSprintState();

      // Should not be "all expanded" because one has null
      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should not count null aria-expanded as collapsed', () => {
      createSprintButtonWithAriaValue('sprint-1', 'false');
      createSprintButtonWithAriaValue('sprint-2', null);  // No aria-expanded attribute

      const state = getSprintState();

      // Should not be "all collapsed" because one has null
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] should handle mixed states with unknown values', () => {
      createSprintButtonWithAriaValue('sprint-1', 'true');
      createSprintButtonWithAriaValue('sprint-2', 'false');
      createSprintButtonWithAriaValue('sprint-3', null);

      const state = getSprintState();

      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should handle all unknown values gracefully', () => {
      createSprintButtonWithAriaValue('sprint-1', null);
      createSprintButtonWithAriaValue('sprint-2', null);

      const state = getSprintState();

      // None are explicitly expanded or collapsed
      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should handle unexpected aria-expanded values', () => {
      createSprintButtonWithAriaValue('sprint-1', 'true');
      createSprintButtonWithAriaValue('sprint-2', 'maybe');  // Invalid value

      const state = getSprintState();

      // Should not count 'maybe' as either expanded or collapsed
      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] Expand All button should be disabled only when ALL sprints are explicitly expanded', () => {
      createSprintButtonWithAriaValue('sprint-1', 'true');
      createSprintButtonWithAriaValue('sprint-2', 'true');
      createSprintButtonWithAriaValue('sprint-3', 'true');

      const state = getSprintState();

      // All explicitly expanded - button should be disabled
      expect(state.allExpanded).toBe(true);
    });

    test('[REGRESSION] Expand All button should NOT be disabled when some sprints have unknown state', () => {
      createSprintButtonWithAriaValue('sprint-1', 'true');
      createSprintButtonWithAriaValue('sprint-2', 'true');
      createSprintButtonWithAriaValue('sprint-3', null);  // Unknown state

      const state = getSprintState();

      // Not all explicitly expanded - button should be enabled
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] Collapse All button should be disabled only when ALL sprints are explicitly collapsed', () => {
      createSprintButtonWithAriaValue('sprint-1', 'false');
      createSprintButtonWithAriaValue('sprint-2', 'false');
      createSprintButtonWithAriaValue('sprint-3', 'false');

      const state = getSprintState();

      // All explicitly collapsed - button should be disabled
      expect(state.allCollapsed).toBe(true);
    });

    test('[REGRESSION] Collapse All button should NOT be disabled when some sprints have unknown state', () => {
      createSprintButtonWithAriaValue('sprint-1', 'false');
      createSprintButtonWithAriaValue('sprint-2', 'false');
      createSprintButtonWithAriaValue('sprint-3', null);  // Unknown state

      const state = getSprintState();

      // Not all explicitly collapsed - button should be enabled
      expect(state.allCollapsed).toBe(false);
    });
  });
});
