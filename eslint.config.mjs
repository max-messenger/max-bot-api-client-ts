import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importXPlugin from 'eslint-plugin-import-x';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'examples/**'],
  },

  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      'import-x': importXPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'import-x/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'alphabetize': { 'order': 'asc', 'caseInsensitive': true }
      }],
      'import-x/extensions': 'off',
      'import-x/prefer-default-export': 'off',
      'no-await-in-loop': 'off',
      'no-return-assign': 'off',
      'arrow-body-style': 'off',
      'no-restricted-syntax': 'off',
      'class-methods-use-this': 'off',
      'max-classes-per-file': 'off',
      'no-underscore-dangle': ['error', { 'allowAfterThis': true }],
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn'
    },
  }
);
