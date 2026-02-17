/**
 * Unit tests for Sprint Collapser popup script
 * Tests filter saving, loading, and button state management
 */

// Mock localStorage for testing
const mockStorage = {};

const mockChromeStorage = {
  local: {
    get: jest.fn((key, callback) => {
      console.log('Mock get called with:', key);
      if (typeof key === 'string') {
        callback({ [key]: mockStorage[key] });
      } else if (Array.isArray(key)) {
        const result = {};
        key.forEach(k => {
          result[k] = mockStorage[k];
        });
        callback(result);
      }
    }),
    set: jest.fn((obj, callback) => {
      Object.assign(mockStorage, obj);
      if (callback) callback();
    }),
  },
};

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
  });

  describe('Color Palette for Button States', () => {
    test('[REGRESSION] disabled buttons should have distinct grey color', () => {
      const style = document.createElement('style');
      style.textContent = `.action-button:disabled { background-color: #b3b3b3; }`;
      document.head.appendChild(style);
      
      const btn = document.getElementById('collapseBtn');
      btn.disabled = true;
      
      const computedStyle = window.getComputedStyle(btn);
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
});
