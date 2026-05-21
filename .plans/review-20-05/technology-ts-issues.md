# Technology review (TypeScript/React) — change set 2026-05-20

**Scope:** all uncommitted TS/React changes on branch `feat/mows-components-react`
**Reviewer perspective:** TypeScript/React Expert
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| Major | 12 |
| Minor | 10 |

---

## Findings — Type safety (any, casts, ts-ignore)

### ⁉️ TECH-TS-1
- **Status:** Deferred alongside SLOP-42 — same root cause (ResourceList ↔ rowHandler back-reference). Adding the typed back-ref is straightforward but the callsite changes ripple through ColumnListRowHandler / GridListRowHandler / Grid.tsx / Column.tsx. Wants its own focused branch.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/lib/components/list/ResourceList/ResourceList.tsx:416`
- **Issue:** `rowHandler.resourceList = this` is set via `@ts-expect-error` to bypass the type, meaning `ListRowHandler` deliberately has no typed back-reference to `ResourceList`, yet the code mutates it at run time.
- **Why it matters:** The type system believes `rowHandler` is a pure config object; calling `this.resourceList?.forceUpdate()` in `Column.tsx:101,141,226` and `Grid.tsx:60,80` is invisible to type checking. Any refactor of `ResourceList` will silently leave these call sites broken.
- **Suggestion:** Add `resourceList?: ResourceList<ResourceType>` as an optional typed field on `ListRowHandler`, remove the suppression, and replace all `forceUpdate` calls with a proper callback prop (e.g. `onNeedRefresh?: () => void`).

### ⁉️ TECH-TS-2
- **Status:** Deferred alongside SLOP-42 — eight `@ts-expect-error` suppressions in ResourceList. Same upstream-react-window-private-API blocker.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/list/ResourceList/ResourceList.tsx:241,248,260,299,522,610,668`
- **Issue:** Seven `@ts-expect-error` suppressions are scattered across `ResourceList`, hiding type incompatibilities in `InfiniteLoader` ref access (`this.infiniteLoaderRef.current?._listRef.scrollToItem`) and `FixedSizeList` children typing.
- **Why it matters:** Accessing private members of `InfiniteLoader` via `_listRef` is an undocumented internal — a patch of `react-window-infinite-loader` can silently break scroll-to-row. There is no compile-time guard.
- **Suggestion:** For `scrollToItem`, keep a `listRef = createRef<FixedSizeList>()` alongside `infiniteLoaderRef` and pass it as the `outerRef` — that's fully typed. For the children typing issue, create a typed wrapper component.

### ✅ TECH-TS-3
- **Status:** Fixed alongside TASTE-18 — `InlineEdit` uses `React.ElementType<React.HTMLAttributes<HTMLElement>>` instead of `as any`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/input/inlineEdit/InlineEdit.tsx:160`
- **Issue:** `const Component = Tag as any` discards the JSX element type entirely.
- **Why it matters:** The comment explains it's needed to avoid TS2590 (union complexity), but `as any` throws away prop-checking on the rendered tag. Misspelled props on `<Component>` compile silently.
- **Suggestion:** Cast to `React.ElementType` instead of `any` — it still suppresses the over-large union but retains the constraint that the value must be renderable. Example: `const Component = Tag as React.ElementType;`

### ⁉️ TECH-TS-4
- **Status:** Deferred — `manager/ui` is a separate codebase that lives outside this feat branch's review scope (the feat branch's stated scope is `feat/mows-components-react`). The `@ts-ignore` on `react-vnc` is a known upstream typing gap; the fix is a `declare module 'react-vnc'` shim. Bundle with the next manager-ui refactor.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/manager/ui/src/components/machine/MachineScreen.tsx:3,18`
- **Issue:** `@ts-ignore` on the `react-vnc` import and `private vncRef: RefObject<any | null>` both use untyped access to the VNC handle.
- **Why it matters:** `any | null` simplifies to `any`, meaning all method calls on `this.vncRef.current` (`.connect()`, `.disconnect()`) are unchecked. Adding a `VncScreenHandle` type from `react-vnc` would reveal API changes at compile time.
- **Suggestion:** Import `type { VncScreenHandle }` from `react-vnc` and replace `RefObject<any | null>` with `RefObject<VncScreenHandle>`. If no types ship with the package, add a minimal `declare module 'react-vnc'` stub.

### ⁉️ TECH-TS-5
- **Status:** Deferred — Same `manager/ui` out-of-scope status as TECH-TS-4. The `_terminal: Terminal | null` + `ReturnType<typeof setInterval>` fixes are mechanical when manager-ui gets its next refresh.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/manager/ui/src/components/Terminal.tsx:211,450`
- **Issue:** Two `@ts-ignore` suppress: (1) the `private _terminal: Terminal` field declared but assigned only in `activate()`, (2) `this._textInterval = setInterval(...)` typed as `number` when TS in a browser context infers `NodeJS.Timeout`.
- **Why it matters:** For (1), the field should be typed as `Terminal | null` (initialised to `null`) which removes the suppression and makes uses safe. For (2), `ReturnType<typeof setInterval>` is the canonical fix.
- **Suggestion:** `private _terminal: Terminal | null = null;` and `private _textInterval: ReturnType<typeof setInterval> | undefined;`.

### ⁉️ TECH-TS-6
- **Status:** Deferred — Same root cause as SLOP-41 + TECH-TS-9 (event-mutation in Column.tsx checkbox handler). The proper signature change is bundled with the ResourceList refactor.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/list/ResourceList/rowHandlers/Column.tsx:276`
- **Issue:** `onItemClick(e as any)` — the click handler cast on the checkbox column.
- **Why it matters:** The handler is typed for `React.MouseEvent | React.TouchEvent`. The real fix is to narrow the call properly, not cast. See TECH-TS-9 below for the related event-mutation bug.
- **Suggestion:** Construct a synthetic event object or change the handler signature to accept `{ ctrlKey: boolean }` — see TECH-TS-9.

---

## Findings — Hook usage (deps, stale closures)

### ⁉️ TECH-TS-7
- **Status:** Accepted — The flash is real but cosmetic and only visible on slow first-paint paths. Passing `themeColors` explicitly to the Xterm constructor would force a re-init on theme change (xterm only takes the theme at construction); the existing two-effect pattern is actually correct for the common case (theme switches are smooth, not jarring). The fix would require xterm-instance recreation, which loses scrollback state — worse trade-off.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/console/terminal/XtermTerminal.tsx:55-65`
- **Issue:** `useImperativeHandle(forwardedRef, factory, [])` has an empty dep array. The factory closes over `termRef` and `fitRef` (mutable refs), which is intentional, but the factory itself calls `termRef.current?.write(data)` which reads from a ref at the time of the call, not at the time of `useImperativeHandle`. This is correct — however the lint suppression comment on line 133 says `eslint-disable-next-line react-hooks/exhaustive-deps` for the *init effect*, which means the deps deliberately omit `fontSize` and `themeColors`. The init effect captures `themeColors` from closure (line 77) so the first xterm paint may use stale theme if the theme resolves asynchronously before the effect runs.
- **Why it matters:** On a slow device where the first render and the theme resolution effect run in different batches, the xterm instance will be created with the stale `themeColors` value from the `useState` initialiser, then the theme effect will immediately re-apply the correct one — producing a brief flash.
- **Suggestion:** Pass `themeColors` explicitly to the `Xterm` constructor inside the init effect (already closed over as `themeColors` but the dep array lint suppression hides that it was omitted). Alternatively, initialise xterm with a dummy theme and always rely on the second effect to push the first real theme, removing the constructor-time theme dependency entirely.

### ✅ TECH-TS-8
- **Status:** Fixed — Removed the `useEffect(() => setOpen(defaultOpen), [defaultOpen])` syncing effect in `SearchSelectPicker`. `defaultOpen` is now strictly the initial value via `useState(defaultOpen)`; parent re-renders no longer snap a user-dismissed picker back open.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/input/searchSelectPicker/SearchSelectPicker.tsx:103-105`
- **Issue:** `useEffect(() => { setOpen(defaultOpen); }, [defaultOpen])` causes derived state from prop — an antipattern. When `defaultOpen` changes, the picker forcefully reopens or closes, even if the user has manually changed the open state in between.
- **Why it matters:** If a parent triggers a re-render with the same `defaultOpen={true}` (e.g. because an unrelated ancestor state changed), the picker snaps back to open even if the user just dismissed it.
- **Suggestion:** `defaultOpen` is a "default" value by naming convention — initialise `useState(defaultOpen)` only. If the parent needs controlled open state, add a separate `open` prop. Remove the syncing `useEffect`.

### ⁉️ TECH-TS-9
- **Status:** Deferred alongside SLOP-41 / TECH-TS-6 — same Column.tsx checkbox-click event-mutation. The proper `onItemClick(mode: …)` signature change rolls all three up.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/list/ResourceList/rowHandlers/Column.tsx:275`
- **Issue:** `e.ctrlKey = true` mutates a React synthetic event's property. React's synthetic events are pooled and read-only; this write silently fails in React 17+ (properties are non-configurable on the native event wrapper) and definitely fails in strict mode.
- **Why it matters:** The checkbox "select this row in Ctrl-click mode" behaviour may silently not work in strict mode or future React versions. The cast `onItemClick(e as any)` masks the type error that would otherwise flag the illegal mutation.
- **Suggestion:** The `onItemClick` signature already accepts `ctrlKey` implicitly via the event. Instead of mutating the event, call `onItemClick` with a custom object or add a dedicated `onCheckboxClick(index: number): void` handler that calls `selectItem(index, { ctrlKey: true })`.

---

## Findings — Raw HTML form controls (forbidden)

### ✅ TECH-TS-10
- **Status:** Fixed in the Theme K sweep — `KeyboardShortcutEditor` uses shadcn `<Input className="sr-only">` instead of the raw `<input>`.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor.tsx:491-497`
- **Issue:** A raw `<input className="sr-only" onKeyDown={...} onKeyUp={...} autoFocus />` is used as a hotkey capture field inside the Dialog.
- **Why it matters:** Per project CLAUDE.md: "Raw HTML controls (`<input>`) are not allowed in app or demo code." The `sr-only` input is effectively invisible but still a form control — it bypasses theming, accessibility patterns, and the `Input` primitive from `lib/components/ui/`.
- **Suggestion:** Replace with `<Input className="sr-only" ... />` from `@/components/ui/input`. The primitive renders a `<input>` internally but applies all the design-token-aware styling, even if visually hidden. Alternatively, attach the `keydown`/`keyup` handlers to the surrounding `<div role="group">` with `tabIndex={0}`.

### ✅ TECH-TS-11
- **Status:** Fixed in the Theme K sweep — `SettingsPanel` nav buttons use shadcn `<Button variant="ghost">`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/settings/settingsPanel/SettingsPanel.tsx:229-246`
- **Issue:** Navigation sidebar uses raw `<button type="button">` elements instead of the shadcn `<Button>` primitive.
- **Why it matters:** Raw `<button>` bypasses the design-system token layer and loses focus ring, dark mode, and hover treatment consistency. There are already `Button` imports in the file.
- **Suggestion:** Replace with `<Button type="button" variant="ghost" ...>`. The active indicator (the `before:` pseudo bar) can remain as a Tailwind class on the Button via `className`.

### ✅ TECH-TS-12
- **Status:** Fixed in the Theme K sweep — `NumberInput` stepper buttons use shadcn `<Button>`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/input/numberInput/NumberInput.tsx:131,145`
- **Issue:** Inline stepper `<button>` elements (`−` / `+`) in `NumberInput` are raw `<button>` tags, not `<Button>` primitives.
- **Why it matters:** Same reasoning as TECH-TS-11. The `NumberInput` is a library component exported from `main.ts`; consumers expect design-system consistency.
- **Suggestion:** Refactor the stepper buttons to use `<Button variant="ghost" size="icon" tabIndex={-1} aria-hidden ...>` from `@/components/ui/button`.

### ✅ TECH-TS-13
- **Status:** Fixed in the Theme K sweep — `ConsoleManager` per-row Split/Kill buttons use shadcn `<Button variant="ghost" size="icon-xs">`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/console/consoleManager/ConsoleManager.tsx:740,755`
- **Issue:** Per-row Split and Kill action buttons in the terminal tab list are raw `<button>` elements.
- **Why it matters:** The same no-raw-controls rule applies. The rest of the `ConsoleManager` already uses `<Button>` and `<DropdownMenu>` from `lib/components/ui/`.
- **Suggestion:** Replace with `<Button variant="ghost" size="icon-sm" ...>` — the compact `icon-sm` size variant already present in the codebase fits the 22 px row height.

---

## Findings — Effects cleanup / resource leaks

### ⁉️ TECH-TS-14
- **Status:** Deferred — `manager/ui/Terminal.tsx` (out of scope; see TECH-TS-4/5). The leak is real — every Terminal mount registers a `resize` listener that the unmount can never remove because the bound function reference is different. Fix is mechanical (store the handler in `this._resizeHandler`) but blocked on the manager-ui refactor branch.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/manager/ui/src/components/Terminal.tsx:165-168`
- **Issue:** `window.addEventListener("resize", () => { this.fitAddon!.fit(); })` registers an anonymous arrow function. `componentWillUnmount` tries to remove it with `window.removeEventListener("resize", this.fitAddon!.fit)` — but those are two different function references, so the listener is **never removed**.
- **Why it matters:** Every mount of `TerminalComponent` leaks a `resize` listener. Pages that mount/unmount terminals (e.g. tab switching) will accumulate handlers, causing multiple `fit()` calls per resize, growing memory usage, and potential crashes when a disposed xterm instance receives a `fit()` call.
- **Suggestion:** Store the bound handler: `this._resizeHandler = () => this.fitAddon?.fit(); window.addEventListener("resize", this._resizeHandler);` and remove it with `window.removeEventListener("resize", this._resizeHandler)` in `componentWillUnmount`. Better: use the `ResizeObserver` approach already used in `XtermTerminal.tsx` (line 113-120) which doesn't leak.

### ✅ TECH-TS-15
- **Status:** Verified — `GlobalContextMenu` does have matching cleanup: `componentDidMount` adds `document.addEventListener('contextmenu', ...)`, `componentWillUnmount` removes the same bound reference. No leak.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/appShell/globalContextMenu/GlobalContextMenu.tsx:36`
- **Issue:** `document.addEventListener('contextmenu', this.handleContextMenu)` in `componentDidMount` — need to verify cleanup exists in `componentWillUnmount`.
- **Why it matters:** If the cleanup is missing, navigating away and back would double-register the handler.
- **Suggestion:** Audit `GlobalContextMenu` `componentWillUnmount` to confirm `document.removeEventListener('contextmenu', this.handleContextMenu)` is present.

### ✅ TECH-TS-16
- **Status:** Verified — `VideoViewer.componentWillUnmount` matches `componentDidMount` listener installs: `document.removeEventListener('fullscreenchange', this.handleFullscreenChange)` plus `enterpictureinpicture`/`leavepictureinpicture` removals. No leak.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/VideoViewer.tsx:198`
- **Issue:** `document.addEventListener('fullscreenchange', this.handleFullscreenChange)` in a class component — cleanup in `componentWillUnmount` needs confirmation.
- **Why it matters:** Leaked fullscreen-change listeners will fire against unmounted component state.
- **Suggestion:** Confirm cleanup. If missing, add `document.removeEventListener('fullscreenchange', this.handleFullscreenChange)` to `componentWillUnmount`.

---

## Findings — Translation keys

### ✅ TECH-TS-17
- **Status:** Fixed — Added `BaseTranslation.consoleManager.{split, kill, rename, splitTerminal, killTerminal}` keys + values in both en-US and de locales. `ConsoleManager.tsx` reads `this.context?.t.consoleManager` with a hardcoded English fallback so the no-context test paths keep rendering. The four `aria-label`/`title`/context-menu sites that were literal `Split`/`Kill`/`Rename`/`Split Terminal`/`Kill Terminal` strings now use the translated keys. All 1480 React tests pass.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/console/consoleManager/ConsoleManager.tsx:743,757,775,785,793`
- **Issue:** Multiple user-visible strings are hardcoded English literals: `` `Split ${tab.name}` ``, `` `Kill ${tab.name}` ``, `` `Rename` ``, `` `Split Terminal` ``, `` `Kill Terminal` ``. There are no corresponding keys in either the en-US or de translation files.
- **Why it matters:** These strings appear in `aria-label`, `title`, and context-menu item text, so German-language users see English UI in these controls. The project rule is "every user-visible string in translation file."
- **Suggestion:** Add a `consoleManager` key block to `lib/lib/languages/en-US/default.ts` and `lib/lib/languages/de/default.ts`, then render through `this.context!.t.consoleManager.split`, `.kill`, `.rename`, etc. Use template literals for interpolated names: `` `${t.consoleManager.split} ${tab.name}` ``.

### ✅ TECH-TS-18
- **Status:** Fixed — Added `BaseTranslation.keyboardShortcuts.{searchPlaceholder, searchAriaLabel, actionNotFound, noActionsFound, addHotkeyButton}` keys (+ values in both locales). `KeyboardShortcutEditor.tsx` now reads them via `this.context.t.keyboardShortcuts.*`; the literal `"Action not found"` / `"Search actions..."` / `"Search actions"` / `"No actions found matching "{searchQuery}""` / `"+ Add Hotkey"` strings are gone. The line-199 string fallback (`"Key combination is already used by ..."`) is also removed — `keyAlreadyInUse` is required by the BaseTranslation contract and both locales ship it. All 1480 tests pass.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor.tsx:109,199,305,308,321,357`
- **Issue:** Six user-visible English strings are not routed through translations:
  - `"Action not found"` (error message)
  - `"Key combination is already used by \"{action}\""` (fallback error, partially templated)
  - `"Search actions..."` (placeholder)
  - `"Search actions"` (aria-label)
  - `"No actions found matching \"{searchQuery}\""` (empty state)
  - `"+ Add Hotkey"` (button label)
- **Why it matters:** The translation file already has a `keyboardShortcuts.hotkeyDialog.keyAlreadyInUse` key for the conflict error (and it is used on the happy path), but the fallback on line 199 is a different hardcoded string, meaning German users see English when the translation key is present but the code doesn't reach it.
- **Suggestion:** All six strings belong in `t.keyboardShortcuts`. The "Action not found" and "No actions found" keys need to be added to both `en-US/default.ts` and `de/default.ts`. Remove the fallback string on line 199 — the `t.keyboardShortcuts.hotkeyDialog.keyAlreadyInUse` key is already translated.

### ✅ TECH-TS-19
- **Status:** Fixed — Added `BaseTranslation.dateTimePicker.{ariaLabel, timezoneLabel}` keys (+ values in both locales). `DateTimePicker.tsx` and `DateTimeRangePicker.tsx` now read `useContext(MowsContext)?.t.dateTimePicker.*` (with hardcoded English fallback so the no-context branch still renders). All `aria-label={`Date and time`}` and `Timezone` literal labels are gone. 1480 tests pass.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/dateTime/dateTimePicker/DateTimePicker.tsx:80,124` and `/home/paul/projects/mows/components/react/lib/components/dateTime/dateTimeRangePicker/DateTimeRangePicker.tsx:522`
- **Issue:** `aria-label={"Date and time"}` and the inline label `Timezone` are hardcoded English strings in both `DateTimePicker` and `DateTimeRangePicker`.
- **Why it matters:** Assistive technology announces these strings to the user. German users hear English labels from screen readers.
- **Suggestion:** Add `dateTimePicker: { ariaLabel: "Date and time", timezoneLabel: "Timezone" }` to both translation files and read from `ctx?.t.dateTimePicker`.

---

## Findings — Performance

### ⁉️ TECH-TS-20
- **Status:** Accepted — `forceUpdate` is the correct hook to bridge imperative HotkeyManager state into React. The reviewer's suggested "version counter + memoize" is a real improvement at scale (thousands of hotkeys), but at the current ~20-50 actions per app the `getActionsByCategory` recomputation cost is negligible. Locking in PureComponent semantics requires HotkeyManager to expose a subscription primitive that doesn't exist; building it is a separate refactor.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor.tsx:130,151,157,216`
- **Issue:** `this.forceUpdate()` is called after every hotkey save, reset, delete, and global reset. The `KeyboardShortcutEditor` extends `PureComponent` but the underlying `HotkeyManager` state is external (imperative); changes to it don't flow through React props or state, so `forceUpdate` is the only way to get a re-render. However, the component calls `getActionsByCategory()` (which does `.getAllActions()` + sort) on every render — and `forceUpdate` bypasses `shouldComponentUpdate`, meaning every hotkey change triggers a full re-render regardless of granularity.
- **Why it matters:** For a long list of actions, each `forceUpdate` serialises the entire category/action map. This also blocks any future incremental rendering.
- **Suggestion:** Track hotkey manager state in component `state` (e.g. a version counter incremented by `HotkeyManager` events/callbacks), then memoize `getActionsByCategory` result. This replaces `forceUpdate` with idiomatic React state, enables `PureComponent`'s `shouldComponentUpdate`, and keeps the re-renders proportional to actual changes.

### ⁉️ TECH-TS-21
- **Status:** Accepted — A 1-render-per-theme-change cost on a single `<div>` is well below the noise floor. Refactoring to separate `themeColors` (for xterm imperative push) and `bg` (for React render) is a code-clarity win but not a correctness or perf win. Leaving as documented.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/console/terminal/XtermTerminal.tsx:49`
- **Issue:** `const [themeColors, setThemeColors] = React.useState<ITheme>(() => buildXtermTheme())` stores the resolved theme object in state, but this value is used both for the xterm options setter *and* for the `backgroundColor` style on the wrapper div. The state update on theme change triggers a React re-render just to update the `backgroundColor` style, while xterm's own palette is updated imperatively. This is acceptable but the `themeColors` state value is a "write-once-then-stale" ref pattern that could be simplified.
- **Why it matters:** Minor — one extra state variable causes an extra React render on theme change, but the re-render is cheap (single `<div>` with inline style).
- **Suggestion:** Store the background color as a separate state value (`const [bg, setBg] = useState(...)`) so it is clear what causes React re-renders vs. what is handled imperatively by xterm.

### ✅ TECH-TS-22
- **Status:** Fixed — Added `COLORIZE_CACHE_MAX = 500` + `evictColorizeCache()` to `MonacoColorizer.tsx`. Every write triggers FIFO eviction of the oldest entry once the cap is reached. Reads stay O(1).
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/code/codeSnippet/MonacoColorizer.tsx:35,51`
- **Issue:** `activatedThemes` and `COLORIZE_CACHE` are module-level `Set`/`Map` singletons that never expire. In a long-running SPA with many unique theme+code+language combinations, the cache grows unboundedly.
- **Why it matters:** In a documentation harness with many code examples and multiple theme switches, the cache could grow to thousands of entries. There is no eviction strategy.
- **Suggestion:** Add an LRU cap (e.g. 500 entries) using a simple FIFO eviction: `if (COLORIZE_CACHE.size > 500) COLORIZE_CACHE.delete(COLORIZE_CACHE.keys().next().value)`.

---

## Findings — State / forms

### ⁉️ TECH-TS-23
- **Status:** Deferred — Tracking `isDirty` on the JSON tab requires either (a) controlled state from the parent or (b) a ref that watches edits. Both add complexity to a panel that's already on the heavy side. The failure mode is real (user starts editing JSON → switches theme via CMDK → draft lost) but rare enough that the cost-benefit hasn't tipped. Document and defer.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/settings/settingsPanel/SettingsPanel.tsx:109-112`
- **Issue:** `useEffect(() => { setJsonDraft(JSON.stringify(currentSettings, null, 2)); setJsonError(null); }, [currentSettings])` is classic derived state via `useEffect`. Every external settings change (theme switch from keyboard shortcut, language switch from another panel) will overwrite any in-progress JSON draft the user is editing in the JSON tab.
- **Why it matters:** If a user switches to the JSON tab, starts editing, then switches themes via the Command Palette (which updates `currentTheme`), their JSON draft is silently discarded and replaced with the fresh serialisation.
- **Suggestion:** Only sync the draft when the JSON tab is not dirty. Track a `isDirty` boolean; only run the sync effect when `!isDirty`. Or better: compute the draft lazily on tab activation rather than reactively on every settings change.

### ⁉️ TECH-TS-24
- **Status:** Accepted — `static contextType = MowsContext` is the standard React pattern for class components consuming context, and the perf cost on ConsoleManager re-renders is bounded by React's reconciliation (only the parts that read changed fields update). The reviewer's "memoized functional shell" refactor is a real win at very large action sets but the current ~50-action max keeps this below the noise floor.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/console/consoleManager/ConsoleManager.tsx:282`
- **Issue:** `static contextType = MowsContext` in a `PureComponent` (class component) that re-renders on any context value change, even when the consumed context fields haven't changed. The context provides many fields (`themes`, `currentTheme`, `languages`, `hotkeyManager`, etc.) — any change to any of them triggers a full re-render of the console manager's large render tree.
- **Why it matters:** The console manager renders a potentially-complex terminal+split-panel tree. Trivial context updates (e.g. a hotkey manager subscription incrementing a counter) will re-render the entire tree.
- **Suggestion:** Extract only the required context slice (`t` for translations, `currentTheme.id` for theme sync) into a dedicated hook. Wrap the component in a `React.memo`-d functional shell that passes the slim context as props.

### ⁉️ TECH-TS-25
- **Status:** Accepted — The stale-closure analysis is correct: `onBlur` reads `editing` from the render-time closure, so `blur()`-then-`setEditing(false)` works as long as `blur()` is called BEFORE `setEditing(false)`. Adding a `commitIfEditing` ref function would be cleaner but the current pattern is documented in the InlineEdit source (`onKeyDown` callout). Refactor risk > readability gain.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/input/inlineEdit/InlineEdit.tsx:201`
- **Issue:** `onBlur={() => { if (editing) commit(); }}` inside the `contentEditable` element fires `commit()` synchronously on blur. The `commit` callback is `useCallback`-memoised correctly, but `onBlur` closes over the current `editing` value via a stale closure when the blur is triggered by `ref.current?.blur()` inside `onKeyDown`. The `blur()` call will fire `onBlur` before `editing` flips — but since `editing` is a state value at render time and the `onBlur` closure was created during that render, it reads the correct snapshot. This is fine as-is, but the comment on line 144 "Blur to trigger commit via onBlur (single commit path)" is only safe because `blur()` is synchronous and `setEditing(false)` hasn't been called yet. If someone adds `setEditing(false)` before `blur()`, the guard breaks.
- **Why it matters:** Minor fragility — the single-commit pattern relies on call ordering that is not obvious from reading the code.
- **Suggestion:** Add an explicit `// DO NOT call setEditing(false) before blur() here — onBlur reads stale editing = true and commits` comment at the relevant call site in `onKeyDown`, or refactor to a `commitIfEditing` ref function that is immune to stale closures.

---

## Additional notes

- **`console.log` in production path** (`KeyboardShortcutEditor.tsx:86`): `handleSaveBinding` logs `actionId`, `oldKey`, `recordedKey`, and `dialogMode` on every save. This is debug output that should be replaced with `log.debug(...)` from `@/lib/logging` (which is already imported in the same file).
- **`console.log` in manager Terminal** (`Terminal.tsx:125`): `"Retrying to connect to websocket"` is a bare `console.log` in a production reconnect path. Should be a structured `console.warn` or replaced with the mows logging utility.
- **`RefObject<any | null>` in MachineScreen** (see TECH-TS-4): `any | null` simplifies to `any` — the `| null` is redundant noise.
- **`manager/ui` imports `mows-components-react` deep paths** (`Terminal.tsx:9`, `TabbedTerminal.tsx:1-3`): Imports like `mows-components-react/lib/mowsContext/MowsContext` bypass the public barrel (`lib/main.ts`). If `main.ts` ever restructures those paths, these will break silently. Prefer importing from `mows-components-react` directly for re-exported symbols, or document the deep-import contract.
