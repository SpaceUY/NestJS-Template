// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import typescriptEslintEslintPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
        "@typescript-eslint": typescriptEslintEslintPlugin,
        prettier: prettierPlugin,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts'],
        },
      },
    },
    rules: {
      'import/no-unresolved': 'off',
      indent: 'off',
      'arrow-parens': 'off',
      'no-await-in-loop': 'off',
      'no-param-reassign': 'off',
      'max-classes-per-file': 'off',
      'no-restricted-syntax': 'off',
      'no-underscore-dangle': 'off',
      'no-useless-constructor': 'off',
      'class-methods-use-this': 'off',
      'import/prefer-default-export': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      'prettier/prettier': 'error',
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);