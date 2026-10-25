// CJK literals belong in locales/<lang>/<ns>.json. Files that still carry them are listed in
// eslint-cjk-allowlist.json; that list may only shrink (scripts/locale-parity.test.mjs checks it).
const cjkAllowlist = require('./eslint-cjk-allowlist.json');

const CJK = '[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff00-\\uffef]';
const noCjk = 'No CJK text in code: add a key to locales/<lang>/<ns>.json (all three languages) and use t().';

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', 'node_modules', 'playwright-report', 'test-results', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      excludedFiles: cjkAllowlist.files,
      rules: {
        'no-restricted-syntax': [
          'error',
          { selector: `JSXText[value=/${CJK}/]`, message: noCjk },
          { selector: `Literal[value=/${CJK}/]`, message: noCjk },
          { selector: `TemplateElement[value.raw=/${CJK}/]`, message: noCjk },
        ],
      },
    },
    {
      files: ['e2e/**/*.ts', 'playwright.config.ts', 'scripts/**/*.mjs'],
      env: { node: true },
    },
  ],
};
