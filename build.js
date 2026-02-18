#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

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

// Create versioned filename
const filename = `SprintCollapser_v${version}.zip`;

// Remove old archive if it exists
if (fs.existsSync(filename)) {
  fs.unlinkSync(filename);
  console.log(`Removed existing ${filename}`);
}

// Create the zip archive
const files = [
  'manifest.json',
  'content.js',
  'popup.html',
  'popup.js',
  'styles.css',
  'icons/',
  'README.md',
  'LICENSE'
];

// Only need to exclude .DS_Store since icons/ is added recursively
const command = `zip -r ${filename} ${files.join(' ')} -x '*.DS_Store'`;

try {
  execSync(command, { stdio: 'inherit' });
  console.log(`\n✓ Created ${filename} successfully!`);
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
