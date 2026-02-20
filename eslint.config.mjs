import js from '@eslint/js';
import globals from 'globals';

export default [
  // Base: recommended rules for all files
  js.configs.recommended,

  // Extension source files (browser + Chrome extension environment)
  {
    files: ['content.js', 'popup.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        chrome: 'readonly',
        // 'module' is referenced in content.js for CommonJS exports in the test environment
        module: 'readonly',
      },
    },
  },

  // Build/utility scripts (Node.js environment)
  {
    files: ['build.js', 'generate_icons.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
  },

  // Test files (Jest + Node + browser environment)
  {
    files: ['tests/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
      },
    },
  },

  // Ignore generated/vendored files
  {
    ignores: ['node_modules/**'],
  },
];
