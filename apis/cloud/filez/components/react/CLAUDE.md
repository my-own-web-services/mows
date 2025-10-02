# Technology Stack

- Vite (library mode)
- Tailwind CSS
- Typescript
- React
- Mostly react class components
- shadcn and radixui

# General

- use only arrow functions where possible especially in classes
- All constants should be defined in constants.ts, for example local storage access keys
- No fallback translations in the components
- translations must be added to the Translation type in lib/lib/languages.ts and then to their respective language files in lib/lib/languages/[lang]/default.ts
- backward compatibility is NOT required yet, nobody is currently using this library, just check if it breaks something internally and fix it

# Building

- Use `pnpm build` to build the project and check if typescript has any errors

# Testing

- vitest with @testing-library/jest-dom/vitest @testing-library/react, setup can be found in the root of the project at vitest.config.ts and vitest.setup.ts

- Use `pnpm test` to test the project but try `pnpm build` first to check for typescript errors
