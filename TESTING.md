# Sprint Collapser - Testing Guide

## Running Tests

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage
```

## Test Structure

Tests are located in `__tests__/` directory:

- `content.test.js` - Tests for content script functions (sprint manipulation, filtering)
- `popup.test.js` - Tests for popup script functions (filter saving, button state management)

## Test Coverage

### Content Script Tests (`content.test.js`)

1. **findSprintToggleButtons**
   - Finds all sprint toggle button elements
   - Returns empty array when no sprints exist

2. **collapseAllSprints**
   - Collapses all expanded sprints
   - Returns appropriate message with count
   - **[REGRESSION]** Skips filtered sprints (fixed divider visibility issue)

3. **expandAllSprints**
   - Expands all collapsed sprints
   - Returns appropriate message with count
   - **[REGRESSION]** Skips filtered sprints (no dividers shown for hidden sprints)
   - **[REGRESSION]** Doesn't show dividers for filtered sprints when expanding

4. **getSprintState**
   - Detects when all sprints are collapsed
   - Detects when all sprints are expanded
   - Detects mixed sprint states
   - Detects when sprints are filtered
   - **[REGRESSION]** Correctly identifies state with filtered sprints present

### Popup Script Tests (`popup.test.js`)

1. **Save Filter Button Visibility**
   - **[REGRESSION]** Button hidden when filter input is empty
   - **[REGRESSION]** Button visible when filter input has text
   - Toggles visibility with input changes

2. **Save Filter Functionality**
   - Saves new filters to storage
   - Prevents duplicate filters (toggles off)
   - Respects MAX_SAVED_FILTERS limit (10 filters)
   - Removes filters when requested

3. **Button Disabled States**
   - **[REGRESSION]** Hide Non-Matching disabled when filter is empty
   - **[REGRESSION]** Collapse All disabled when all sprints collapsed
   - **[REGRESSION]** Expand All disabled when all sprints expanded
   - **[REGRESSION]** Show All disabled when no sprints filtered

4. **Filter Input Disabled State**
   - **[REGRESSION]** Filter input disabled on unsupported pages
   - **[REGRESSION]** Filter input enabled on supported pages

5. **Saved Filters Display**
   - Displays saved filters as clickable chips
   - Doesn't show container when empty
   - Allows clicking saved filter to apply it

6. **Color Palette**
   - **[REGRESSION]** Disabled buttons use distinct grey (#b3b3b3)
   - **[REGRESSION]** Enabled primary buttons use blue (#0052cc)
   - **[REGRESSION]** Enabled secondary buttons use cyan (#0099cc)

## Regression Tests

These tests specifically verify fixes for reported issues:

1. **Filtered Sprints Divider Issue** - When expanding all with active filters, dividers for hidden sprints would show. Fixed by skipping expand/collapse for filtered sprints.

2. **Save Button Visibility** - Save star button confusing when no text entered. Fixed by hiding button when input is empty.

3. **Button Disabled Color Palette** - Subdued colors made disabled buttons hard to distinguish. Fixed by using explicit grey color (#b3b3b3) for disabled state.

4. **Hide Non-Matching Button State** - Not disabled when filter was empty. Fixed by checking filter input value.

5. **Unsupported Page Handling** - Filter input and save button now properly disabled on unsupported pages.

## Notes for Chrome Store Submission

Remember to exclude from `archive.zip`:
- `__tests__/` directory
- `package.json`
- `node_modules/` (if added)
- `.gitignore`
- `TESTING.md`

Only include production files in the archive.
