# Technology Stack

- Vite (library mode)
- Tailwind CSS
- Typescript
- React
- Mostly react class components
- shadcn and radixui
- vitest

# General

- When you are done with a task and wait for the next instructions it may be that i manually change some of your created code, when the next instruction comes and you find some inconsistencies between the last time you read the file, assume that i did them and that they should be there, don't blindly change them back, if in doubt ask me

- backward compatibility is NOT required yet, nobody is currently using this library, just check if it breaks something internally and fix it

- All components should be exported from main

# Style

- use only arrow functions where possible especially in classes
- All constants should be defined in constants.ts, for example local storage access keys
- run pnpm lint:fix to format the files
- Don't use `bg-gray-50` or similar classes but the foreground and background colors

# Building

- Use `pnpm build` to build the project and check if typescript has any errors

# Translations

- No fallback translations in the components
- translations must be added to the Translation type in lib/lib/languages.ts and then to their respective language files in lib/lib/languages/[lang]/default.ts
- the translation is available with the filez provider like this: `const { t } = this.context!;`
- the context must be added, in class components for example like this:

```ts
export default class PrimaryMenu extends PureComponent<PrimaryMenuProps, PrimaryMenuState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
}
```

# Testing

- vitest with @testing-library/jest-dom/vitest @testing-library/react, setup can be found in the root of the project at vitest.config.ts and vitest.setup.ts

- Use `pnpm test` to test the project but try `pnpm build` first to check for typescript errors

## Component Testing Guidelines

- Row handlers (like ColumnListRowHandler) should be tested through the ResourceList component, not standalone, as they are tightly integrated and rely on ResourceList's state and lifecycle
- Test row handler configuration options by passing them to ResourceList and verifying the resulting DOM structure and behavior
- Use proper FilezProvider setup or appropriate mocks when testing components that depend on the Filez context
