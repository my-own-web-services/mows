# Technology Stack

- Vite (library mode)
- Tailwind CSS
- Typescript
- React
- Mostly react class components
- shadcn and radixui (consumed from `@my-own-web-services/react-components` via yalc)
- vitest

# Architecture

This is the **filez-specific** React component library. Generic primitives,
auth, theme, language, action/hotkey machinery, modal handling, and the
generic `ResourceList` (with `ColumnListRowHandler` / `GridListRowHandler`)
live in `@my-own-web-services/react-components` at `/home/paul/projects/mows/components/react/`,
linked here via yalc. Filez consumes it and adds:

- Filez API client wiring (`FilezClientManager` inside `FilezContext.tsx`)
- Filez-specific actions and translations

## Component taxonomy

Components are grouped by purpose under `lib/components/` — the same semantic
layout used by `@my-own-web-services/react-components`. There is no `atoms/` bucket.

- `appShell/` — top-level chrome (`PrimaryMenu`, a thin filez wrapper around
  the mows `PrimaryMenu` that adds a "Developer Tools" entry and wires the
  filez user).
- `development/` — `DevPanel` plus `apiTests/*` and `tasks/*` scripts. The
  DevPanel dynamically imports modules from those two subfolders.
- `fileGroups/` — `FileGroupCreate`, `FileGroupPicker`.
- `files/` — filez-specific file UI: `fileList` plus the thin filez wrapper
  around `@my-own-web-services/react-components`'s `FileViewer` (resolves a `FilezFile` to
  the right thumbnail URL, detects 360 panoramas). `FileIcon` and the
  generic `FileViewer`/`ImageViewer`/`Image360Viewer` live in
  `@my-own-web-services/react-components`.
- `jobs/` — `JobsProgress`, `JobList`.
- `storage/` — `StorageLocationPicker`, `StorageQuotaPicker`.
- `tags/` — `ResourceTags`.
- `upload/` — `upload/upload/Upload.tsx` (plus helpers `ImagePreview.tsx`,
  `handleUpload.tsx` in the same folder).
- `list/ResourceList/` — only integration tests for the mows-side
  `ResourceList` running under `FilezProvider` (`ResourceList.test.tsx`
  + `rowHandlers/Column.test.tsx`). No filez `ResourceList`
  implementation; the component itself ships from `@my-own-web-services/react-components`.
  **Never put filez-side source here** — if you need a filez-specific
  list helper, give it its own group (or add to `files/fileList/`).

When adding a new component, pick the group it most clearly belongs to. If
none fits, surface that to the user before inventing a new group.

`FileList` passes a filez `FileViewer`-based `cellRenderer` to the generic
`GridListRowHandler` so the grid can be reused for any object type.

`FilezProvider` mounts `MowsProvider` (passing `storagePrefix="filez"`,
the filez OIDC scope, filez themes/languages/actions/hotkeys) and then
mounts `FilezClientManager` inside it. Auth is owned by Mows; Filez only
consumes it.

# Context usage

Class components that need both contexts:

```ts
import { MowsContext } from "@my-own-web-services/react-components/lib/mowsContext/MowsContext";
import { type FilezContextType, withFilez } from "@/lib/filezContext/FilezContext";

interface FooProps {
    // ...
    readonly filez: FilezContextType;
}

class FooBase extends PureComponent<FooProps, FooState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    // mows fields: this.context.t, this.context.actionManager, this.context.auth, ...
    // filez fields: this.props.filez.filezClient, this.props.filez.ownFilezUser, ...
}

export default withFilez(FooBase);
```

For mows-only or filez-only components, use only one of the contexts.

# General

- When you are done with a task and wait for the next instructions it may be that i manually change some of your created code, when the next instruction comes and you find some inconsistencies between the last time you read the file, assume that i did them and that they should be there, don't blindly change them back, if in doubt ask me

- backward compatibility is NOT required yet, nobody is currently using this library, just check if it breaks something internally and fix it

- All components should be exported from main

- Generic primitives belong in `@my-own-web-services/react-components`. Only filez-specific
  components live here.

# Style

- use only arrow functions where possible especially in classes
- All constants should be defined in constants.ts, for example local storage access keys
- run pnpm lint:fix to format the files
- Don't use `bg-gray-50` or similar classes but the foreground and background colors

# Building

- Use `pnpm build` to build the project. Note: Vite/esbuild does NOT
  full type-check. Run `npx tsc --noEmit -p tsconfig.app.json` to
  catch TypeScript errors that the build silently lets through.
- After changes to `@my-own-web-services/react-components`, run `pnpm build && yalc push`
  in that package to refresh the link here.

# Translations

- Generic translation keys (primaryMenu, languagePicker, themePicker,
  keyboardShortcuts, commandPalette, devPanel, loggingConfig, devTools,
  resourceList, generic actions) live in `@my-own-web-services/react-components`.
- Filez-specific keys (resourceTags, upload, fileGroup*, storage*,
  jobsProgress, jobList, common, filez actions) are added here via
  TypeScript declaration merging in `lib/lib/languages.ts`:
  ```ts
  declare module "@my-own-web-services/react-components/lib/languages" {
      interface Translation {
          // filez keys here
      }
  }
  ```
- Filez language files (`lib/lib/languages/<lang>/default.ts`) import
  the mows base, spread it, and add filez keys.
- The translation is available with `const { t } = this.context!;` where
  context is `MowsContext`.

# Testing

- vitest with @testing-library/jest-dom/vitest @testing-library/react, setup can be found in the root of the project at vitest.config.ts and vitest.setup.ts

- Use `pnpm test` to test the project. Always also run
  `npx tsc --noEmit -p tsconfig.app.json` since `pnpm build` does not
  full type-check.

## Component Testing Guidelines

- Row handlers (like ColumnListRowHandler) should be tested through the ResourceList component, not standalone, as they are tightly integrated and rely on ResourceList's state and lifecycle
- Test row handler configuration options by passing them to ResourceList and verifying the resulting DOM structure and behavior
- Use proper FilezProvider setup or appropriate mocks when testing components that depend on the Filez context
