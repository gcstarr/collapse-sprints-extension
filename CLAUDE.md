# Sprint Collapser - Chrome Extension

Chrome MV3 extension for Jira Cloud board backlogs. Adds collapse/expand/filter controls for sprints when multiple teams share a board.

## Key Files
- `manifest.json` - source of truth for version number
- `content.js` - content script injected into Jira backlog pages
- `popup.js` / `popup.html` / `styles.css` - extension popup UI
- `build.js` - creates `SprintCollapser_vX.Y.Z.zip` for Chrome Web Store submission (syncs package.json version from manifest.json)
- `tests/content.test.js`, `tests/popup.test.js` - Jest tests

## Architecture
- No bundler — `content.js` and `popup.js` are loaded directly by Chrome. For development, just load the folder in `chrome://extensions/` (no build step needed).
- `popup.js` communicates with `content.js` via `chrome.tabs.sendMessage` / `chrome.runtime.onMessage`. All sprint DOM manipulation happens in `content.js`; popup only sends commands.
- Tests mock `chrome.storage` and `chrome.tabs` — do not add real Chrome API dependencies to tests.

## Commands

- `npm test` - run Jest tests (jsdom environment)
- `npm run lint` - ESLint
- `npm run build` - create production zip

## Git / GitHub
- Remote uses custom SSH host alias: `git@github.com-personal:gcstarr/collapse-sprints-extension.git`
- GPG signing is required — use `git commit -S` or set `git config --global commit.gpgSign true`
- GPG key fingerprint: `9A3488847B1B8D1F8E4B83B231B37CDC171B20C1` (gcstarr@gmail.com)
- Branch protection on `main` requires signed commits
- `main` branch may need upstream set: `git branch --set-upstream-to=origin/main main`
