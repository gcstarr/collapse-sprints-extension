/**
 * @jest-environment node
 *
 * Unit tests for build.js helper functions.
 * These ensure the file-collection logic stays correct as the extension evolves,
 * so a missing file (like background.js) causes a build failure rather than a
 * silent broken submission.
 */

const { collectFromManifest, collectFromHtml, toZipEntries } = require('../build.js');

// ---------------------------------------------------------------------------
// collectFromManifest
// ---------------------------------------------------------------------------

describe('collectFromManifest', () => {
  test('always includes manifest.json', () => {
    expect(collectFromManifest({})).toContain('manifest.json');
  });

  test('extracts values from every file-bearing field', () => {
    const result = collectFromManifest({
      background: { service_worker: 'sw.js' },
      content_scripts: [{ js: ['cs.js'], css: ['cs.css'] }],
      action: { default_popup: 'popup.html', default_icons: { 16: 'img/a.png' } },
      icons: { 128: 'img/b.png' },
    });
    expect(result).toContain('sw.js');
    expect(result).toContain('cs.js');
    expect(result).toContain('cs.css');
    expect(result).toContain('popup.html');
    expect(result).toContain('img/a.png');
    expect(result).toContain('img/b.png');
  });

  test('handles missing optional fields without throwing', () => {
    expect(() => collectFromManifest({})).not.toThrow();
    expect(() => collectFromManifest({ content_scripts: [{}] })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// collectFromHtml
// ---------------------------------------------------------------------------

describe('collectFromHtml', () => {
  test('extracts <script src>', () => {
    const result = collectFromHtml('<script src="popup.js"></script>');
    expect(result).toContain('popup.js');
  });

  test('extracts <link href>', () => {
    const result = collectFromHtml('<link rel="stylesheet" href="styles.css">');
    expect(result).toContain('styles.css');
  });

  test('extracts multiple scripts and links', () => {
    const html = `
      <link rel="stylesheet" href="styles.css">
      <link rel="icon" href="icons/icon-16.png">
      <script src="vendor.js"></script>
      <script src="popup.js"></script>
    `;
    const result = collectFromHtml(html);
    expect(result).toContain('styles.css');
    expect(result).toContain('icons/icon-16.png');
    expect(result).toContain('vendor.js');
    expect(result).toContain('popup.js');
  });

  test('ignores inline <script> tags with no src', () => {
    const result = collectFromHtml('<script>console.log("hi")</script>');
    expect([...result]).toHaveLength(0);
  });

  test('returns empty set when HTML has no external refs', () => {
    expect([...collectFromHtml('<html><body><p>Hello</p></body></html>')]).toHaveLength(0);
    expect([...collectFromHtml('')]).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// toZipEntries
// ---------------------------------------------------------------------------

describe('toZipEntries', () => {
  test('keeps root files as-is', () => {
    expect(toZipEntries(new Set(['manifest.json', 'background.js']))).toContain('manifest.json');
    expect(toZipEntries(new Set(['manifest.json', 'background.js']))).toContain('background.js');
  });

  test('collapses subdirectory files to top-level dir/', () => {
    const result = toZipEntries(new Set(['icons/icon-16.png', 'icons/icon-48.png']));
    expect(result).toContain('icons/');
    expect(result).not.toContain('icons/icon-16.png');
    expect(result).not.toContain('icons/icon-48.png');
  });

  test('deduplicates multiple files in the same directory', () => {
    const result = toZipEntries(new Set(['icons/icon-16.png', 'icons/icon-48.png', 'icons/icon-128.png']));
    expect(result.filter(f => f === 'icons/')).toHaveLength(1);
  });

  test('returns entries in sorted order', () => {
    const result = toZipEntries(new Set(['popup.js', 'background.js', 'manifest.json']));
    expect(result).toEqual(['background.js', 'manifest.json', 'popup.js']);
  });

  test('mixes root files and directories correctly', () => {
    const result = toZipEntries(new Set([
      'manifest.json',
      'background.js',
      'icons/icon-16.png',
      'icons/icon-48.png',
    ]));
    expect(result).toContain('manifest.json');
    expect(result).toContain('background.js');
    expect(result).toContain('icons/');
    expect(result).not.toContain('icons/icon-16.png');
  });
});
