module.exports = {
    env: {
      es2021: true,
      node: true,
      'jest/globals': true,
    },
    extends: ['eslint:recommended', 'plugin:prettier/recommended'],
    plugins: ['jest'],
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off', // Allow console.log for Lambda functions
      'prettier/prettier': 'error',
      'no-unused-vars': 'warn'
    },
  };
