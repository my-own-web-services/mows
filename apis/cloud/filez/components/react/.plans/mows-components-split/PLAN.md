# Split filez-components-react → mows-components-react + filez-components-react

## Goal

Carve the generic, app-agnostic parts out of `filez-components-react` into a new
`mows-components-react` package that lives at `/home/paul/projects/mows/components/react/`.
`filez-components-react` stays at `apis/cloud/filez/components/react/` and depends
on the new generic package. **MOWS owns auth** — the generic package contains the
OIDC integration; filez only consumes Mows auth and adds its own API client.

## Confirmed decisions

1. ✅ Filez package stays at `apis/cloud/filez/components/react/`.
2. ✅ Unscoped package names: `mows-components-react`, `filez-components-react`.
3. ✅ `MowsProvider` takes a required `storagePrefix` prop. Filez passes `"filez"`,
   so existing localStorage keys (`filez_theme`, `filez_language`, `filez_hotkey_config`,
   `filez_recent_actions`, `filez_log_level`) survive unchanged. CSS class prefix
   becomes `${storagePrefix}-theme-` (so `filez-theme-dark` keeps working).
4. ✅ MOWS owns auth. `MowsContext` exposes `auth`, `mowsUser` (OIDC claims),
   theme, language, action manager, hotkey manager, modal manager.
   `FilezContext` is much smaller: only `filezClient`, `ownFilezUser`,
   session refresh. Filez consumers read `auth` from `MowsContext`, not `FilezContext`.

## Target layout

```
/home/paul/projects/mows/
├── components/react/                       # NEW — mows-components-react
│   ├── package.json                        # name: mows-components-react
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/                         # all shadcn primitives (moved)
│   │   │   ├── atoms/
│   │   │   │   ├── actionDisplay/
│   │   │   │   ├── avatar/                 # generic OIDC-claims avatar
│   │   │   │   ├── buttonSelect/
│   │   │   │   ├── commandPalette/
│   │   │   │   ├── copyValueButton/
│   │   │   │   ├── dateTime/
│   │   │   │   ├── globalContextMenu/
│   │   │   │   ├── keyboardShortcutEditor/
│   │   │   │   ├── keyComboDisplay/
│   │   │   │   ├── languagePicker/
│   │   │   │   ├── modalHandler/
│   │   │   │   ├── optionPicker/
│   │   │   │   └── themePicker/
│   │   │   ├── list/ResourceList/          # generic infinite/sortable list
│   │   │   ├── loggingConfig/
│   │   │   └── development/DevPanel.tsx    # framework only; tasks injected
│   │   ├── lib/
│   │   │   ├── mowsContext/
│   │   │   │   ├── MowsContext.tsx         # provider + context + hooks
│   │   │   │   ├── ActionManager.tsx       # moved as-is
│   │   │   │   └── HotkeyManager.tsx       # moved as-is
│   │   │   ├── languages/                  # framework + base translations
│   │   │   ├── languages.ts
│   │   │   ├── themes.ts
│   │   │   ├── logging.ts
│   │   │   ├── utils.ts                    # generic helpers (cn, signinRedirectSavePath)
│   │   │   ├── defaultHotkeys.ts           # generic action IDs only
│   │   │   ├── coreActions.ts              # OPEN_COMMAND_PALETTE, OPEN_THEME_SELECTOR, etc.
│   │   │   └── constants.ts                # generic constants only
│   │   ├── main.css                        # tailwind base + theme tokens
│   │   └── main.ts                         # public exports
│   ├── src/                                # local dev shell for component playground
│   ├── components.json                     # shadcn config (copy)
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── vitest.config.ts / vitest.setup.ts
│   ├── eslint.config.js
│   └── CLAUDE.md
└── apis/cloud/filez/components/react/      # filez-components-react (existing path)
    ├── package.json                        # depends on mows-components-react
    ├── lib/
    │   ├── components/
    │   │   ├── atoms/
    │   │   │   ├── fileGroupCreate/
    │   │   │   ├── fileGroupPicker/
    │   │   │   ├── fileIcon/
    │   │   │   ├── jobs/
    │   │   │   ├── resourceTags/
    │   │   │   ├── storageLocationPicker/
    │   │   │   ├── storageQuotaPicker/
    │   │   │   └── upload/
    │   │   ├── fileViewer/
    │   │   ├── list/{FileList,JobList}.tsx
    │   │   ├── PrimaryMenu.tsx             # filez build of generic primary menu
    │   │   └── development/                # filez-specific dev tasks/apiTests
    │   ├── lib/
    │   │   ├── filezContext/FilezContext.tsx   # filezClient + ownFilezUser + sessionRefresh
    │   │   ├── filezActions.ts                 # filez-specific actions
    │   │   ├── languages/                      # filez-specific translation extensions
    │   │   ├── mock/
    │   │   ├── constants.ts                    # filez constants
    │   │   └── utils.ts                        # filez-only helpers (kept narrow)
    │   ├── main.css                            # imports mows-components-react/main.css
    │   └── main.ts                             # filez exports + re-exports from mows
    └── src/App.tsx                              # composes MowsProvider + FilezClientProvider
```

## MowsContext shape

```ts
export interface MowsContextType {
  // auth (owned here)
  readonly auth: AuthContextProps;
  readonly mowsUser?: User | null;          // raw OIDC user

  // theme
  readonly currentTheme: MowsTheme;
  readonly setTheme: (theme: MowsTheme) => Promise<void>;

  // i18n (generic Translation type; apps augment via module declaration)
  readonly t: Translation;
  readonly currentLanguage?: Language;
  readonly setLanguage: (language?: Language) => void;

  // ux
  readonly actionManager: ActionManager;
  readonly hotkeyManager: HotkeyManager;
  readonly currentlyOpenModal?: string;
  readonly changeActiveModal: (modalType?: string) => void;
}
```

`MowsProvider` props:

```ts
interface MowsProviderProps {
  children: ReactNode;
  storagePrefix: string;                     // required — "filez", "manager", etc.
  oidc: {
    issuerUrl: string;
    clientId: string;
    audience?: string;                       // optional extra scope
    redirectPath?: string;                   // default "/auth/callback"
  };
  actions?: Action[];                        // app-specific actions to register
  hotkeys?: HotkeyConfig[];                  // app-specific hotkey defaults
  themes?: MowsTheme[];                      // override/extend default themes
  languages?: Language[];                    // override/extend default languages
}
```

`MowsProvider` internally renders `<AuthProvider>` (oidc-client-ts/react-oidc-context),
`<DndProvider backend={HTML5Backend}>`, then a `MowsClientManager` that wires up
theme/language/actions/hotkeys/modals — same machinery currently in
`FilezClientManagerBase`, minus the filez API calls.

## FilezContext shape (after split)

```ts
export interface FilezContextType {
  readonly filezClient: FilezClient;
  readonly clientConfig: ClientConfig;
  readonly clientLoading: boolean;
  readonly clientAuthenticated: boolean;
  readonly ownFilezUser?: FilezUser | null;
}
```

`FilezClientProvider` is mounted **inside** a `MowsProvider`. It reads `auth` from
`MowsContext`, builds the filez API client when `auth.user.access_token` becomes
available, performs the session refresh loop, loads `ownFilezUser`, and exposes
`FilezContext` to children. App root looks like:

```tsx
<MowsProvider storagePrefix="filez" oidc={filezOidcConfig} actions={filezActions}>
  <FilezClientProvider clientConfig={filezClientConfig}>
    <App />
  </FilezClientProvider>
</MowsProvider>
```

The bootstrap that currently fetches `/api/client_config` via
`getClientConfig()` stays in filez (it talks to the filez backend). The fetched
config is split: OIDC bits → `MowsProvider`, filez serverUrl → `FilezClientProvider`.

## Translation strategy

Generic `Translation` type holds only generic UI strings (theme picker, language
picker, command palette, keyboard shortcut editor, generic actions). Filez
augments it via TypeScript declaration merging:

```ts
// in filez package
declare module "mows-components-react/languages" {
  interface Translation {
    fileGroupCreate: { ... };
    upload: { ... };
    // ...
  }
}
```

Each filez language file imports the generic base, spreads it, and adds the
filez-specific keys. We'll codify this with a helper.

## Constants split

Generic (move):
- `THEME_LOCAL_STORAGE_KEY` → derived from `${storagePrefix}_theme`
- `SELECTED_LANGUAGE_LOCAL_STORAGE_KEY` → `${storagePrefix}_language`
- `HOTKEY_CONFIG_LOCAL_STORAGE_KEY` → `${storagePrefix}_hotkey_config`
- `RECENT_ACTIONS_STORAGE_KEY` → `${storagePrefix}_recent_actions`
- `MAXIMUM_RECENT_ACTIONS` (constant 5)
- `LOG_LEVEL_LOCAL_STORAGE_KEY` → `${storagePrefix}_log_level`
- `CSS_VARIABLE_THEME_PREFIX` → `${storagePrefix}-theme-`
- `POST_LOGIN_REDIRECT_PATH_LOCAL_STORAGE_KEY` → `${storagePrefix}_post_login_redirect_path`
- `ACTION_GLOBAL_SCOPE`

Filez-only (stay):
- `RESOURCE_TAGS_*`

The MowsProvider builds these keys at runtime from `storagePrefix` and exposes a
typed `getStorageKey(name)` helper from the context for any module that needs a
namespaced key.

## Migration of filez consumers

Every filez file currently importing from `@/lib/filezContext/FilezContext`,
`@/components/ui/*`, `@/lib/themes`, etc. needs its imports updated. Two cases:

1. Generic concerns (`useFilez().t`, `useFilez().currentTheme`, `useFilez().actionManager`,
   etc.) → switch to `useMows()` from `mows-components-react`.
2. Filez-specific (`useFilez().filezClient`, `useFilez().ownFilezUser`) →
   stays on the new slimmed `useFilez()`, which now lives in the filez package and
   re-exports from `filez-components-react`.

Net effect in app code: most files end up with two hooks, `useMows()` and
`useFilez()`, instead of one fat one.

`defineApplicationActions(this)` becomes `defineFilezActions({ changeActiveModal, auth })`
where `changeActiveModal` and `auth` come from the `MowsContext` it's mounted under.

## Build / tooling

- `mows-components-react` gets its own `vite.config.ts`, `tsconfig*.json`,
  `vitest.config.ts`, `tailwind.config.js`, `eslint.config.js` (copied and
  trimmed from filez). External deps in rollup: react, react-dom, react/jsx-runtime,
  tailwindcss. **No filez-client-typescript externalisation.**
- `filez-components-react` keeps its existing build. Adds `mows-components-react`
  to `peerDependencies` and externalises it in rollup.
- For local development we link `mows-components-react` into
  `filez-components-react` with **yalc**, matching the existing
  `filez-client-typescript` pattern (pnpm workspaces have caused issues in this
  repo and are not used).

## Phased execution

### Phase 0 — scaffolding (no behaviour change yet)
- 0.1 ✅/❌ Create `/home/paul/projects/mows/components/react/` skeleton: package.json,
  vite.config.ts, tsconfig*.json, vitest.config.ts, tailwind.config.js,
  components.json, eslint.config.js, CLAUDE.md, empty `lib/main.ts`, empty
  `src/App.tsx` dev shell. Build command should succeed on empty lib.
- 0.2 ✅/❌ Set up yalc: run `yalc publish` from the empty `mows-components-react`,
  add it to filez via `yalc add mows-components-react`. Confirm `yalc.lock`
  updates and `node_modules/mows-components-react` resolves. (Re-run
  `yalc push` after every batch of changes during phases 1–4.)
- 0.3 ✅/❌ Verify `pnpm install` and `pnpm build` succeed in both packages
  with the empty link in place.

### Phase 1 — move generic UI primitives (mechanical)
Files that have **no FilezContext / filez-client dep**. Move first because they
unblock everything else.
- 1.1 ✅ All `lib/components/ui/*` → `mows-components-react/lib/components/ui/*`.
- 1.2 ✅ Generic atoms with no filez deps:
  `buttonSelect`, `copyValueButton`, `optionPicker`. (`dateTime` deferred to
  phase 2 — it imports FilezContext.) Move + smoke test.
- 1.3 ✅ Move `lib/lib/logging.ts` and `lib/lib/themes.ts`. Generic helpers
  from `lib/lib/utils.ts` (`cn`, `formatFileSizeToHumanReadable`,
  `generateRandomId`) moved; filez `utils.ts` re-exports them and keeps
  `rawFileEndings`, `isText`, `signinRedirectSavePath`. `FilezTheme` renamed
  to `MowsTheme` across filez.
- 1.4 ✅ `mows-components-react/lib/main.ts` exports the moved pieces.
- 1.5 ✅ Filez imports updated; `pnpm build` and `pnpm test` (103/103) green.

Notes from phase 1:
- Vite library mode (`build.lib.entry`) is required, not `rollupOptions.input`.
  The latter is "multi-entry app build" and mangles export names so consumers
  see `export { log as l }` instead of `export { log }`. Library mode produces
  the correct named exports. `formats: ['es']` is set; tests are excluded
  from the entry glob.
- A side benefit of using `build.lib`: tests no longer ship in `dist/`.

### Phase 2 — move ActionManager / HotkeyManager / MowsContext core
- 2.1 ✅ Move `ActionManager.tsx`, `HotkeyManager.tsx` to mows
  (`lib/lib/mowsContext/`). Parameterized via constructor config:
  - `ActionManager(config: { recentActionsStorageKey, maxRecentActions })`
  - `HotkeyManager(actionManager, config: { configStorageKey, defaultHotkeys })`
  Filez `FilezContext` constructs them with its own filez constants;
  localStorage keys (`filez_recent_actions`, `filez_hotkey_config`) preserved.
  Filez build green, 103/103 tests pass.
- 2.2 ❌ Create `MowsContext.tsx` based on `FilezClientManagerBase`, stripped
  of filez API client and session refresh. Keep auth + theme + language +
  action mgr + hotkey mgr + modal mgr. Add `storagePrefix` prop. Build the
  storage keys at construction time.
- 2.3 ❌ Move `defaultHotkeys.ts` and split `defaultActions.ts` into:
  - generic `coreActions.ts` in mows (theme/language/keyboard/command palette/
    devTools/login/logout) — these reference `auth` from props.
  - filez `filezActions.ts` (file/job deletion, primary menu hooks).
- 2.4 ❌ Move generic atoms that need MowsContext:
  `themePicker`, `languagePicker`, `keyboardShortcutEditor`, `keyComboDisplay`,
  `commandPalette`, `modalHandler`, `actionDisplay`, `avatar`, `globalContextMenu`,
  `dateTime`, `loggingConfig`. Update their imports to `useMows()`.
- 2.5 ❌ Translation framework: move `languages.ts`, `languages/en-US/default.ts`,
  `languages/de/default.ts`. Define generic `Translation` as `interface` base;
  use TypeScript declaration merging for filez extensions. Split actions
  field (open-ended `[key: string]: string`) so each package contributes its
  own action translations.

### Phase 3 — move ResourceList + DevPanel framework
- 3.1 ✅/❌ Move `lib/components/list/ResourceList/` to mows. Verify it has no
  filez-client imports (it doesn't, based on grep — but the test does, so
  audit and split the test if needed).
- 3.2 ✅/❌ Move `lib/components/development/DevPanel.tsx` to mows as a
  generic dev panel that accepts `tasks` and `apiTests` as props/children.
  Filez keeps its own task/apiTest definitions and passes them in.
- 3.3 ✅/❌ Move `loggingConfig` (depends on logging.ts which is already moved).

### Phase 4 — auth handover
- 4.1 ✅/❌ MowsProvider owns `<AuthProvider>` and `<DndProvider>`. The
  `oidc` prop drives the OIDC config. `auth` is exposed in `MowsContext`.
  Generic post-login redirect handling moves here too.
- 4.2 ✅/❌ Build `FilezClientProvider` in filez: reads `auth` from
  `useMows()`, builds the filez API client, runs session refresh, exposes
  the new (slim) `FilezContext`.
- 4.3 ✅/❌ Update `src/App.tsx` (filez dev shell) to compose
  `MowsProvider` + `FilezClientProvider`.
- 4.4 ✅/❌ Migrate every `useFilez()` / `FilezContext` consumer in filez:
  - reads of `auth`, `t`, `currentTheme`, `setTheme`, `currentLanguage`,
    `setLanguage`, `actionManager`, `hotkeyManager`, `currentlyOpenModal`,
    `changeActiveModal` → `useMows()`.
  - reads of `filezClient`, `ownFilezUser`, `clientConfig`,
    `clientAuthenticated`, `clientLoading` → stay on `useFilez()`.
- 4.5 ✅/❌ Move `PrimaryMenu` decision: it has both generic items (theme,
  language, keyboard shortcuts, dev tools) and filez items (logout uses
  filez session, user avatar shows ownFilezUser). Plan: ship a generic
  `PrimaryMenu` skeleton in mows that takes slots for app-specific menu
  items; filez wraps it and injects its filez items.

### Phase 5 — finalisation
- 5.1 ✅/❌ All `pnpm build` and `pnpm test` pass in both packages.
- 5.2 ✅/❌ Filez dev shell (`pnpm dev`) renders identically to before.
- 5.3 ✅/❌ Manual verification in browser: theme switches, language switches,
  command palette opens, keyboard shortcuts editable, login/logout work,
  filez API calls succeed, session refresh fires.
- 5.4 ✅/❌ Update root README + filez CLAUDE.md to reference the new package.
- 5.5 ✅/❌ Delete the old `lib/lib/filezContext/FilezContext.tsx` from filez
  (replaced by the slim FilezClientProvider).
- 5.6 ✅/❌ Audit imports — no filez file should still import from a
  `lib/lib/filezContext/...` path that no longer exists.

## Phases 2.2–2.5 + Phase 4 landed

### What landed
- **Translation framework**: `BaseTranslation` interface in mows (only generic
  keys); filez augments via `declare module "mows-components-react/lib/languages"`
  declaration merging. Mows ships `en-US` + `de` base translation files; filez
  spreads them and adds resourceTags / upload / fileGroup* / storage*Picker /
  jobsProgress / jobList / common keys.
- **CoreActionIds + coreActions** in mows
  (`mows.openCommandPalette`, `mows.openThemeSelector`, `mows.user.login`, etc.).
  `defineCoreActions(provider, postLoginRedirectStorageKey)` builds the action
  list with handlers wired to `provider.changeActiveModal` and
  `provider.props.auth.signinRedirect`. Filez ships its own `FilezActionIds`
  (DELETE_FILES/DELETE_JOBS/CREATE_FILE_GROUP) in `lib/lib/filezActions.ts`,
  plus a `<FilezActionHandlers />` component that registers the
  CREATE_FILE_GROUP handler at runtime via `useEffect`.
- **MowsContext + MowsProvider** in mows: owns OIDC AuthProvider, DndProvider,
  ActionManager, HotkeyManager, theme + language state, modal state. Required
  `storagePrefix` prop drives all localStorage keys (`${prefix}_theme`,
  `${prefix}_language`, `${prefix}_hotkey_config`, `${prefix}_recent_actions`,
  `${prefix}_post_login_redirect_path`) and the CSS theme class prefix
  (`${prefix}-theme-`). Optional `themes` / `languages` /
  `initialTranslation` / `extraActions` / `extraDefaultHotkeys` /
  `defaultThemeId` / `onSigninCallback` props.
- **10 generic atoms moved** to mows: `themePicker`, `languagePicker`,
  `keyboardShortcutEditor`, `keyComboDisplay`, `actionDisplay`,
  `commandPalette`, `modalHandler`, `dateTime`, `avatar`, `globalContextMenu`,
  plus `LoggingConfig`. All switched from `FilezContext` to `MowsContext`.
  - `ModalHandler` genericized: ships only core modals
    (themeSelector / languageSelector / keyboardShortcutEditor) and accepts an
    `extraModals` prop for app-specific modals.
  - `Avatar` genericized: takes `displayName: string` instead of
    `filezUser: FilezUser`.
  - `LanguagePicker` / `ThemePicker` read `themes` / `languages` from
    `MowsContext` instead of importing globals.
- **Slim FilezContext**: only `filezClient`, `clientConfig`, `clientLoading`,
  `clientAuthenticated`, `ownFilezUser`. `FilezProvider` fetches client config
  via `getClientConfig()`, mounts `MowsProvider` (storagePrefix `filez`, filez
  OIDC audience scope, filez themes/languages/actions/hotkeys), and renders
  `FilezClientManager` (session refresh + user load) inside.
- **`withFilez` / `withMows` HOC typing fixed** to make the injected prop
  optional from the outside: signature is now
  `<P extends { x: T }>(Component: ComponentType<P>) => ComponentType<Omit<P, 'x'>>`.
- **`PrimaryMenu` migrated** to dual-context pattern: `static contextType =
  MowsContext` for theme/lang/auth/actionManager, `withFilez` HOC injects
  `filez: FilezContextType` prop for `clientLoading` / `ownFilezUser`.
- **Vite library config in filez**: `dts({ rollupTypes: true })` removed.
  Cross-package imports of `MowsContext` confused api-extractor; per-file
  declaration emit works fine.

### Remaining items
- ResourceList + DevPanel: still in filez. ResourceList is generic and could
  move; DevPanel is filez-coupled (filez API tests) and should stay or be
  refactored to take tasks/apiTests as injected children.
- Browser smoke test: `pnpm dev` not run; the build and unit tests pass but
  haven't verified the runtime in a browser yet.
- All filez-API-using consumers wrapped with `withFilez` HOC and using
  `this.props.filez.<field>` for filez-specific access:
  PrimaryMenu, FileList, JobList, DevPanel, StorageQuotaPicker,
  StorageLocationPicker, FileGroupCreate, FileGroupPicker, JobsProgress,
  Upload, ImageViewer. `tsc --noEmit` clean.

### Important gotcha
- Vite (esbuild) builds DON'T fully type-check — type errors silently passed
  the build until `tsc --noEmit -p tsconfig.app.json` was run explicitly.
  Always run that as part of verification, not just `pnpm build`.

### Stopping point at end of phase 2.1 (historical)

Mows package now contains: shadcn UI, generic atoms (buttonSelect /
copyValueButton / optionPicker), logging, themes, generic utils,
ActionManager, HotkeyManager. Filez consumes them via yalc and still owns
its FilezContext, translations, and the rest of the atoms. Filez builds
clean and all 103 tests pass.

**Why stop here**: phases 2.2–2.5 + phase 4 (MowsContext + translation split
+ atom moves + consumer migration) are tightly coupled and touch ~25 files
in filez at once. Doing them all in one push without checkpointing risks an
unstable intermediate where filez doesn't build. Better to land 2.1 cleanly,
review, then attempt the bigger atomic change deliberately in a follow-up.

**To resume**: read this PLAN, then start with translations (2.5) since it's
mechanical and self-contained; then build MowsContext (2.2); then 2.3+2.4+
phase 4 in one atomic change because they have circular dependencies.

## Open questions / risks

- **Translations declaration merging** depends on `mows-components-react` shipping
  the `Translation` interface as `interface` (not `type`). Confirm before phase 2.5.
- **PrimaryMenu split** is the messiest part — its actions/menu items mix
  concerns. Phase 4.5 may need its own micro-plan.
- **Default themes**: filez ships custom theme variants. Need to decide whether
  the `themes` array in mows defaults to `[system, light, dark]` and filez extends,
  or filez fully replaces. Probably extend.
- **react-dnd in MowsProvider**: not all mows apps need DnD. Either always
  include it (acceptable bundle cost since most apps will want drag-drop) or
  make it opt-in via prop. Default: always include for now; revisit if needed.
- **Pinning generic vs filez versions**: while we use a workspace, this is a
  non-issue. Once we publish to a registry, semver pinning matters.

## What's NOT in scope

- No publishing to a registry. Local workspace only for now.
- No changes to `filez-client-typescript`.
- No changes to filez backend, OIDC realm, or CI.
- No new components — purely a re-organisation.
- No backwards compatibility shims (per CLAUDE.md, breaking the filez import
  paths is fine; this lib has no external users yet).
