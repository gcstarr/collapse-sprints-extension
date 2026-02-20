/**
 * Unit tests for Sprint Collapser content script
 * Tests core sprint manipulation and state detection functions
 */

const {
  findSprintToggleButtons,
  collapseAllSprints,
  expandAllSprints,
  filterSprints,
  showAllSprints,
  getSprintState,
  triggerVirtualListRefresh,
  waitForSprintsAndFilter,
} = require('../content.js');

// Mock DOM helper for testing
function createSprintButton(id, ariaExpanded = null, isFiltered = false) {
  const outer = document.createElement('div');
  outer.setAttribute('data-filtered-hidden', isFiltered ? 'true' : 'false');

  const inner = document.createElement('div');
  inner.setAttribute('data-drop-target-for-element', 'true');

  const button = document.createElement('div');
  button.setAttribute('role', 'button');
  button.setAttribute('data-testid', 'software-backlog.card-list.left-side');
  if (ariaExpanded !== null) {
    button.setAttribute('aria-expanded', String(ariaExpanded));
  }
  button.id = id;

  const sprintName = document.createElement('h2');
  sprintName.textContent = id.replace('sprint-', 'Sprint ');

  inner.appendChild(button);
  inner.appendChild(sprintName);
  outer.appendChild(inner);
  document.body.appendChild(outer);

  return outer;
}

describe('Sprint Collapser Content Script', () => {

  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
    // Simulate Jira toggling aria-expanded on click
    jest.spyOn(HTMLElement.prototype, 'click').mockImplementation(function() {
      const current = this.getAttribute('aria-expanded');
      if (current === 'true') this.setAttribute('aria-expanded', 'false');
      else if (current === 'false') this.setAttribute('aria-expanded', 'true');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('findSprintToggleButtons', () => {
    test('should find all sprint toggle buttons', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', false);
      createSprintButton('sprint-3', true);

      const buttons = findSprintToggleButtons();
      expect(buttons).toHaveLength(3);
    });

    test('should return empty array when no sprints exist', () => {
      const buttons = findSprintToggleButtons();
      expect(buttons).toHaveLength(0);
    });
  });

  describe('collapseAllSprints', () => {
    test('should collapse all expanded sprints', (done) => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', true);

      collapseAllSprints((result) => {
        expect(result.success).toBe(true);
        expect(result.message).toBe('Collapsed 2 sprints');

        const buttons = findSprintToggleButtons();
        buttons.forEach(btn => {
          expect(btn.getAttribute('aria-expanded')).toBe('false');
        });
        done();
      });

      jest.runAllTimers();
    });

    test('should return count of 0 if all sprints already collapsed', (done) => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2', false);

      collapseAllSprints((result) => {
        expect(result.message).toBe('Collapsed 0 sprints');
        done();
      });

      jest.runAllTimers();
    });

    test('[REGRESSION] should skip filtered sprints when collapsing', (done) => {
      createSprintButton('sprint-1', true, false);  // visible, expanded
      createSprintButton('sprint-2', true, true);   // filtered/hidden, expanded

      collapseAllSprints((result) => {
        // Only 1 should collapse (the visible one)
        expect(result.message).toContain('Collapsed 1 sprint');

        const buttons = findSprintToggleButtons();
        // Visible sprint should be collapsed
        expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
        // Filtered sprint should remain unchanged
        expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
        done();
      });

      jest.runAllTimers();
    });

    test('should handle no sprints gracefully', (done) => {
      collapseAllSprints((result) => {
        expect(result.success).toBe(false);
        expect(result.message).toBe('No sprints found');
        done();
      });

      jest.runAllTimers();
    });
  });

  describe('expandAllSprints', () => {
    test('should expand all collapsed sprints', (done) => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2', false);

      expandAllSprints((result) => {
        expect(result.success).toBe(true);
        expect(result.message).toBe('Expanded 2 sprints');

        const buttons = findSprintToggleButtons();
        buttons.forEach(btn => {
          expect(btn.getAttribute('aria-expanded')).toBe('true');
        });
        done();
      });

      jest.runAllTimers();
    });

    test('[REGRESSION] should skip filtered sprints when expanding', (done) => {
      createSprintButton('sprint-1', false, false);  // visible, collapsed
      createSprintButton('sprint-2', false, true);   // filtered/hidden, collapsed

      expandAllSprints((result) => {
        // Only 1 should expand (the visible one)
        expect(result.message).toContain('Expanded 1 sprint');

        const buttons = findSprintToggleButtons();
        // Visible sprint should be expanded
        expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
        // Filtered sprint should remain collapsed
        expect(buttons[1].getAttribute('aria-expanded')).toBe('false');
        done();
      });

      jest.runAllTimers();
    });

    test('[REGRESSION] should not clear data-filtered-hidden for filtered sprints', (done) => {
      createSprintButton('sprint-1', false, false);
      const filteredSprint = createSprintButton('sprint-2', false, true);

      expandAllSprints(() => {
        // Filtered sprint should still be marked as filtered
        expect(filteredSprint.getAttribute('data-filtered-hidden')).toBe('true');
        done();
      });

      jest.runAllTimers();
    });

    test('should return count of 0 if all sprints already expanded', (done) => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', true);

      expandAllSprints((result) => {
        expect(result.message).toBe('Expanded 0 sprints');
        done();
      });

      jest.runAllTimers();
    });

    test('should handle no sprints gracefully', (done) => {
      expandAllSprints((result) => {
        expect(result.success).toBe(false);
        expect(result.message).toBe('No sprints found');
        done();
      });

      jest.runAllTimers();
    });
  });

  describe('filterSprints', () => {
    test('should hide sprints that do not match the filter', () => {
      createSprintButton('sprint-Team-A', true, false);
      createSprintButton('sprint-Team-B', true, false);

      // Sprint names are derived from ids: "Sprint Team-A", "Sprint Team-B"
      const result = filterSprints('Team-A');
      expect(result.success).toBe(true);

      const buttons = findSprintToggleButtons();
      const outerA = buttons[0].closest('div[data-drop-target-for-element="true"]').parentElement;
      const outerB = buttons[1].closest('div[data-drop-target-for-element="true"]').parentElement;

      expect(outerA.style.display).toBe('');
      expect(outerB.style.display).toBe('none');
      expect(outerB.getAttribute('data-filtered-hidden')).toBe('true');
    });

    test('should return error for empty filter text', () => {
      createSprintButton('sprint-1', true);

      const result = filterSprints('');
      expect(result.success).toBe(false);
      expect(result.message).toBe('No filter text provided');
    });

    test('should handle no sprints gracefully', () => {
      const result = filterSprints('anything');
      expect(result.success).toBe(false);
      expect(result.message).toBe('No sprints found');
    });
  });

  describe('showAllSprints', () => {
    test('should restore hidden sprints', () => {
      const outer = createSprintButton('sprint-1', true, true);
      outer.style.display = 'none';

      const result = showAllSprints();
      expect(result.success).toBe(true);
      expect(outer.style.display).toBe('');
      // showAllSprints removes the attribute entirely rather than setting it to 'false'
      expect(outer.getAttribute('data-filtered-hidden')).toBeNull();
    });

    test('should handle no sprints gracefully', () => {
      const result = showAllSprints();
      expect(result.success).toBe(false);
      expect(result.message).toBe('No sprints found');
    });
  });

  describe('getSprintState', () => {
    test('should detect when all sprints are collapsed', () => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2', false);

      const state = getSprintState();
      expect(state.allCollapsed).toBe(true);
      expect(state.allExpanded).toBe(false);
    });

    test('should detect when all sprints are expanded', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', true);

      const state = getSprintState();
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(true);
    });

    test('should detect mixed sprint states', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', false);

      const state = getSprintState();
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(false);
    });

    test('should detect when sprints are filtered', () => {
      createSprintButton('sprint-1', true, false);
      createSprintButton('sprint-2', true, true);  // filtered

      const state = getSprintState();
      expect(state.anyFiltered).toBe(true);
    });

    test('[REGRESSION] should correctly identify allExpanded state with filtered sprints', () => {
      createSprintButton('sprint-1', true, false);   // visible, expanded
      createSprintButton('sprint-2', false, true);   // filtered, collapsed

      const state = getSprintState();
      // Only visible sprints count: sprint-1 is expanded, so allExpanded = true.
      // The filtered sprint-2 is not considered for the allExpanded flag.
      expect(state.allExpanded).toBe(true);
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
    test('[REGRESSION] filtered sprints should not have data-filtered-hidden cleared by expandAllSprints', (done) => {
      createSprintButton('sprint-1', true, false);
      createSprintButton('sprint-2', true, true);  // filtered, expanded

      expandAllSprints(() => {
        const buttons = findSprintToggleButtons();
        const filteredButton = buttons[1];
        const outerContainer = filteredButton.closest('div[data-drop-target-for-element="true"]')?.parentElement;

        // Filtered sprint should still be marked filtered (divider should remain hidden)
        expect(outerContainer?.getAttribute('data-filtered-hidden')).toBe('true');
        done();
      });

      jest.runAllTimers();
    });

    test('[REGRESSION] button state reflects correct disabled status', () => {
      createSprintButton('sprint-1', false, false);
      createSprintButton('sprint-2', false, false);

      const state = getSprintState();

      // All collapsed: Collapse button should be disabled, Expand should be enabled
      expect(state.allCollapsed).toBe(true);
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] all sprints expanded state with only filtered sprints', () => {
      createSprintButton('sprint-1', true, true);  // Only filtered sprint, expanded
      createSprintButton('sprint-2', true, true);  // Only filtered sprint, expanded

      const state = getSprintState();

      // All visible sprints are expanded, but we have filtered sprints
      expect(state.anyFiltered).toBe(true);
      expect(findSprintToggleButtons()).toHaveLength(2);
    });
  });

  describe('triggerVirtualListRefresh', () => {
    function createScrollContainer() {
      const container = document.createElement('div');
      container.setAttribute('data-testid', 'software-backlog.backlog-content.scrollable');
      document.body.appendChild(container);
      return container;
    }

    test('should do nothing if scroll container is not in DOM', () => {
      expect(() => triggerVirtualListRefresh()).not.toThrow();
    });

    test('should nudge scrollTop of the scroll container by 1', () => {
      const container = createScrollContainer();
      container.scrollTop = 0;

      triggerVirtualListRefresh();
      jest.advanceTimersByTime(50);

      expect(container.scrollTop).toBe(1);
    });

    test('should restore original scrollTop after the nudge', () => {
      const container = createScrollContainer();
      container.scrollTop = 0;

      triggerVirtualListRefresh();
      // jest.runAllTimers() covers both the outer setTimeout(50ms) and the inner rAF,
      // which Jest fakes as a timer when using fake timers.
      jest.runAllTimers();

      expect(container.scrollTop).toBe(0);
    });
  });

  describe('waitForSprintsAndFilter', () => {
    // jest.spyOn restores automatically via the outer afterEach → jest.restoreAllMocks()
    function mockMutationObserver(impl) {
      return jest.spyOn(global, 'MutationObserver').mockImplementation(impl);
    }

    test('should apply filter immediately when sprint buttons already exist', () => {
      createSprintButton('sprint-Team-A', true, false);
      createSprintButton('sprint-Team-B', true, false);

      waitForSprintsAndFilter('Team-A');
      jest.runAllTimers();

      const buttons = findSprintToggleButtons();
      const outerA = buttons[0].closest('div[data-drop-target-for-element="true"]').parentElement;
      const outerB = buttons[1].closest('div[data-drop-target-for-element="true"]').parentElement;

      expect(outerA.getAttribute('data-filtered-hidden')).toBeNull();
      expect(outerB.getAttribute('data-filtered-hidden')).toBe('true');
    });

    test('should observe DOM and apply filter when buttons appear later', () => {
      let capturedCallback = null;
      const mockObserver = { observe: jest.fn(), disconnect: jest.fn() };
      mockMutationObserver(cb => { capturedCallback = cb; return mockObserver; });

      waitForSprintsAndFilter('Team-A');

      expect(mockObserver.observe).toHaveBeenCalledWith(
        document.body,
        expect.objectContaining({ childList: true, subtree: true })
      );

      // Simulate buttons appearing in DOM, then MutationObserver firing
      createSprintButton('sprint-Team-A', true, false);
      createSprintButton('sprint-Team-B', true, false);
      capturedCallback();
      jest.runAllTimers();

      const buttons = findSprintToggleButtons();
      const outerB = buttons[1].closest('div[data-drop-target-for-element="true"]').parentElement;
      expect(outerB.getAttribute('data-filtered-hidden')).toBe('true');
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    test('should not apply filter if observer fires before buttons appear', () => {
      let capturedCallback = null;
      const mockObserver = { observe: jest.fn(), disconnect: jest.fn() };
      mockMutationObserver(cb => { capturedCallback = cb; return mockObserver; });

      waitForSprintsAndFilter('Team-A');
      capturedCallback(); // Fire callback with no buttons in DOM yet

      // Guard in observer callback: no buttons found → keep observing, do not disconnect
      expect(mockObserver.disconnect).not.toHaveBeenCalled();
      expect(findSprintToggleButtons()).toHaveLength(0);
    });

    test('should disconnect observer after 15 seconds if no sprints appear', () => {
      const mockObserver = { observe: jest.fn(), disconnect: jest.fn() };
      mockMutationObserver(() => mockObserver);

      waitForSprintsAndFilter('Team-A');
      jest.advanceTimersByTime(15000);

      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('Sprint State Detection with Unknown Values', () => {
    test('[REGRESSION] should correctly count sprints with explicit true aria-expanded', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', true);

      const state = getSprintState();

      expect(state.allExpanded).toBe(true);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should correctly count sprints with explicit false aria-expanded', () => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2', false);

      const state = getSprintState();

      expect(state.allCollapsed).toBe(true);
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] should not count null aria-expanded as expanded', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2');  // No aria-expanded attribute

      const state = getSprintState();

      // Should not be "all expanded" because one has null
      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should not count null aria-expanded as collapsed', () => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2');  // No aria-expanded attribute

      const state = getSprintState();

      // Should not be "all collapsed" because one has null
      expect(state.allCollapsed).toBe(false);
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] should handle mixed states with unknown values', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', false);
      createSprintButton('sprint-3');

      const state = getSprintState();

      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should handle all unknown values gracefully', () => {
      createSprintButton('sprint-1');
      createSprintButton('sprint-2');

      const state = getSprintState();

      // None are explicitly expanded or collapsed
      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] should handle unexpected aria-expanded values', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2');
      findSprintToggleButtons()[1].setAttribute('aria-expanded', 'maybe');  // Invalid value

      const state = getSprintState();

      // Should not count 'maybe' as either expanded or collapsed
      expect(state.allExpanded).toBe(false);
      expect(state.allCollapsed).toBe(false);
    });

    test('[REGRESSION] Expand All button should be disabled only when ALL sprints are explicitly expanded', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', true);
      createSprintButton('sprint-3', true);

      const state = getSprintState();

      // All explicitly expanded - button should be disabled
      expect(state.allExpanded).toBe(true);
    });

    test('[REGRESSION] Expand All button should NOT be disabled when some sprints have unknown state', () => {
      createSprintButton('sprint-1', true);
      createSprintButton('sprint-2', true);
      createSprintButton('sprint-3');  // Unknown state

      const state = getSprintState();

      // Not all explicitly expanded - button should be enabled
      expect(state.allExpanded).toBe(false);
    });

    test('[REGRESSION] Collapse All button should be disabled only when ALL sprints are explicitly collapsed', () => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2', false);
      createSprintButton('sprint-3', false);

      const state = getSprintState();

      // All explicitly collapsed - button should be disabled
      expect(state.allCollapsed).toBe(true);
    });

    test('[REGRESSION] Collapse All button should NOT be disabled when some sprints have unknown state', () => {
      createSprintButton('sprint-1', false);
      createSprintButton('sprint-2', false);
      createSprintButton('sprint-3');  // Unknown state

      const state = getSprintState();

      // Not all explicitly collapsed - button should be enabled
      expect(state.allCollapsed).toBe(false);
    });
  });
});
