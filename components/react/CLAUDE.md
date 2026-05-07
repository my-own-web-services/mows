# mows-components-react

Generic React component + context library shared by all MOWS frontend apps.
Filez and any other MOWS app consumes this package; it must remain free of
app-specific imports (no `filez-client-typescript`, no filez-named constants).

# Technology Stack

- Vite (library mode)
- Tailwind CSS v4
- TypeScript
- React 19, mostly class components
- shadcn (new-york style) and Radix UI primitives
- vitest + @testing-library/react

# General

- This package owns auth (OIDC via `oidc-client-ts` / `react-oidc-context`),
  theme, language, action manager, hotkey manager, and modal manager. App
  packages mount `<MowsProvider>` and consume via `useMows()`.
- App-specific localStorage / CSS class namespacing is driven by the required
  `storagePrefix` prop on `<MowsProvider>`. Never hardcode an app name in this
  package.
- All components are exported from `lib/main.ts`.
- No backwards-compatibility shims: this package has no external consumers
  outside this monorepo yet. Break and fix.

# Style

- Use only arrow functions where possible (especially in classes). Enforced by
  ESLint.
- All constants live in `lib/lib/constants.ts` (e.g. localStorage suffix names).
- Run `pnpm lint:fix` to format files.
- Do not use `bg-gray-50` and similar literal colors — use the semantic tokens
  (`bg-background`, `bg-card`, `text-foreground`, etc.).

# Building

- `pnpm build` to produce the lib (and verify TypeScript).

# Translations

- Generic `Translation` interface lives in `lib/lib/languages.ts`.
- Apps extend it via TypeScript declaration merging.
- Generic translations live in `lib/lib/languages/<lang>/default.ts`.
- Inside class components: `static contextType = MowsContext;` then
  `this.context!.t.…`.

# Testing

- vitest with `@testing-library/jest-dom/vitest` + `@testing-library/react`.
  Setup: `vitest.config.ts` + `vitest.setup.ts`.
- `pnpm test` to run.
- Run `pnpm build` first to surface TS errors before tests.

# Yalc workflow

- This package is consumed by other MOWS packages via **yalc**, not pnpm
  workspaces.
- After changes: `pnpm build && yalc push` to update consumers.
