import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'
import preferArrow from 'eslint-plugin-prefer-arrow'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'prefer-arrow': preferArrow,
      'react': react,
    },
    rules: {
      'prefer-arrow/prefer-arrow-functions': [
        'error',
        {
          disallowPrototype: true,
          singleReturnOnly: false,
          classPropertiesAllowed: false,
        },
      ],
      'prefer-arrow-callback': ['error', { allowNamedFunctions: false }],
      'func-style': ['error', 'expression'],
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'always' }],
      'quotes': ['error', 'backtick', { avoidEscape: true, allowTemplateLiterals: false }],
      'react/jsx-curly-brace-presence': ['error', { props: 'always', children: 'never', propElementValues: 'always' }],
      // Ban literal neutral-palette Tailwind utilities. These colours don't
      // flip between light/dark themes, so a surface built with them stays
      // hardcoded to one shade regardless of <ThemeProvider>. Always reach
      // for semantic tokens instead: `bg-background`, `bg-card`, `bg-muted`,
      // `bg-accent`, `text-foreground`, `text-muted-foreground`,
      // `border-border`, `ring-ring`, etc. (Status colours like
      // `text-destructive` / `text-amber-500` and media overlays using
      // `bg-black/70` are not covered by this rule and stay allowed.)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/\\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|accent|caret|divide|shadow)-(?:zinc|gray|slate|neutral|stone)-\\d+/]',
          message: 'Use semantic theme tokens (bg-card, text-foreground, border-border, …) — literal neutral palette colours (zinc/gray/slate/neutral/stone) do not switch with the theme.',
        },
        {
          selector: 'TemplateElement[value.raw=/\\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|placeholder|accent|caret|divide|shadow)-(?:zinc|gray|slate|neutral|stone)-\\d+/]',
          message: 'Use semantic theme tokens (bg-card, text-foreground, border-border, …) — literal neutral palette colours (zinc/gray/slate/neutral/stone) do not switch with the theme.',
        },
      ],
    },
  },
])
