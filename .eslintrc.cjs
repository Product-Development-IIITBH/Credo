module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-refresh'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // --- Standard Rules ---
    'no-unused-vars': 'off', // Use the TypeScript version instead
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-undef': 'off', // Handled by TypeScript

    // --- TypeScript Rules ---
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // --- React Rules ---
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+
    'react/prop-types': 'off', // Not needed when using TypeScript
    'react-hooks/rules-of-hook': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // --- React Refresh (for Vite) ---
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '*.cjs',
    '*.mjs',
  ],
};
