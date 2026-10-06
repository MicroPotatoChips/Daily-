const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'ios/**',
      'android/**',
      '.expo/**',
      '.tools/**',
      '.cache/**',
      'artifacts/**',
      'modules/**/build/**',
    ],
  },
  {
    files: ['*.js', 'plugins/*.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', module: 'readonly', require: 'readonly' },
    },
  },
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'error' } },
]);
