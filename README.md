# Collapse All Sprints - Chrome Extension

A Chrome extension that adds "Collapse All" and "Expand All" buttons for Jira sprint backlogs.

## Installation Instructions

1. **Download the extension files**
   - Get the extension folder (all files should be together in one folder)

2. **Open Chrome Extensions page**
   - In Chrome, go to `chrome://extensions/`
   - Or click the three-dot menu → Extensions → Manage Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**
   - Click "Load unpacked" button
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

5. **Use the extension**
   - Navigate to any Jira backlog page (e.g., `https://yourcompany.atlassian.net/jira/software/.../backlog`)
   - Click the extension icon in your Chrome toolbar
   - Click "Collapse All Sprints" or "Expand All Sprints"

## Features

- ✅ Collapse all sprints with one click
- ✅ Expand all sprints with one click
- ✅ Fast performance (processes all sprints instantly)
- ✅ Clean, simple interface

## Troubleshooting

- **Extension icon doesn't appear**: Make sure you're on a Jira backlog page
- **Nothing happens when clicking buttons**: Check the browser console (F12) for any error messages
- **Extension doesn't load**: Ensure all files are in the same folder and you selected the correct folder

## Files Included

- `manifest.json` - Extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality
- `content.js` - Main extension logic
- `styles.css` - Popup styling
- `icons/` - Extension icons
- `README.md` - This file
