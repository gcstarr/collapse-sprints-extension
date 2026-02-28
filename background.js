// Default icon paths used to restore the icon when no filter is active
const DEFAULT_ICON_PATHS = {
  16: 'icons/icon-16.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png',
};

// Per-tab activity set.  A tab is "active" when we have confirmed or requested the
// backlog icon state (clearFilterIcon / setFilterIcon).  setGreyIcon removes the tab
// from the set and only applies the grey icon if the tab is still absent when the
// async pixel work completes — this prevents a slow-resolving setGreyIcon from
// overwriting a newer clearFilterIcon that arrived while the fetch was in flight.
const _activeTabIds = new Set();

// Draws a green circle badge in the bottom-right corner of the icon.
// The white ring behind it ensures contrast regardless of what the base icon looks like.
// Coordinates are defined on a 16-unit grid and scaled to `size`.
function drawFilterBadge(ctx, size) {
  const s = size / 16;
  const cx = 12.5 * s;
  const cy = 12.5 * s;
  const outerR = 3.5 * s;
  const innerR = 2.5 * s;

  // White ring (contrast border)
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
  ctx.fillStyle = 'white';
  ctx.fill();

  // Green fill
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
}

// Draws the base icon with a green corner badge and sets it as the action icon
// for the specified tab at 16px and 48px resolutions.
async function setFilterIcon(tabId) {
  _activeTabIds.add(tabId);

  const [bitmap16, bitmap48] = await Promise.all(
    [16, 48].map(async (size) => {
      const response = await fetch(chrome.runtime.getURL(`icons/icon-${size}.png`));
      const blob = await response.blob();
      return createImageBitmap(blob);
    })
  );

  if (!_activeTabIds.has(tabId)) return; // setGreyIcon was called while fetching

  const imageData = {};
  for (const [size, bitmap] of [[16, bitmap16], [48, bitmap48]]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);
    drawFilterBadge(ctx, size);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }

  chrome.action.setIcon({ imageData, tabId });
  chrome.action.setPopup({ popup: 'popup.html', tabId });
  chrome.action.setTitle({ title: '', tabId });
}

// Resets the action icon for the specified tab back to the default (colour) extension icon
// and re-enables the popup so the user can interact with it.
function clearFilterIcon(tabId) {
  _activeTabIds.add(tabId);
  chrome.action.setIcon({ path: DEFAULT_ICON_PATHS, tabId });
  chrome.action.setPopup({ popup: 'popup.html', tabId });
  chrome.action.setTitle({ title: '', tabId });
}

// Sets a greyscale version of the icon for tabs where the extension is not active
// (i.e. the current page is not a Jira backlog). Generated dynamically so no extra
// asset files are needed.
async function setGreyIcon(tabId) {
  _activeTabIds.delete(tabId);

  const [bitmap16, bitmap48] = await Promise.all(
    [16, 48].map(async (size) => {
      const response = await fetch(chrome.runtime.getURL(`icons/icon-${size}.png`));
      const blob = await response.blob();
      return createImageBitmap(blob);
    })
  );

  if (_activeTabIds.has(tabId)) return; // clearFilterIcon arrived while fetching

  const imageData = {};
  for (const [size, bitmap] of [[16, bitmap16], [48, bitmap48]]) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < data.data.length; i += 4) {
      // Luminosity-weighted greyscale conversion
      const grey = Math.round(data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114);
      data.data[i] = grey;
      data.data[i + 1] = grey;
      data.data[i + 2] = grey;
    }
    imageData[size] = data;
  }

  chrome.action.setIcon({ imageData, tabId });
  chrome.action.setPopup({ popup: 'disabled.html', tabId });
  chrome.action.setTitle({ title: 'Sprint Collapser – only available on Jira backlog pages', tabId });
}

// URL patterns that match Jira backlog pages — mirrors the content_scripts matches in manifest.json.
const BACKLOG_URL_PATTERNS = [
  /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
  /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/projects\/[^/]+\/boards\/[^/]+\/backlog/,
  /^https:\/\/[^/]+\.atlassian\.net\/jira\/software\/[^/]+\/backlog/,
];

function isBacklogUrl(url) {
  return url && BACKLOG_URL_PATTERNS.some(p => p.test(url));
}

// Keeps the icon and content script in sync as the user navigates.
// The manifest injects content.js on full page loads matching the backlog URL, but SPA
// navigations (e.g. Jira board → backlog tab) don't trigger manifest injection.  This
// listener handles those cases by injecting content.js directly via chrome.scripting.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Use the explicit new URL on navigation events; fall back to tab.url on page-load
  // events (refresh). tab.url is populated for atlassian.net tabs via our host permissions
  // even without the broad `tabs` permission.
  const url = changeInfo.url ?? (changeInfo.status === 'loading' ? tab.url : null);

  // Diagnostic: log every event touching an atlassian.net URL so we can see what
  // Chrome reports during navigation. Remove once root cause is confirmed.
  if (url && url.includes('atlassian')) {
    console.log('[SC-BG] onUpdated tab', tabId, '| url=', url.replace(/^https:\/\/[^/]+/, ''), '| ci.url=', !!changeInfo.url, '| ci.status=', changeInfo.status);
  }

  if (!url) {
    // URL is invisible (non-atlassian page or new tab — outside our host permissions).
    // On page-load events, default to grey; backlog pages self-correct via content.js.
    if (changeInfo.status === 'loading') setGreyIcon(tabId);

    // Inject content.js when a backlog page finishes loading. The manifest's
    // content_scripts are unreliable when Jira navigates through a rapid redirect chain
    // (each step fires status=loading but the manifest may not inject at document_idle).
    // status=complete fires once the page is fully settled; tab.url reflects the final URL.
    // The window.__sprintCollapserInited guard in content.js prevents double-init.
    if (changeInfo.status === 'complete' && isBacklogUrl(tab.url)) {
      console.log('[SC-BG] status=complete on backlog URL — injecting content.js');
      chrome.scripting.executeScript(
        { target: { tabId }, files: ['content.js'] },
        () => {
          if (chrome.runtime.lastError) {
            console.log('[SC-BG] executeScript (complete) error:', chrome.runtime.lastError.message);
          } else {
            console.log('[SC-BG] executeScript (complete) succeeded');
          }
        }
      );
    }
    return;
  }

  if (!isBacklogUrl(url)) {
    // For SPA navigation events (url changed, no status), skip setGreyIcon — Jira's
    // router can fire intermediate non-backlog URLs before settling on the final URL,
    // and the content script's URL poller handles SPA "leaving backlog" transitions.
    // For full page loads (status set alongside url) and refreshes (status-only, no url
    // change), the content script can't run so we update the icon here.
    if (changeInfo.url && !changeInfo.status) return;
    setGreyIcon(tabId);
    return;
  }

  // Full page loads to a backlog URL: eagerly update the icon so it turns blue as soon
  // as Chrome reports the URL, without waiting for content.js to send a message.
  // Content.js also sends clearFilterIcon when it initialises (belt-and-suspenders).
  if (changeInfo.status === 'loading') {
    clearFilterIcon(tabId);
    return;
  }
  if (changeInfo.status) return; // e.g. 'complete' — nothing more to do

  // SPA navigation to a backlog URL: eagerly update the icon and inject content.js.
  // clearFilterIcon marks the tab active (cancels any in-flight setGreyIcon) and turns
  // the icon blue immediately without waiting for content.js to send a message.
  console.log('[SC-BG] SPA nav to backlog — injecting content.js');
  clearFilterIcon(tabId);

  // Inject content.js directly — the MV3 service worker can go to sleep between
  // sendMessage and its callback, making the check-then-inject pattern unreliable.
  // The window.__sprintCollapserInited guard in content.js prevents double-init if
  // it's already running (its URL poller handles re-application in that case).
  chrome.scripting.executeScript(
    { target: { tabId }, files: ['content.js'] },
    () => {
      if (chrome.runtime.lastError) {
        console.log('[SC-BG] executeScript error:', chrome.runtime.lastError.message);
      } else {
        console.log('[SC-BG] executeScript succeeded');
      }
    }
  );
});

// Grey out the icon when the user switches to a tab that isn't a backlog page.
// tab.url is only populated for URLs matching our host permissions (backlog URLs),
// so an absent or non-matching URL means the tab is not a supported page.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    // Skip if the tab navigated to a backlog page between the onActivated event and this
    // async callback — trust the active state already set by clearFilterIcon/setFilterIcon.
    if (_activeTabIds.has(tabId)) return;
    if (!isBacklogUrl(tab.url)) setGreyIcon(tabId);
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  // Messages from the popup include an explicit tabId; messages from content
  // scripts use the sender's tab id.
  const tabId = message.tabId ?? sender.tab?.id;
  if (!tabId) return;

  if (message.action === 'setFilterIcon') {
    setFilterIcon(tabId);
  } else if (message.action === 'clearFilterIcon') {
    clearFilterIcon(tabId);
  } else if (message.action === 'setGreyIcon') {
    setGreyIcon(tabId);
  }
});
