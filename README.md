# Sprint Collapser - Chrome Extension

A Chrome extension that adds sprint management tools for Jira Cloud board backlogs. Collapse, expand, and filter sprints with one click when multiple teams share a board.

## Installation Instructions

### The Easy Way
- Click `Add to Chrome` for the extension [at the Chrome Web Store](https://chromewebstore.google.com/detail/sprint-collapser/inecgmghjjoijgmhdjalefdlachblgni?authuser=0&hl=en).

### Manual Installation

1. **Download the extension files**
   - Clone or download this repository

2. **Open Chrome Extensions page**
   - In Chrome, go to `chrome://extensions/`
   - Or click the three-dot menu → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked" button
   - Select the `collapse-sprints-extension` folder
   - The extension should now appear in your extensions list

5. **Use the extension**
   - Navigate to a Jira Cloud board backlog page (e.g., `https://yourcompany.atlassian.net/jira/software/.../backlog`)
   - Click the extension icon in your Chrome toolbar to open the popup
   - Use any of the available controls

## Features

### Sprint Controls
- **Collapse All Sprints** - Collapse all expanded sprints at once
- **Expand All Sprints** - Expand all collapsed sprints at once

### Filter Sprints
- **Filter by name** - Hide sprints that don't match your search
- **Show All Sprints** - Restore hidden sprints
- **Save Favorite Filters** - Click the star to save frequently-used filters (up to 10)
- **One-click apply** - Click saved filters to instantly apply them
- **Local storage** - Saved filters persist across browser sessions

## How to Use

### Collapse/Expand Sprints
1. Click the extension icon
2. Click "Collapse All Sprints" or "Expand All Sprints"
3. Only visible sprints are affected — if a filter is active, hidden sprints are left unchanged

### Filter Sprints
1. Type a sprint name in the filter input (e.g., "Team A", "Backend")
2. Click "Hide Non-Matching" to hide sprints that don't match
3. Edit the input to re-enable "Hide Non-Matching" and apply a different filter without needing to show all sprints first
4. Click "Show All Sprints" to restore hidden sprints

### Save Filters
1. Type a sprint name in the filter input
2. Click the star (☆) button to save it
3. The star turns filled (★) when saved
4. Click saved filter chips below to apply them instantly
5. Click the × on a chip to remove it

### Debug Mode

For troubleshooting or development, you can enable verbose console logging:

1. Open the extension popup
2. **Triple-click** the "Sprint Collapser" title at the top
3. The title will turn red when debug mode is enabled
4. Check your browser console (F12) for detailed logs
5. Triple-click the title again to disable debug mode

**Note:** Debug mode persists across sessions and is stored locally. All logging is disabled by default in production use.

## Permissions

- **Active Tab**: Required to interact with the current Jira board
- **Storage**: Used to save your favorite filters locally (no data sent to servers)

## Development

### Running Tests
```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

See [TESTING.md](TESTING.md) for detailed testing information.

## Troubleshooting

- **"This extension only works on Jira Cloud board backlog pages"**: Navigate to a Jira board's backlog view. The URL should contain `/backlog`
- **Extension icon doesn't appear**: Reload the page or check you're on a supported Jira page
- **Collapse/Expand buttons are greyed out**: All visible sprints are already in that state
- **"Hide Non-Matching" button is greyed out**: The input is empty, or the filter you've typed is already the active filter — edit the input to re-enable it
- **Nothing happens when clicking buttons**: Check your browser console (F12) for errors

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.
