# @my-own-web-services/react-components

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
  (`bg-background`, `bg-card`, `text-foreground`, etc.). This is enforced by an
  ESLint `no-restricted-syntax` rule that bans `(bg|text|border|ring|…)-(zinc|
  gray|slate|neutral|stone)-N` in both string and template literals: the
  neutral palette doesn't flip between themes, so a surface built on it will
  stay one shade regardless of light/dark (this caused the install-block
  bug). Status colours (`text-destructive`, `text-amber-500`, …) and media
  overlays (`bg-black/70`) are unaffected.

# Component taxonomy

Components are grouped by purpose under `lib/components/`. There is no `atoms/`
bucket — every component lives in a semantic group:

- `actions/` — action discovery and key-combo surfaces (`ActionDisplay`,
  `KeyComboDisplay`, `KeyComboRecorder`, `KeyboardShortcutEditor`).
- `appShell/` — top-level chrome that lives on every page (`PrimaryMenu`,
  `CommandPalette`, `GlobalContextMenu`, `ModalHandler`).
- `code/` — code editing, theming, and inline snippets (`CodeViewer` over
  Monaco, `CodeSnippet` for inline tokenized code, `ExpandableCode`
  show-more wrapper, `CodeThemePicker`).
- `console/` — terminal-like surfaces (`Terminal` over xterm.js, `LogView`,
  `MachineMonitor` over react-vnc, `ConsoleManager` VSCode-style tab host).
- `dateTime/` — date and time (`DateTimeDisplay`, `DateTimePicker`,
  `TimePicker`, `TimezoneSelector`, `DateTimeRangePicker`).
- `files/` — generic file rendering. `FileViewer` (with `formats/*` for
  per-mimetype viewers: `ImageViewer`, `Image360Viewer`, `VideoViewer`)
  takes a resolved `src` URL plus `name`/`mimeType`; URL resolution is the
  consumer's responsibility. `FileIcon` delegates filename → icon-name
  resolution to the upstream `vscode-material-icons` package and bundles
  that package's SVGs as Vite assets so consumers don't need to mirror
  anything in their own `public/`.
- `identity/` — user identity (`Avatar`).
- `input/` — interactive form-style controls built on top of `ui/` primitives
  (`SearchInput`, `SearchSelectPicker`, `OptionPicker`, `ButtonSelect`,
  `CopyValueButton`, `NumberInput`, `InlineEdit`).
- `list/` — large list / table surfaces (`ResourceList`).
- `navigation/` — in-page / cross-page navigation aids (`PageIndex`
  "on this page" rail, `SectionHeading` permalink heading, `Compass`
  bearing indicator).
- `settings/` — settings / preferences / configuration surfaces
  (`SettingsPanel`, `LanguagePicker`, `ThemePicker`, `LoggingConfig`).
- `ui/` — shadcn primitives (unchanged). Never edit these for project-specific
  behaviour — wrap them in a higher-level component in one of the groups
  above.

When adding a new component, pick the group it most clearly belongs to. If
none fits, surface that to the user before inventing a new group — group
sprawl defeats the point of the taxonomy.

# Per-component docs

**Canonical doc surface is `<Component>DocPage.tsx`** under
`src/examples/<component>/`. Every public component has a DocPage that
covers Installation, Examples, Usage, Composition, RTL, Defined
behaviour, and an API Reference (see "Doc pages" further down) — that's
the contract a reader can rely on.

Co-located `<ComponentName>.md` files are **encouraged but optional**:
keep them for design rationale, mounting-rule deep dives, or any
"why does it work this way" prose that doesn't fit a docpage section
(see `appShell/primaryMenu/PrimaryMenu.md`,
`appShell/commandPalette/CommandPalette.md`,
`console/consoleManager/ConsoleManager.md` for examples). When an `.md`
exists, treat it as the design source of truth and keep it in sync with
the source — but absence of one is fine when the DocPage covers the
full surface (DOC-36).

The doc MUST include a runnable example for **every mode the component can be
used in** — every `variant`, `mode`, `orientation`, or other top-level shape
prop. If a prop changes how the component fundamentally renders, it gets its
own example block. A bare prop table is not enough; the example shows callers
what the wiring looks like end-to-end (`<Provider>` / parent components
included if they are required).

**The examples in the `.md` are the same examples that live in `src/examples/
<component>/`.** The docs harness reads those files at build time via Vite's
`?raw` import and renders them through `<ExamplePage>`, so the source a
reader sees in the docs is the source that runs. Concretely:

- Every mode must have a corresponding `src/examples/<component>/<Mode>.tsx`
  registered in that folder's `index.ts`.
- The `.md` code blocks should mirror those files (you can copy the body
  directly — keep them in sync).
- If you add a mode, you add the example file, register it, AND update the
  `.md` in the same change. Demo-only or doc-only modes are not allowed.

When you add a new variant, mode, prop with non-obvious behavior, or a
required mounting pattern (e.g. "must live inside `SidebarFooter`"), update
the component's `.md` in the same change — add the new example, update the
status/behavior table, and refresh the prop list.

# Doc pages

Every component that surfaces in the docs sidebar gets a
**doc page** in `src/examples/<component>/<Component>DocPage.tsx`. Doc
pages are not free-form — they are assembled exclusively from the
harness components in `src/examples/harness/docPage/` so that every page
looks and behaves the same.

**Required sections, in this order:**

1. **Installation** — `<InstallationTabs>` with a Command tab
   (`<CommandBlock>`) and a Manual tab (`<ManualSteps>` + `<ManualStep>`
   entries). Manual step 2 always shows the wiring snippet inside an
   `<ExpandableCode>`.
2. **Examples** — a `<DocSection>` whose children are a stack of
   `<DocSubsection>`s, each containing one `<ExampleCard hideHeader>`.
   The card pulls its preview/code/state from `src/examples/<component>/`
   (see "Per-component docs"). Examples come directly after Installation
   so a reader sees a runnable preview before any prose.
3. **Usage** — one short narrative paragraph (set via
   `<DocSection description>`) + an `<ExpandableCode>` containing a
   `<CodeViewer fitContent>` snippet that imports and renders the
   component in its simplest form.
4. **Composition** — one paragraph + one `<ExpandableCode>` snippet that
   shows the parent-child wiring (`<Steps>` / `<Step>`, `<Tabs>` /
   `<TabsTrigger>`, etc.).
5. **RTL** — one `<DocSection>` with an `<ExampleCard hideHeader>` showing
   the component wrapped in `dir="rtl"`. Skip this section ONLY when the
   component is provably direction-agnostic and write the reason in the
   doc page comment.
6. **Defined behaviour** — `<BehaviourList>` of `{ statement, testFile,
   testLine, testName }`. Statement text comes from translations; the
   test reference fields are stable code identifiers and stay verbatim.
   Every entry must point at a real test in the component's `.test.tsx`.
7. **API Reference** — one `<PropTable>` per exported component (e.g.
   one for `<Steps>`, one for `<Step>`). Column labels (Prop / Type /
   Default / Description) are deliberately not translated — they are
   JS-API concepts.

**Layout shell:** wrap the whole page in `<DocPage indexItems={…}>`.
That sets up the content column + sticky `<PageIndex>` rail with the
correct vertical rhythm (`gap-16` between top-level sections, `gap-10`
between subsections inside Examples). Do not roll a custom layout.

**Anchor ids:** do NOT prefix anchor ids with the component name. The
URL path (`/<Component>#…`) already names the component, so anchors stay
short and unique within the page — `installation`, `examples-line`,
`api-reference`, etc. Centralise them in a local `ANCHOR` constant.

**Section headings:** always render via `<SectionHeading>` (which
`<DocSection>` and `<DocSubsection>` use internally). Headings are
permalinks — clicking them updates the URL hash and the heading shows a
dim "#" anchor marker on hover.

**Inline code in prose:** any code identifier referenced inside a
translated body string (`<Steps>`, `mode="selection"`, `aria-current`)
must be rendered through `<CodeSnippet mode="inline">`. Plain text reads
as duplicate content next to live previews. Use backticks
(``\`<Steps>\```) or the bare `<TagName>` shape in source strings; the
inline-markup renderer promotes them automatically.

**Code blocks:** every multi-line snippet renders through
`<ExpandableCode>` wrapping a `<CodeViewer fitContent />`. The
combination lets the snippet show its full content height (no internal
scroll) while collapsing taller blocks behind an Expand affordance.
Never render Monaco at a fixed height inside a doc page.

**Translations:** all narrative text (section bodies, example titles +
descriptions, behaviour statements, Installation labels) goes through
the existing `Translation` interface. Only API-concept labels (Prop,
Type, Default, Description, package-manager names) stay hardcoded
English. Add new keys to `src/languages.ts` and fill them in both
`languages/en-US.ts` and `languages/de.ts` in the same change.

**Component checklist — every doc page must use:**

| Concern                          | Component                                  |
| -------------------------------- | ------------------------------------------ |
| Page shell + sticky page index   | `<DocPage>`                                |
| Top-level section (h3)           | `<DocSection>`                             |
| Sub-section (h4)                 | `<DocSubsection>`                          |
| Section heading permalink        | `<SectionHeading>` (via `<DocSection>`)    |
| Right-rail navigator             | `<PageIndex>` (via `<DocPage>`)            |
| Install command (dark, PM tabs)  | `<CommandBlock>`                           |
| Command / Manual outer tabs      | `<InstallationTabs>`                       |
| Numbered manual steps            | `<ManualSteps>` + `<ManualStep>`           |
| Live example (preview/code/state)| `<ExampleCard hideHeader>`                 |
| Multi-line code block            | `<ExpandableCode>` + `<CodeViewer fitContent />` |
| Inline code in prose             | `<CodeSnippet mode="inline">`              |
| Behaviour-to-test references     | `<BehaviourList>`                          |
| Prop reference table             | `<PropTable>`                              |

If a doc page reaches for raw `<section>` / `<h3>` / `<div className="rounded-md border">` or inline `<table>` markup, that's a missing
primitive — surface it before duplicating the layout.

# Per-component tests

Every component ships a co-located `<ComponentName>.test.tsx` next to the
source. No component lands without tests. At minimum the tests must cover:

- The default render path (component mounts without crashing, renders its
  primary affordance).
- Every distinct **mode / variant / orientation** the component supports — one
  assertion per mode that proves the visual or behavioral branch actually
  fired (e.g. selection mode does not produce check icons, inline variant
  does not use `fixed` positioning).
- Any required-context error path the component guards (e.g. "throws when
  rendered outside `<Steps>`").
- Each interactive affordance (click handlers, keyboard shortcuts) that is
  part of the public contract.

When you add a new mode/variant/prop with branching behavior, add the
corresponding test in the same change. A PR that adds a mode without a test
that exercises that mode is incomplete.

# Components — **never reach for raw HTML controls**

- Every UI control (checkbox, radio, select, input, label, button, switch,
  slider, dialog, popover, tooltip, scroll area, etc.) MUST come from this
  package. Raw HTML controls (`<input type="checkbox">`, `<input
  type="radio">`, `<select>`, `<button>`, etc.) are not allowed in app or
  demo code — they bypass theming, focus rings, dark mode, accessibility
  affordances, and keyboard behavior that the shadcn/Radix primitives give us.
- The available primitives live in `lib/components/ui/`. Higher-level
  wrappers built on top of them live in the appropriate semantic group
  (e.g. `input/SearchInput`, `input/OptionPicker`, `input/CopyValueButton`,
  `dateTime/DateTimePicker`) — prefer one of those if it fits.
- If no existing component fits the task, **stop and tell the user**; do not
  invent a one-off raw-HTML control. The fix is to add the missing primitive
  to `lib/components/ui/` (or a new wrapper in the matching semantic group
  per the taxonomy above) and then consume it everywhere.
- The only acceptable raw HTML elements are layout/text primitives (`<div>`,
  `<span>`, `<p>`, `<ul>`, `<li>`, `<a>`, `<h1>`–`<h6>`, `<form>`, `<label>`
  *only when wrapping a non-control element*, etc.). Anything that produces a
  focusable / interactive control goes through the library.

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

# Settings system

All persisted preferences (lib-owned AND consumer-app-registered) live in a
**single** `localStorage` key — `${storagePrefix}_settings` — holding one
JSON blob with this shape:

```
{ _v: 1, core: { … }, device: { … }, app: { <appKey>: { … } } }
```

- **`core`** — lib-owned and stable wire format: `theme`, `codeTheme`,
  `language`, `mapStyle`, `codeEditor`, `toast`. This is the slot that a
  future remote Settings API will sync across the user's installs.
- **`device`** — device-local ephemeral state owned by the lib: hotkey
  overrides + recent-actions MRU. Deliberately outside `core` so the
  sync API doesn't propagate per-machine state.
- **`app`** — sub-keyed by `appKey`. Each consumer app registers its
  own schema via `defineAppSettings({ appKey, schema })` and passes it
  to `<MowsProvider appSettings={…} />`. Apps read/write via
  `useAppSetting(schema, "fieldId")` — fully type-inferred from the
  schema.

Implementation lives in `lib/lib/mowsContext/`:

- `SettingsManager.ts` — owns the blob; exposes `getCore`/`setCore`,
  `getDevice`/`setDevice`, `getApp`/`setApp`, `subscribe(path)`,
  `replaceBlob`, plus `validateBlob` and `SettingsBlobValidationError`.
- `legacyMigration.ts` — one-shot read of the pre-unification keys
  (`_theme`, `_language`, …) into the new blob on first mount.
- `appSettings.ts` — `defineAppSettings`, schema types, runtime
  `matchesFieldType` guard.
- `useAppSetting.ts` — typed React hook.

User-facing docs live in `src/guides/SettingsSystemGuide.tsx` (linked
from the SettingsPanel DocPage). Never bypass `SettingsManager` to
read/write a setting directly from `localStorage` — the version check,
defaults, and subscriber notifications all live in the manager.

# Action history + undo

Every dispatch through `ActionManager.dispatchAction` becomes an audit-log
entry. Actions that opt in by returning an `UndoableAction` from
`executeAction` and declaring an `invertAction` on the same handler get
Ctrl+Z / Ctrl+Shift+Z for free.

## Storage layout

| Slot | Backend | Key | Owner |
|---|---|---|---|
| Audit log | localStorage (via SettingsManager) | `${storagePrefix}_settings → device.auditLog` | SettingsManager |
| History config | localStorage (via SettingsManager) | `${storagePrefix}_settings → device.actionHistory` | SettingsManager |
| Undo stack | sessionStorage (via UndoStackManager) | `${storagePrefix}_undoStack` | UndoStackManager |
| Redo stack | sessionStorage (via UndoStackManager) | `${storagePrefix}_redoStack` | UndoStackManager |

- **Audit log is shared across tabs** of the same origin via the existing
  localStorage `storage` event subscription in SettingsManager. Tabs see
  each other's entries; the entry's `tabId` field disambiguates.
- **Undo + redo stacks are per-tab** in sessionStorage and survive reload
  within the same tab. Ctrl+Z in tab B never reverses an action
  dispatched by tab A. Any new undoable dispatch clears the redo stack.

## Quick start — declaring a reversible action

```ts
new Action({
    id: "myapp.files.move",
    category: "Files",
    actionHandlers: new Map([[
        "handler",
        {
            id: "handler",
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: (_event, _scope, payload) => {
                const { fileId, toFolderId } = payload as { fileId: string; toFolderId: string };
                const previousFolderId = currentFolderOf(fileId);
                moveFile(fileId, toFolderId);
                return {
                    id: "",                                  // ActionManager overrides
                    actionId: "myapp.files.move",
                    forwardPayload: { fileId, toFolderId },
                    inversePayload: { fileId, toFolderId: previousFolderId },
                    timestamp: Date.now(),
                    describe: { labelKey: "actions.myapp.files.move", params: { fileId } }
                };
            },
            invertAction: (inversePayload) => {
                const { fileId, toFolderId } = inversePayload as { fileId: string; toFolderId: string };
                moveFile(fileId, toFolderId);
            }
        }
    ]])
})
```

Dispatch via `actionManager.dispatchAction("myapp.files.move", event, scopeEl, { fileId, toFolderId })`.

The worked example in the lib is `CoreActionIds.SET_THEME` (see
`coreActions.ts`) — dispatch with `{ themeId: "dark" }` and Ctrl+Z restores
the previous theme.

## Handler contract

| Field | Purpose |
|---|---|
| `executeAction` | Returns `void` (read-only action) or `UndoableAction` (reversible). |
| `invertAction(inversePayload)` | Reverses. Sync or async. Async rejections flow through the standard retry path. |
| `payloadByteBudget` | Per-handler byte budget (default 4096 via `ActionHistoryConfig.maxPayloadBytes`). 0 = opt out of payload persistence. |
| `excludeFromAuditPayload` | Audit entry is recorded but `payload` field is undefined. Use for actions whose payload may contain credentials, tokens, file contents, or PII. |
| `excludeFromUndoStack` | No undo entry created even if `executeAction` returns one. Use for sensitive irreversible actions ("Delete account"). |

`UndoableAction.inversePayload` is pure data — it round-trips through
sessionStorage between dispatch and undo. Closures don't survive a
reload; payloads do.

## Transactions

Group multiple dispatches so undo pops them as one:

```ts
actionManager.beginTransaction("renameMany");
for (const file of files) actionManager.dispatchAction("myapp.files.rename", ...);
actionManager.endTransaction("renameMany");
// One Ctrl+Z reverses all of them.
```

Transactions do not nest — a nested `beginTransaction` overwrites the
active group; `endTransaction` only clears when the key matches.

## Failure semantics

| Case | Behaviour |
|---|---|
| `invertAction` throws or rejects | `log.error` with stack, toast via the configured toaster, increment `invertRetries`, leave entry on stack for retry. Drop after `maxInvertRetries` (default 3). |
| Handler unregistered before undo | Toast "Cannot undo: action not available", drop the entry. |
| User spams Ctrl+Z while invert in flight | `pendingInverts` map per actionId — subsequent calls return without firing. Observe via `actionManager.isInvertInFlight(actionId?)`. |
| Payload exceeds budget | Audit entry recorded with `payloadDropped: "oversize"`, no undo entry pushed. Developer warning logged. |
| `excludeFromAuditPayload` | Audit entry recorded with `payloadDropped: "opt-out"`, payload undefined. |
| Storage quota exceeded | Drop oldest 50% in one eviction; if still failing, disable persistence for the session and toast. |
| Forged sessionStorage entry with unknown actionId | Treated as "missing handler" — toast + drop. No HMAC. |

## Multi-tenant

All storage keys are namespaced by `storagePrefix`. Two apps on the same
origin must use distinct prefixes; the library does not validate
uniqueness. Same caveat as the settings system.

## Built-in actions + hotkeys

| Action | Default hotkey | Behaviour |
|---|---|---|
| `CoreActionIds.UNDO` (`mows.history.undo`) | `mod+z` | Pops the top of the undo stack and runs its handler's `invertAction`. |
| `CoreActionIds.REDO` (`mows.history.redo`) | `mod+shift+z` | Pops the top of the redo stack and re-runs the forward handler with the captured `forwardPayload`. |
| `CoreActionIds.OPEN_HISTORY` (`mows.history.open`) | none | Opens `<HistoryPanel>`. |

Hotkeys go through the normal HotkeyManager flow — apps can override or
unbind them via the user-facing keyboard-shortcut editor.

## HistoryPanel

`lib/components/appShell/historyPanel/HistoryPanel.tsx`. Modal-mounted
panel listing every audit entry, with search, category filter, "undo to
here" affordance, and a two-step "Clear history" button.

- Entries from other tabs are rendered muted with no "undo to here"
  button.
- Entries whose `actionId` has no registered handler in this session
  (e.g. plugin uninstalled after dispatch) are rendered dimmed with the
  literal `actionId` displayed.
- Translation key for the dynamic action label lives at
  `t.actions[labelKey]`; `{name}`-style placeholders are interpolated by
  `formatActionLabel`. All param values render via React's default
  text-node escaping, so XSS via untrusted params is not possible from
  this path.

## Testing

`ActionManager.test.ts` covers the audit log, undo / redo, transactions,
single-flight lock, oversize-payload + opt-out branches, forged-entry
rejection, async invert failure / retry / drop, and the
HotkeyManager-event-passthrough that's load-bearing for audit-log
modifier capture. `HistoryPanel.test.tsx` covers empty state, search +
filter, "undo to here", other-tab muted rendering,
unknown-action fallback, two-step clear, and XSS-safe label rendering.

## Limitations (v1)

- No schema versioning for `inversePayload` across reloads — handlers must
  maintain backwards-compatibility on the inverse shape (or set
  `excludeFromUndoStack`).
- No grouping of adjacent same-actionId entries in the panel ("3× Move file").
- No on-source sampling / batching for `onAuditEntry` — high-frequency
  consumers should debounce in their callback.
- `beginTransaction` / `endTransaction` are not async-aware. The active
  group id is set synchronously and any dispatch between begin/end —
  including ones that run inside an `await` — joins the group. Treat
  transaction boundaries as synchronous regions.

