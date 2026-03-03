#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Walk all file references out of manifest.json
function collectFromManifest(manifest) {
  const files = new Set(['manifest.json']);
  if (manifest.background?.service_worker) files.add(manifest.background.service_worker);
  for (const cs of manifest.content_scripts ?? []) {
    for (const f of [...(cs.js ?? []), ...(cs.css ?? [])]) files.add(f);
  }
  if (manifest.action?.default_popup) files.add(manifest.action.default_popup);
  for (const p of Object.values(manifest.action?.default_icons ?? {})) files.add(p);
  for (const p of Object.values(manifest.icons ?? {})) files.add(p);
  return files;
}

// Scrape <script src> and <link href> from an HTML string
function collectFromHtml(html) {
  const files = new Set();
  for (const [, src] of html.matchAll(/<script[^>]+\bsrc="([^"]+)"/g)) files.add(src);
  for (const [, href] of html.matchAll(/<link[^>]+\bhref="([^"]+)"/g)) files.add(href);
  return files;
}

// Normalize collected file paths to sorted, deduplicated top-level zip entries.
// Root files are included as-is; files in subdirectories are collapsed to "dir/".
function toZipEntries(files) {
  const entries = new Set();
  for (const f of files) {
    const topLevel = f.split('/')[0];
    entries.add(topLevel === f ? f : topLevel + '/');
  }
  return [...entries].sort();
}

if (require.main === module) {
  // Read version from manifest.json (source of truth for extension version)
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const version = manifest.version;

  // Sync package.json version with manifest.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.version !== version) {
    console.log(`Updating package.json version from ${packageJson.version} to ${version}`);
    packageJson.version = version;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
  }

  // --- File collection ---

  const collectedFiles = collectFromManifest(manifest);

  // Auto-include all root .html files (covers popup.html, which background.js sets
  // dynamically via chrome.action.setPopup and isn't listed in manifest.json)
  for (const f of fs.readdirSync('.')) {
    if (path.extname(f) === '.html') {
      collectedFiles.add(f);
      for (const dep of collectFromHtml(fs.readFileSync(f, 'utf8'))) collectedFiles.add(dep);
    }
  }

  // Non-extension extras to bundle
  for (const f of ['README.md', 'LICENSE']) {
    if (fs.existsSync(f)) collectedFiles.add(f);
  }

  const zipEntries = toZipEntries(collectedFiles);

  // --- Validate everything exists before touching the zip ---

  const missing = zipEntries.filter(f => !fs.existsSync(f));
  if (missing.length > 0) {
    console.error('Build failed — missing files/directories:');
    for (const f of missing) console.error(`  ${f}`);
    process.exit(1);
  }

  // --- Build ---

  const filename = `SprintCollapser_v${version}.zip`;

  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
    console.log(`Removed existing ${filename}`);
  }

  console.log('Including:');
  for (const f of zipEntries) console.log(`  ${f}`);
  console.log();

  try {
    execFileSync('zip', ['-r', filename, ...zipEntries, '-x', '*.DS_Store'], { stdio: 'inherit' });
    console.log(`\n✓ Created ${filename} successfully!`);
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

module.exports = { collectFromManifest, collectFromHtml, toZipEntries };
