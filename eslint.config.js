import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import vueParser from 'vue-eslint-parser'

export default [
  { ignores: ['dist', 'node_modules', 'coverage'] },
  eslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    rules: {
      'no-undef': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, extraFileExtensions: ['.vue'] },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
]
