module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended'
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'migrations/*.ts'],
  rules: {
    "import/no-unresolved": "off",
    "indent": "off",
    "arrow-parens": "off",
    "no-await-in-loop": "off",
    "no-param-reassign": "off",
    "max-classes-per-file": "off",
    "no-restricted-syntax": "off",
    "no-underscore-dangle": "off",
    "no-useless-constructor": "off",
    "class-methods-use-this": "off",
    "import/prefer-default-export": "off",
    '@typescript-eslint/no-explicit-any': 'off',
    "comma-dangle": ["error", "always-multiline"],
    '@typescript-eslint/interface-name-prefix': 'off',
    "@typescript-eslint/explicit-member-accessibility": "off",
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: true }],
    "@typescript-eslint/explicit-function-return-type": ["warn", { allowExpressions: true }],
  },
  "settings": {
    "import/resolver": {
      "node": {
        "extensions": [".js", ".jsx", ".ts", ".tsx", ".d.ts"]
      }
    },
  },
};
