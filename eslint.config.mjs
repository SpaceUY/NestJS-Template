// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      indent: 'off',
      'arrow-parens': 'off',
      'no-await-in-loop': 'off',
      'no-param-reassign': 'off',
      'max-classes-per-file': 'off',
      'no-restricted-syntax': 'off',
      'no-underscore-dangle': 'off',
      'no-useless-constructor': 'off',
      'class-methods-use-this': 'off',
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      'prettier/prettier': 'error',
    },
  },
);
