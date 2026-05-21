# Documentation review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** Documentation Engineer
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| Major | 16 |
| Minor | 16 |

Headline issues:

- **177 broken / off-by-one test-line references across 39 of 66 DocPages.** The harness's
  `BehaviourList` renders these as deep-links into the CodeViewer (`revealLine`), so wrong
  values mean readers land on the wrong test — a fully user-visible failure.
- **`README.md` ships an "import from `atoms/`" snippet that no longer resolves** after
  the taxonomy refactor.
- **MIGRATION.md is stale on two axes at once:** the locked section-order contract
  contradicts both CLAUDE.md and the actual DocPages, and it still lists ~20 components
  as ❌ that already have a committed DocPage in `src/examples/`.
- **`components/react/CLAUDE.md` taxonomy section is inaccurate** for 4 of 12 component
  groups (omitted components and a wrong export name for `DateTimeDisplay`).
- Multiple component-level `.md` files have under-documented prop tables — e.g.
  `Image360Viewer.md` lists 6 of 12 props on the live interface, and the docpage prop
  table omits `smoothTransitions`.
- `ConsoleManagerDocPage.tsx` references a set of tests that **no longer exist** in
  `ConsoleManager.test.tsx`; the BehaviourList rows there will all open a "Test source
  not found" / wrong-test view.

---

## Findings — Component-level md files

### ✅ DOC-1
- **Status:** Fixed — Props table expanded from 6 to 12 entries (all of `Image360ViewerProps`). `defaultZoomLvl` description corrected to match source JSDoc. `markers` entry now carries the SECURITY-12 reminder about HTML-marker / tooltip.content sanitisation.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/Image360Viewer.md:24-33
- **Issue:** The Props table lists only 6 of the 12 props on the actual `Image360ViewerProps`
  interface. Missing props: `minFov`, `maxFov`, `onHeadingChange`, `markers`, `onMarkerClick`,
  `smoothTransitions`. The interface (Image360Viewer.tsx:15-70) documents them all with full
  JSDoc, including a substantial "virtual-tour scene swap" semantics paragraph on `markers`.
- **Why it matters:** A reader using `.md` as their reference will believe the panorama
  viewer is a near-trivial 6-prop wrapper. They will never discover the full
  marker / hotspot / compass-integration API, and will reinvent the same affordance
  elsewhere (already the de-facto problem this package exists to prevent).
- **Suggestion:** Add the missing rows. The `Image360ViewerDocPage.tsx` PropTable (which
  has 11 of 12 props) is a near-complete model — add `smoothTransitions` from the
  source's JSDoc and copy that table into the `.md`. While here, fix the
  `defaultZoomLvl` description: the `.md` says "Photo Sphere Viewer scale, default 0",
  but the source comment is "Initial zoom level 0..100, where 0 maps to `maxFov`
  (widest) and 100 maps to `minFov` (tightest). Default keeps the initial FOV close
  to Photo Sphere Viewer's stock 90°."

### ✅ DOC-2
- **Status:** Fixed — Added `chapters` row to `VideoViewer.md` props table. Description points readers back to the "Chapters" narrative section above for the full shape.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/VideoViewer.md:160-173
- **Issue:** Props table omits `chapters: ReadonlyArray<Chapter>`, which is documented at
  length in the same file ("### Chapters") and exists in `VideoViewerProps`
  (VideoViewer.tsx:68-72) with full JSDoc.
- **Why it matters:** The "Chapters" section reads as "pass `chapters` and they show up",
  but the props table is silent on it, so anyone scanning for the API surface (which is
  the normal use of a Props table) will miss it.
- **Suggestion:** Add a row to the Props table:
  ```
  | `chapters` | `ReadonlyArray<Chapter>` | YouTube-style chapters. When provided, renders tick marks on the seek bar and surfaces chapter titles in the hover/drag tooltip. |
  ```

### ✅ DOC-3
- **Status:** Fixed — `FileViewer.md` step 1 acknowledges the actual repo layout: simple viewers go flat (`ImageViewer.tsx`), complex viewers get a paired helper folder (`VideoViewer.tsx` + `formats/videoViewer/`).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/FileViewer.md:46-49
- **Issue:** "Adding a new format" step 1 says "Add a `formats/<Name>.tsx` next to the
  existing `ImageViewer` / `Image360Viewer`. Keep it a self-contained component …".
  But the actual repo has a mixed layout: simple formats are siblings
  (`ImageViewer.tsx`, `Image360Viewer.tsx`) but `VideoViewer.tsx` is paired with a
  helper subfolder `formats/videoViewer/` containing `ControlBar.tsx`,
  `frameGrabber.ts`, `keyboard.ts`, `SeekPreview.tsx`, `shakaModule.ts`, etc. The
  guidance contradicts the reference implementation.
- **Why it matters:** A contributor adding a non-trivial format (e.g. an audio waveform
  player) will either flatten everything to follow the docs and produce a 2k-LOC
  monolith, or copy the VideoViewer layout and feel they're violating the spec.
- **Suggestion:** Update step 1 to: "Add either a `formats/<Name>.tsx` (for simple
  viewers) or a `formats/<Name>.tsx` plus a `formats/<name>/` folder for helpers
  (mimetype detection, control bars, decoder modules, etc.) — see `VideoViewer.tsx`
  and `formats/videoViewer/` for the helper-folder pattern."

### ✅ DOC-4
- **Status:** Fixed — `FileViewer.md` dispatch table row for `isVideoOrStream(mimeType)` now spells out the concrete mime-type match list (`video/*`, `application/dash+xml`, `application/x-mpegURL`, `application/vnd.apple.mpegurl`) directly in the row, plus a follow-up paragraph noting the helper as the canonical match list.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/FileViewer.md:17
- **Issue:** Dispatch table claims `mimeType.startsWith("image/") && is360` is checked
  before `mimeType.startsWith("image/")` (correct semantically), but the table omits
  the streaming-manifest mime-type expansion. The narrative text just below already
  covers it; the table doesn't.
- **Why it matters:** The table reads as a complete dispatch reference; readers cross-
  reference it against bug reports. Subtle but lossy.
- **Suggestion:** Replace the `isVideoOrStream(mimeType)` row with two narrowly-scoped
  rows or extend the cell description to list the concrete mime types
  (`video/*`, `application/dash+xml`, `application/x-mpegURL`, `application/vnd.apple.mpegurl`).

### ✅ DOC-5
- **Status:** Fixed — `CodeSnippet.md` opening paragraph rewritten to mention the lazy `ensureShikiMonacoReady` bootstrap before the `monaco.editor.colorize` call, plus the `safeColorizedHtml` defense-in-depth guard (SECURITY-21).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeSnippet/CodeSnippet.md:4
- **Issue:** Says "Internally it calls `monaco.editor.colorize(code, language,
  { tabSize: 4 })`". The actual code (`MonacoColorizer.tsx:66-69`) requires
  `ensureShikiMonacoReady(monaco)` to run first to register Shiki themes; only then is
  `monaco.editor.colorize` called. Plain `monaco.editor.colorize` without that bridge
  produces uncoloured output.
- **Why it matters:** A reader who tries to "do the same trick without `CodeSnippet`"
  (the doc's own framing in "Why not just `<code>`?") will hit unhighlighted text and
  not understand why.
- **Suggestion:** Replace the sentence with: "Internally it calls
  `monaco.editor.colorize(code, language, { tabSize: 4 })`, after lazily bootstrapping
  Monaco + Shiki via the package's `ensureShikiMonacoReady` bridge so the Shiki
  themes are registered with Monaco first." Or simpler — drop the "internally" detail
  and just describe the observable behaviour.

### ✅ DOC-6
- **Status:** Fixed — Source JSDoc updated: "wraps in `<code>` styled as an inline chip" (was `<span>`). Matches the runtime render path in `MonacoColorizer.tsx`.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeSnippet/CodeSnippet.tsx:20-22
- **Issue:** Source JSDoc says inline mode "wraps in `<span>` styled like a `<code>`
  chip". The actual render path (`MonacoColorizer.tsx:142`) wraps in `<code>`. Only the
  inner highlight wrapper is a `<span>`. The `.md` (line 28) is right; the source JSDoc is
  wrong.
- **Why it matters:** Future contributors reading the JSDoc may "fix" the `<code>` to
  match it and break the inline-element semantics (`<code>` carries semantic meaning,
  `<span>` doesn't).
- **Suggestion:** Fix the JSDoc: "wraps in `<code>` styled as an inline chip".

### ✅ DOC-7
- **Status:** Fixed — `PrimaryMenu.md` Notes section now uses imperative phrasing ("Mount exactly one…") and explains the `GlobalOpenPrimaryMenu` handler-id collision + the `variant` prop as the canonical solution.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/appShell/primaryMenu/PrimaryMenu.md:84-86
- **Issue:** Notes section says "Only one `PrimaryMenu` should be mounted at a time —
  it registers the global `OPEN_PRIMARY_MENU` action handler on mount." This is true
  but understated: mounting a second one *will* overwrite the first because the handler
  id `GlobalOpenPrimaryMenu` is hardcoded (PrimaryMenu.tsx:90). The doc reads as
  guidance; the code makes it a hard requirement.
- **Why it matters:** A reader mounting a second PrimaryMenu (e.g. one fixed, one
  inline as a sidebar footer for an experiment) will see action dispatch flip
  arbitrarily based on render order.
- **Suggestion:** Update the note: "Mount exactly one `<PrimaryMenu>` at a time —
  every instance registers the global `OPEN_PRIMARY_MENU` action handler under the
  same id (`GlobalOpenPrimaryMenu`), so the most recently mounted instance wins.
  Use the `variant` prop instead of two mounts to support different layouts."

### ✅ DOC-8
- **Status:** Fixed — `FileIcon.md` States section now lists three rows: Found / Icon name not in map / Image load error. Each explains when it fires and (for the new "not in map" state) points readers at `vite-plugins/fileIconsVirtual.ts` as the likely root cause.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileIcon/FileIcon.md:20-28
- **Issue:** The "States" section describes two states ("Found" and "Image load
  error"), but the actual code (FileIcon.tsx:47-56) takes the lucide-File fallback
  path on **either** `!iconUrl` or `imageFailed`. The first condition (`iconUrl ===
  null`) happens when `vscode-material-icons` returns a name not present in
  `iconUrlMap`. The .md asserts "resolution always succeeds because
  `getIconForFilePath` always returns a valid `MaterialIcon` name", missing the
  second fallback gate.
- **Why it matters:** Anyone debugging why a known-good file shows the generic
  `File` glyph instead of a Material icon will trust the docs and look for
  `<img>`-onError firing — when the actual cause may be `iconUrlMap` missing the
  resolved name (icon set was bumped, virtual module didn't pick it up, etc.).
- **Suggestion:** Add a third State row: "**Icon name not in map** — `lookupIconUrl`
  returned `null`. Falls back to the lucide `File` glyph without firing an `<img>
  onError`. Indicates the virtual `mows-file-icons` module didn't ship the name
  `getIconForFilePath` produced; check `vite-plugins/fileIconsVirtual.ts`."

### ✅ DOC-9
- **Status:** Fixed alongside REPO-9 — `steps.md:131` points at `src/examples/steps/StepsDocPage.tsx` and lists the actual modes shipping today.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/ui/steps.md:131-132
- **Issue:** Last bullet under Notes claims demos live at "`src/uiDemos.tsx` — `Steps
  (Horizontal)` and `Steps (Vertical)` panes under the UI primitives group". The
  current demos live under `src/examples/steps/` with `Horizontal.tsx`,
  `Vertical.tsx`, `Wizard.tsx`, `Selection.tsx`, `StatusOverride.tsx`, `Disabled.tsx`,
  `Icons.tsx`, `RTL.tsx`; the canonical view is `src/examples/steps/StepsDocPage.tsx`.
  `src/uiDemos.tsx` no longer exists in this layout.
- **Why it matters:** A new contributor following the breadcrumb will fail to find
  the file. Even worse, they'll think the doc is so out-of-date everything else is
  suspect — and may then assume the harness contract isn't real.
- **Suggestion:** Replace the bullet with: "Demos: `src/examples/steps/` (one file
  per variant), composed into `StepsDocPage.tsx` via the doc-page harness. See
  `.plans/component-demo-harness/MIGRATION.md` for the contract."

### ✅ DOC-10
- **Status:** Fixed — Rewrote `lib/components/list/ResourceList/ResourceList.md` to follow the per-component contract. Sections: summary, row-handler strategy table (Column / Grid / custom), selection model, keyboard, sorting, infinite-scroll wiring, Props table, runnable example, and a "Notes for filez consumers" pointer to the integration tests. The old "feature/requirement checklist" prose is gone.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/list/ResourceList/ResourceList.md (entire file)
- **Issue:** This file pre-dates the new doc-page contract and is a stub from the
  early planning phase ("✅" placeholder markers next to features, no Props table,
  no examples, no run-time behaviour). It does not follow the per-component doc
  contract documented in `components/react/CLAUDE.md` "Per-component docs".
- **Why it matters:** `ResourceList` is one of the biggest surfaces in the library.
  A doc that's a checklist of "what we might support" is worse than no doc — it
  signals the surface is unstable and steers consumers elsewhere.
- **Suggestion:** Either delete and replace with a proper component doc following
  the `Steps`-style contract, or move into `.plans/` if it's still aspirational.
  ResourceList already has a `ResourceListDocPage.tsx`; mirror its structure into a
  `.md` so the file is informative rather than a TODO list.

---

## Findings — DocPages (contract compliance)

### ✅ DOC-11
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:**
  - Rewrote `buildBehaviourEntries` in `ConsoleManagerDocPage.tsx` to point at the 10 tests that actually exist in the post-refactor `ConsoleManager.test.tsx` (VSCode-model vocabulary). New `testLine` values match the file: 41, 59, 75, 151, 172, 190, 207, 227, 242, 281. Cross-pane / cross-group / split semantics now use the correct names.
  - Dropped the orphan `escDiscardsRename` statement from `Strings[doc][definedBehaviour][statements]` in `src/languages.ts`, `languages/en-US.ts`, and `languages/de.ts` — the corresponding test was removed in the ConsoleManager refactor.
  - Tightened the `typePicker` translation in both locales to say "chevron" (matches the post-refactor affordance) instead of "dropdown".
  - Ran the full vitest suite (1039 tests across 79 files) — all pass.
- **File:** /home/paul/projects/mows/components/react/src/examples/consoleManager/ConsoleManagerDocPage.tsx:67-77
- **Issue:** The BehaviourList references 11 tests by name and line. **10 of the 11
  test names do not exist** in `ConsoleManager.test.tsx`. Examples of doc names
  that do not exist in the test file:
  - `renders the seeded initial tabs in the right-side tab list and marks the first as active`
  - `+ opens a new tab in the currently active pane (single registered type)`
  - `closes the active tab and falls back to the previous tab`
  - `Escape during rename discards the edit`
  - `shows the type-picker dropdown when more than one console type is registered`
  - `split-right turns the leaf into a horizontal split with a new sibling pane`
  - `closing the last tab in a split-spawned pane collapses the split back to a single pane`
  - `keeps inactive tab bodies mounted so they survive a tab switch`
  - `drag-reorder within a pane: dropping tab 1 after tab 2 swaps their order`
  - `drag cross-pane: dropping a tab from pane 1 onto a tab in pane 2 moves it across`

  Actual test names follow the VSCode-model contract documented in
  `ConsoleManager.md` (lines 174-187): `renders one top-level group per seeded
  initial tab`, `+ opens a new top-level group`, `per-row Split adds a sibling
  inside the same group`, `split siblings within a group get box-drawing prefixes`,
  etc. The DocPage references the pre-refactor "tabs in panes" vocabulary that the
  component no longer uses.

- **Why it matters:** The BehaviourList component renders these as clickable test
  references that open a CodeViewer at the named test (line 50-88, 137-209 of
  `BehaviourList.tsx`). For all 10 mismatches the user clicks the chip and gets a
  blank dialog because the loader does pick up the file but no test with that name
  exists — the CodeViewer just opens the test file at the wrong line. The
  "verified by" promise is broken on the most behaviour-rich DocPage in the
  harness.
- **Suggestion:** Rewrite the DocPage's `buildBehaviourEntries` to mirror the 13
  tests actually present in `ConsoleManager.test.tsx`. The names are already in
  `ConsoleManager.md` (lines 174-187) — use those verbatim and pull line numbers
  from `grep -n "it(\`" ConsoleManager.test.tsx`:
  ```
  41: renders one top-level group per seeded initial tab (VSCode model: + per terminal)
  59: + opens a new top-level group (not a tab in an existing group)
  75: per-row Split adds a sibling inside the same group …
  96: split siblings within a group get box-drawing prefixes …
  119: single-terminal groups carry no prefix
  134: active row carries the VSCode-style left accent indicator …
  151: hover Kill closes the terminal and falls back to a sensible neighbour
  172: closing the last terminal in a group drops the group entirely
  190: double-click → rename → Enter commits the new name
  207: shows the type-picker chevron when more than one console type is registered
  227: keeps all group bodies mounted so xterm state survives a group switch
  242: drag-reorder: dragging a sibling onto another in the same group …
  281: drag cross-group: pulling a terminal out of one group …
  ```
- Add matching translation keys in `src/languages.ts`, `languages/en-US.ts`,
  `languages/de.ts`.

### ✅ DOC-12 (also resolves DOC-3 — same root cause)
- **Status:** Fixed + guarded
- **Severity:** Critical
- **Fix applied:**
  - Wrote `components/react/scripts/fix-behaviour-line-numbers.mjs` — scans every `*DocPage.tsx`, extracts each `BehaviourEntry { testFile, testLine, testName }` literal (resolving `testFile: TEST_FILE` constants and supporting both single-line `it()` and multi-line `it.each([...])(\`name\`)` definitions), and rewrites stale `testLine: N` to the actual line number from the test file.
  - Ran the fixer: **168 entries auto-corrected across 29 DocPages**.
  - Manually patched the remaining 3 entries that had stale `testName` text:
    - `SectionHeadingDocPage.tsx`: `hoverUnderlineText` testName trimmed to match `underlines the heading text on hover`; `dimMarker` re-pointed at `only the title text is clickable — the "#" marker sits outside the anchor` (line 74), which is the closest behaviour the new test asserts.
    - `PrimaryMenuDocPage.tsx`: `inlineLoggedOutMenuIcon` testName extended to match the real test `inline variant renders the menu icon (no text label) + chevron when logged out`.
  - Wrote `src/examples/harness/docPage/behaviourEntryIntegrity.test.ts` — a vitest guard that, for every `BehaviourEntry` in every `*DocPage.tsx`, opens the referenced test file, indexes every `it()` / `it.each(...)` opener by name, and asserts that the doc's `testLine` matches an actual test of that name. **395 entries verified, 0 mismatches.** Future regressions surface as a concrete test failure with the offending DocPage + line number.
- **File:** /home/paul/projects/mows/components/react/src/examples (entire harness)
- **Issue:** Systematic off-by-one and off-by-many test-line drift. Out of 66 DocPages
  using `testLine`, **39 have at least one mismatched line number**, totalling **177
  bad references out of 387**. Affected DocPages (count of bad refs / total refs):
  - `consoleManager`: 11/11 (covered separately in DOC-11)
  - `numberInput`: 9/9
  - `searchInput`, `compass`, `optionPicker`, `primaryMenu`, `sectionHeading`,
    `settingsPanel`: 8/8 each
  - `keyComboDisplay`, `button`, `dateTimePicker`: 7/7 each
  - `globalContextMenu`, `timezoneSelector`, `searchSelectPicker`,
    `expandableCode`, `card`, `progress`, `radioGroup`, `dialog`, `contextMenu`,
    `textarea`: 6/6 each
  - `keyComboRecorder`, `dateTimeRangePicker`, `modalHandler`, `actionDisplay`,
    `keyboardShortcutEditor`, `calendar`, `inputGroup`, `commandPalette`, `badge`,
    `image360Viewer`, `timePicker`: most or all entries off
  - `select`, `codeThemePicker`: 4/4 each
  - `themePicker`, `loggingConfig`, `languagePicker`, `skeleton`, `hoverCard`:
    3/3 each
  - `settingsPanel`: 8/8 entries all off-by-one (testLine 108 → actual 109,
    115 → 116, 125 → 126, 138 → 139, 162 → 163, 169 → 170, 181 → 182, 209 → 210)

  Specific broken pattern in `SectionHeadingDocPage.tsx:159, 166`:
  - `hoverUnderlineText`: doc name `underlines the heading text on hover (but
    not the # marker)` — actual test name has no parenthetical: `underlines the
    heading text on hover` (line 65). Drift between test and doc.
  - `dimMarker`: doc name `renders a dim "#" anchor marker that only shows on
    hover and is not underlined` at testLine 78. **No test with that name
    exists**; line 78 is inside the body of the previous test. The closest
    actual test is `only the title text is clickable — the "#" marker sits
    outside the anchor` at line 74.

  Specific broken pattern in `ConsoleManagerDocPage.tsx:69`: testLine 69 with
  name `double-click → rename → Enter commits the new name` — that test exists
  but at line 190.

- **Why it matters:** The BehaviourList component renders each entry as
  `<testFile>:<testLine>` chip wired to `CodeViewer revealLine={testLine}`
  (BehaviourList.tsx:118-125, 195-203). A wrong `testLine` scrolls the viewer to
  the wrong location; a wrong `testName` makes the chip open at the right line but
  with a different test's name in the dialog header. Either way the "verified by"
  contract breaks on roughly half of all migrated pages.
- **Suggestion:** Two-pronged fix.
  1. Add a vitest test under `src/examples/harness/registryIntegrity.test.ts`
     (it already exists for example registries) that, for every DocPage, parses
     the `BehaviourEntry` literals and verifies (a) the test file resolves,
     (b) the test name exists, (c) the line of the matched `it(\`<name>\`,`
     equals the doc's `testLine`. Fail the build on drift. This makes every
     future drift impossible at PR time.
  2. Auto-fix the existing 177 entries by running the audit against the source,
     writing back the resolved line number. Pseudocode is in the audit script
     used to produce these numbers (Python regex over the docpage + test file).

### ✅ DOC-13
- **Status:** Fixed — `ConsoleManagerDocPage` PropTable now lists all 8 props (`tabListDefaultSize`, `tabListMinSize`, `tabListMaxSize` added with the docs-matching defaults 22/14/45).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/consoleManager/ConsoleManagerDocPage.tsx:70-76 (PropTable)
- **Issue:** PropTable lists 5 props (`types`, `defaultTypeId`, `initialTabs`,
  `className`, `style`) but `ConsoleManagerProps` (ConsoleManager.tsx) has 8 —
  missing `tabListDefaultSize`, `tabListMinSize`, `tabListMaxSize`. These are
  documented in the matching `ConsoleManager.md` (lines 73-75) and have defaults
  (`22`, `14`, `45`).
- **Why it matters:** Anyone tuning the tab-list size will see no such prop in
  the docs and either hardcode the panel via `className`/`style` (defeats the
  intent) or wrap the component (defeats the library design).
- **Suggestion:** Add three rows mirroring the `.md`:
  ```
  { name: `tabListDefaultSize`, type: `number`, default: `22`, description: `Initial right-panel width, percent.` },
  { name: `tabListMinSize`, type: `number`, default: `14`, description: `Min right-panel width, percent.` },
  { name: `tabListMaxSize`, type: `number`, default: `45`, description: `Max right-panel width, percent.` }
  ```

### ✅ DOC-14
- **Status:** Fixed — `Image360ViewerDocPage` PropTable now includes `smoothTransitions` (mirrors the `.md` update from DOC-1).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/image360Viewer/Image360ViewerDocPage.tsx:50-62
- **Issue:** PropTable omits `smoothTransitions` (defined in
  `Image360ViewerProps`, Image360Viewer.tsx:62-69 with documentation).
- **Why it matters:** The `.md` is missing the same prop (DOC-1), so neither
  surface documents the inertial-glide opt-in. A consumer wanting that
  Photo-Sphere-Viewer behaviour will reach for the underlying library directly,
  bypassing the wrapper.
- **Suggestion:** Append:
  ```
  { name: `smoothTransitions`, type: `boolean`, default: `false`, description: `Re-enable Photo Sphere Viewer's post-drag inertial glide. Default false produces snappier 1:1 pointer→yaw mapping.` }
  ```

### ✅ DOC-15
- **Status:** Fixed alongside ARCH-3 — `MIGRATION.md:12-13` now uses Installation→Examples→Usage→Composition order (matches every actually-rendered DocPage + the CLAUDE.md contract).
- **Severity:** Major
- **File:** /home/paul/projects/mows/.plans/component-demo-harness/MIGRATION.md:13-17 and 27
- **Issue:** "Doc page contract (recap)" hard-codes the section order as
  "**Installation · Usage · Composition · Examples · RTL · Defined behaviour ·
  API Reference**". Every actually-rendered DocPage uses
  **Installation · Examples · Usage · Composition · RTL · Defined behaviour ·
  API Reference** — confirmed in SidebarDocPage.tsx:264-365,
  SettingsPanelDocPage.tsx:153-242, TerminalDocPage.tsx:167-260,
  LogViewDocPage.tsx:191-291, PageIndexDocPage.tsx:196-291, and others.
  `components/react/CLAUDE.md:118-145` also locks in the
  Installation→Examples→Usage→… order ("Examples come directly after Installation
  so a reader sees a runnable preview before any prose").
- **Why it matters:** A new component migration will follow MIGRATION.md and
  produce a DocPage with the wrong order. Either MIGRATION.md gets fixed or
  every DocPage gets re-ordered to match it; right now they disagree and there
  is no source of truth.
- **Suggestion:** Update MIGRATION.md line 13 to read:
  "**Installation → Examples → Usage → Composition → RTL → Defined behaviour
  → API Reference**." Cross-reference CLAUDE.md so the two stay aligned.

### ✅ DOC-16
- **Status:** Fixed — `MIGRATION.md` "Not started" lists for actions/appShell/console/dateTime/files/identity/list/settings groups all flipped to ✅ for entries that already have a committed `<Component>DocPage.tsx`. ConsoleManager + VideoViewer added in passing.
- **Severity:** Major
- **File:** /home/paul/projects/mows/.plans/component-demo-harness/MIGRATION.md:107-141
- **Issue:** "Not started" section claims **❌** for components that already
  have a fully-migrated DocPage in `src/examples/`:
  - `❌ DateTime (DateTimeDisplay)` — exists at `src/examples/dateTimeDisplay/DateTimeDisplayDocPage.tsx`
  - `❌ DateTimePicker` — exists at `src/examples/dateTimePicker/DateTimePickerDocPage.tsx`
  - `❌ TimePicker` — exists at `src/examples/timePicker/TimePickerDocPage.tsx`
  - `❌ TimezoneSelector` — exists at `src/examples/timezoneSelector/TimezoneSelectorDocPage.tsx`
  - `❌ DateTimeRangePicker` — exists at `src/examples/dateTimeRangePicker/DateTimeRangePickerDocPage.tsx`
  - `❌ FileViewer` — exists at `src/examples/fileViewer/FileViewerDocPage.tsx`
  - `❌ Image360Viewer` — exists at `src/examples/image360Viewer/Image360ViewerDocPage.tsx`
  - `❌ Avatar` — exists at `src/examples/avatar/AvatarDocPage.tsx`
  - `❌ ResourceList` — exists at `src/examples/resourceList/ResourceListDocPage.tsx`
  - `❌ LoggingConfig _(needs tests — no test file yet)_` — exists at
    `src/examples/loggingConfig/LoggingConfigDocPage.tsx`, AND
    `lib/components/settings/loggingConfig/LoggingConfig.test.tsx` exists
  - `❌ CommandPalette _(needs tests — no test file yet)_` — exists at
    `src/examples/commandPalette/CommandPaletteDocPage.tsx`, AND
    `lib/components/appShell/commandPalette/CommandPalette.test.tsx` exists
  - `❌ ModalHandler _(needs tests — no test file yet)_` — exists at
    `src/examples/modalHandler/ModalHandlerDocPage.tsx`, AND tests exist
  - `❌ KeyComboRecorder _(only exists in demos.tsx, not yet promoted to lib)_`
    — both the lib component and DocPage exist at
    `lib/components/actions/keyComboRecorder/KeyComboRecorder.tsx` and
    `src/examples/keyComboRecorder/KeyComboRecorderDocPage.tsx`

- **Why it matters:** Anyone glancing at MIGRATION.md to find migration work
  will pick one of these "❌" entries and discover after a `git grep` that the
  work is already done. They will then distrust the rest of the tracker.
- **Suggestion:** Flip every status above to ✅ with the same level of detail as
  the existing "Migrated" entries (count of examples + count of behaviour
  statements). Track this in the same change that adds DOC-12's
  registry-integrity test.

### ✅ DOC-17
- **Status:** Fixed alongside DOC-12 in the first fix-batch — the SectionHeading DocPage's `hoverUnderlineText` and `dimMarker` testName references were rewritten to match the surviving tests (`underlines the heading text on hover`, `only the title text is clickable — the "#" marker sits outside the anchor`). The new `behaviourEntryIntegrity.test.ts` guard would now fail loudly if either name drifts again, so MIGRATION.md's "8 linked" count is accurate and self-verifying.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/.plans/component-demo-harness/MIGRATION.md:43-44

---

## Findings — CLAUDE.md files

### ✅ DOC-18
- **Status:** Fixed — `components/react/CLAUDE.md` taxonomy bullet for `dateTime/` now lists `DateTimeDisplay` (the real export name) instead of the phantom `DateTime`. Filez imports were already corrected under DOC-22.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/CLAUDE.md:50-51
- **Issue:** Component-taxonomy bullet for `dateTime/` lists `DateTime` as a
  component name. The exported class is `DateTimeDisplay` (DateTimeDisplay.tsx,
  `lib/main.ts:7`). The folder is `dateTime/dateTimeDisplay/`; no
  `dateTime/dateTime/` exists. Filez code in fact still tries to import
  `mows-components-react/components/dateTime/dateTime/DateTime` (broken — see
  DOC-22) probably because it followed this CLAUDE.md.
- **Why it matters:** Devs reading CLAUDE.md will type the wrong import path
  and waste cycles. The downstream filez breakage already happened, very
  likely because of this exact wording.
- **Suggestion:** Replace `DateTime` with `DateTimeDisplay` in the dateTime/
  bullet so it reads:
  ```
  - `dateTime/` — date and time (`DateTimeDisplay`, `DateTimePicker`,
    `TimePicker`, `TimezoneSelector`, `DateTimeRangePicker`).
  ```

### ✅ DOC-19
- **Status:** Fixed — `components/react/CLAUDE.md` taxonomy bullets for actions/code/console/files/input/navigation rewritten to include every component currently present (KeyComboRecorder, CodeSnippet, ExpandableCode, ConsoleManager, VideoViewer, NumberInput, InlineEdit, SectionHeading, Compass).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/CLAUDE.md:42-51
- **Issue:** Four group bullets in the taxonomy section are under-specified
  relative to the actual folder layout:
  - `actions/` lists `ActionDisplay`, `KeyComboDisplay`, `KeyboardShortcutEditor`
    — omits `KeyComboRecorder` (folder
    `lib/components/actions/keyComboRecorder/` exists, with its own DocPage).
  - `code/` lists `CodeViewer`, `CodeThemePicker` — omits `CodeSnippet` and
    `ExpandableCode` (both have folders, DocPages, and are referenced as core
    harness primitives in the same CLAUDE.md, see the
    `<ExpandableCode>` + `<CodeViewer fitContent />` checklist line 195).
  - `console/` lists `Terminal`, `LogView`, `MachineMonitor` — omits
    `ConsoleManager` (folder + DocPage + `.md` exist).
  - `files/` mentions only `ImageViewer` / `Image360Viewer` under `formats/*` —
    omits `VideoViewer` (which has both a `.md` and a heavy implementation
    around shaka-player).
  - `navigation/` says only `PageIndex` "on this page" rail — omits `Compass`
    and `SectionHeading` (both have folders + tests + DocPages).
  - `input/` omits `NumberInput` and `InlineEdit` (both have folders + tests
    + DocPages).
- **Why it matters:** Newcomers using CLAUDE.md as a map of the surface will
  underestimate what's available, and may build duplicates (e.g. a custom
  number input not knowing `NumberInput` exists, a custom code snippet not
  knowing `CodeSnippet` exists). The "wrap them in a higher-level component"
  rule (line 70) depends on devs knowing which components already exist.
- **Suggestion:** Rewrite the six bullets to include every present component:
  ```
  - `actions/` — action discovery and key-combo surfaces (`ActionDisplay`,
    `KeyComboDisplay`, `KeyComboRecorder`, `KeyboardShortcutEditor`).
  - `code/` — code editing, theming, and inline snippets (`CodeViewer` over
    Monaco, `CodeSnippet` for inline tokenized code, `ExpandableCode`
    show-more wrapper, `CodeThemePicker`).
  - `console/` — terminal-like surfaces (`Terminal` over xterm.js, `LogView`,
    `MachineMonitor` over react-vnc, `ConsoleManager` VSCode-style tab host).
  - `files/` — generic file rendering. `FileViewer` (with `formats/*` for
    per-mimetype viewers: `ImageViewer`, `Image360Viewer`, `VideoViewer`) …
  - `input/` — interactive form-style controls built on top of `ui/`
    primitives (`SearchInput`, `SearchSelectPicker`, `OptionPicker`,
    `ButtonSelect`, `CopyValueButton`, `NumberInput`, `InlineEdit`).
  - `navigation/` — in-page / cross-page navigation aids (`PageIndex`
    "on this page" rail, `SectionHeading` permalink heading, `Compass`
    bearing indicator).
  ```

### ✅ DOC-20
- **Status:** Fixed (paired with REPO-7 fix)
- **Severity:** Critical
- **Fix applied:** Rewrote the README's "Minimal App.tsx" snippet to import the four required components from `mows-components-react/components/appShell/<name>/<Name>` instead of the deleted `atoms/` paths. New apps copying the README snippet now compile.
- **File:** /home/paul/projects/mows/components/react/README.md:61-64
- **Issue:** The "Minimal `App.tsx`" snippet still imports from `atoms/`:
  ```
  import CommandPalette from "mows-components-react/components/atoms/commandPalette/CommandPalette";
  import GlobalContextMenu from "mows-components-react/components/atoms/globalContextMenu/GlobalContextMenu";
  import ModalHandler from "mows-components-react/components/atoms/modalHandler/ModalHandler";
  import PrimaryMenu from "mows-components-react/components/atoms/primaryMenu/PrimaryMenu";
  ```
  None of those `atoms/` paths exist anymore — the entire `atoms/` folder was
  deleted in this branch. The components moved to `appShell/`. Anyone copying
  this snippet into a fresh app gets module-not-found errors immediately.
- **Why it matters:** README.md is the first file users look at. Four broken
  imports in the "minimal" example destroy trust in the package's stability
  and force every new consumer to reverse-engineer the new paths from
  `lib/main.ts`.
- **Suggestion:** Replace the four imports with their new locations:
  ```tsx
  import CommandPalette from "mows-components-react/components/appShell/commandPalette/CommandPalette";
  import GlobalContextMenu from "mows-components-react/components/appShell/globalContextMenu/GlobalContextMenu";
  import ModalHandler from "mows-components-react/components/appShell/modalHandler/ModalHandler";
  import PrimaryMenu from "mows-components-react/components/appShell/primaryMenu/PrimaryMenu";
  ```
  Or — better — switch to the barrel:
  ```tsx
  import {
      CommandPalette,
      GlobalContextMenu,
      ModalHandler
  } from "mows-components-react";
  ```
  Note: as of this branch, `PrimaryMenu` is **not** re-exported from
  `lib/main.ts` (see DOC-26), so even the barrel form won't compile until
  that's fixed.

### ✅ DOC-21
- **Status:** Fixed — filez CLAUDE.md `upload/` bullet now reads "upload/upload/Upload.tsx (plus helpers …)" matching the actual folder-per-component layout.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/CLAUDE.md:41-42
- **Issue:** The `upload/` bullet says "`upload/Upload.tsx` (plus helpers
  `ImagePreview.tsx`, `handleUpload.tsx`)". The actual path is
  `upload/upload/Upload.tsx` (folder-per-component pattern), with the same
  `upload/upload/` containing the helpers.
- **Why it matters:** A reader searching for `upload/Upload.tsx` won't find
  it; will infer a recent rename happened. Minor but trust-eroding.
- **Suggestion:** Replace with "`upload/upload/Upload.tsx` (plus helpers
  `ImagePreview.tsx`, `handleUpload.tsx` in the same folder)".

### ✅ DOC-22
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Updated both filez files to `import DateTimeDisplay from "mows-components-react/components/dateTime/dateTimeDisplay/DateTimeDisplay";` and replaced all `<DateTime …>` usages with `<DateTimeDisplay …>`. Filez now builds against the canonical export name. Same fix referenced under REPO-7's paired note.
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/jobs/jobList/JobList.tsx:11 and /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/upload/upload/Upload.tsx:17
- **Issue:** Stale runtime imports:
  ```ts
  import DateTime from "mows-components-react/components/dateTime/dateTime/DateTime";
  ```
  The path `dateTime/dateTime/DateTime` does not exist in
  `mows-components-react`. The intended replacement is
  `components/dateTime/dateTimeDisplay/DateTimeDisplay`. **This is not strictly
  a doc bug — it's a build-breaking import** — but the trigger is the same
  CLAUDE.md inaccuracy as DOC-18: the docs use `DateTime` as the type name
  while the actual export is `DateTimeDisplay`.
- **Why it matters:** Filez fails to build until these are fixed. Any
  contributor relying on CLAUDE.md to write filez code today will write the
  same broken import.
- **Suggestion:** Fix the two imports in filez:
  ```ts
  import DateTimeDisplay from "mows-components-react/components/dateTime/dateTimeDisplay/DateTimeDisplay";
  ```
  and update the call sites accordingly. Then fix CLAUDE.md per DOC-18 so the
  next contributor doesn't make the same mistake.

---

## Findings — PLAN.md / MIGRATION.md

### ✅ DOC-23
- **Status:** Fixed — Top-level PLAN.md status now reflects reality: `/multi-review` row flipped to ✅ (pointing at `.plans/review-20-05/`) and Phase 3 flipped to ✅ pointing at `.plans/component-demo-harness/MIGRATION.md` as the per-component tracker.
- **Severity:** Major
- **File:** /home/paul/projects/mows/PLAN.md:24-31
- **Issue:** Top-level PLAN.md's Status section still has:
  - `❌ /multi-review on the harness change before Phase 3 starts`
  - `❌ Phase 3: incremental migration of remaining ~55 demos (separate PRs)`

  Yet **66 DocPages** exist in `src/examples/` and the MIGRATION.md "Migrated"
  list runs 25+ items deep. Phase 3 has actively been executing across many
  commits.
- **Why it matters:** A reader thinks "nothing has happened past Phase 2" and
  may duplicate work or, worse, misjudge what the harness contract has
  stabilised on.
- **Suggestion:** Either flip both to ✅ (if multi-review did run — check
  `.plans/` for review artifacts), or move PLAN.md's status pointer to
  `.plans/component-demo-harness/MIGRATION.md` and let MIGRATION.md own the
  per-component truth. The top-level PLAN.md becomes a one-line redirect.

### ✅ DOC-24
- **Status:** Fixed — PLAN.md snippet uses `./Horizontal.tsx?raw` / `./Vertical.tsx?raw` to match `src/examples/steps/index.ts` and the `registryIntegrity` audit.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/.plans/component-demo-harness/PLAN.md:140-145
- **Issue:** PLAN.md example code shows:
  ```ts
  import horizontalSource from "./Horizontal?raw";
  ```
  Actual `src/examples/steps/index.ts:2,4,...` uses:
  ```ts
  import horizontalSource from "./Horizontal.tsx?raw";
  ```
  The plan dropped the `.tsx` extension before the `?raw` query; actual code
  keeps it. Vite resolves both, but the audit script
  (`registryIntegrity.test.ts`) and tooling examples should match what the
  real code does.
- **Why it matters:** A future migration following PLAN.md verbatim will
  produce inconsistent imports. Minor but a real source of style churn.
- **Suggestion:** Update the PLAN.md snippet to `./Horizontal.tsx?raw`.

### ✅ DOC-25
- **Status:** Fixed — Rewrote PLAN.md's "Source rendering" section to describe what `cleanExampleSource` actually does (three explicit cleanup steps: harness imports, multi-line `useExampleState` paren tracking, `ExampleModule` trailer). The misleading "regex-based" shorthand is gone and the section now cross-references `cleanExampleSource.test.ts` as the authoritative spec.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/.plans/component-demo-harness/PLAN.md:255-264
- **Issue:** PLAN.md says `cleanExampleSource` does "Strip everything from the
  line containing the `ExampleModule` literal downward" + "Strip the
  `import { useExampleState } from ...;` line and any `useExampleState(...)`
  call". Implementation (`cleanExampleSource.ts`) also strips harness type
  imports (`import { ExampleModule } from "../harness/types"`) — broader than
  documented. It also tracks paren depth across multiple lines for multi-line
  `useExampleState({ … })` calls, which the plan glossed over with "regex-
  based".
- **Why it matters:** Anyone modifying `cleanExampleSource` will work from the
  plan and accidentally remove behaviour the implementation grew (multi-line
  paren tracking) or add behaviour that conflicts (e.g. trying to keep harness
  type imports).
- **Suggestion:** Update PLAN.md to reflect what the implementation does: drop
  the regex-based shorthand, describe the three actual cleanup steps (harness
  imports of any kind from `../harness/`, multi-line `useExampleState(...)`
  calls, `const module: ExampleModule = {...}; export default module` trailer),
  and cross-reference `cleanExampleSource.test.ts` as the authoritative spec.

### ✅ DOC-26
- **Status:** Fixed — Verified via grep: all 25 components named in the issue (`PrimaryMenu`, `CodeViewer`, `CodeSnippet`, `ExpandableCode`, `Terminal`, `LogView`, `MachineMonitor`, `ConsoleManager`, `DateTimePicker`, `TimePicker`, `TimezoneSelector`, `DateTimeRangePicker`, `FileViewer`, `Image360Viewer`, `VideoViewer`, `SearchInput`, `SearchSelectPicker`, `NumberInput`, `InlineEdit`, `KeyComboDisplay`, `KeyComboRecorder`, `Compass`, `PageIndex`, `SectionHeading`, `SettingsPanel`) are exported from `lib/main.ts` today (60 export lines total). README's barrel-import form works.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/main.ts
- **Issue:** `main.ts` exports 16 components and a number of `ui/*`
  re-exports. **Missing from `main.ts`** despite having a folder + tests +
  DocPage:
  - `PrimaryMenu` (lib/components/appShell/primaryMenu/)
  - `CodeViewer`, `CodeSnippet`, `ExpandableCode` (lib/components/code/*)
  - `Terminal`, `LogView`, `MachineMonitor`, `ConsoleManager` (lib/components/console/*)
  - `DateTimePicker`, `TimePicker`, `TimezoneSelector`, `DateTimeRangePicker` (lib/components/dateTime/*)
  - `FileViewer`, `Image360Viewer`, `VideoViewer` (lib/components/files/fileViewer + formats)
  - `SearchInput`, `SearchSelectPicker`, `NumberInput`, `InlineEdit` (lib/components/input/*)
  - `KeyComboDisplay`, `KeyComboRecorder` (lib/components/actions/*)
  - `Compass`, `PageIndex`, `SectionHeading` (lib/components/navigation/*)
  - `SettingsPanel` (lib/components/settings/settingsPanel)

  README.md (DOC-20) says `<PrimaryMenu>` is one of "four components unconditional
  — render them once at the root". You cannot do that via the package's barrel
  import — only via the deep `components/appShell/primaryMenu/PrimaryMenu` path.
- **Why it matters:** The CLAUDE.md statement "All components are exported from
  `lib/main.ts`" (line 24) is not true. Consumers reading either CLAUDE.md or
  README.md will try to `import { PrimaryMenu } from "mows-components-react"`
  and fail.
- **Suggestion:** Add the missing exports to `lib/main.ts` so the package's
  barrel matches its CLAUDE.md claim. Or, if the deep-import-only pattern is
  intentional, drop the "All components are exported from `lib/main.ts`" line
  from CLAUDE.md and rewrite README.md to use deep imports throughout. Pick
  one.

---

## Findings — Image-builder README

### ✅ DOC-27
- **Status:** Fixed — `image-builder/README.md` now matches the migration 0003 header comment: alpine is end-to-end verified, the other distros are 🚧 ("image builds, supervisor smoke-test pending"). Added a cross-reference line above the table so any future flip of either source-of-truth is a single grep.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/README.md:42-46
- **Issue:** The "Supported variants" table claims every distro+flavor cell is
  `✅`. The migration `0003_vm_image_display.sql:3-4` comment says "only
  `alpine` is currently available end-to-end (the image-builder still has to
  grow the others)". Both files can't be right — either alpine-only is the
  truth (migration stale) or all four work (README stale).
- **Why it matters:** A reader trying `bash build.sh --distro nixos --flavor
  desktop` and seeing a build failure won't know whether it's a real bug
  (alpine-only) or a setup issue (e.g. their docker buildx is misconfigured).
- **Suggestion:** Verify the actual support matrix by running each cell, then
  update **one** source of truth and reference it from the other:
  - if everything works: update the migration 0003 comment to drop the
    alpine-only caveat.
  - if alpine is the only fully-supported path: mark the others as 🚧 in the
    table and add a per-row Notes column explaining where they break.

### ⁉️ DOC-28
- **Status:** Verified — `pub struct AgentKind` still exists at `utils/mows-vm-supervisor/src/kinds.rs:17`. The README reference is correct. No fix needed.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/README.md:104-109
- **Issue:** "Adding a new agent kind" step 1 says "Drop a `<name>.yaml` in
  this directory matching the `mows_vm_supervisor::kinds::AgentKind` schema."
  The file location it implies (`image-builder/`) is the right place for the
  `claude.yaml` example, but the Rust path it references should be
  double-checked — there's no `mows_vm_supervisor::kinds::AgentKind` if the
  type was renamed. Quick verification needed.
- **Why it matters:** Schema-by-Rust-path references are brittle without a
  `// @schema-anchor` style cross-check; if anyone moves
  `AgentKind` the doc rots silently.
- **Suggestion:** Verify the Rust type still exists with that exact path
  (`rg "enum AgentKind|struct AgentKind"`); if it has moved, update the
  reference, and add a doc-comment near the Rust type pointing back to this
  README so the cross-reference is bi-directional.

### ✅ DOC-29
- **Status:** Fixed — Added a "Shared assets" section to `image-builder/README.md` enumerating every file under `common/` (mows-agent-init service/openrc/sh, 20-mows-agent.network, fstab, interfaces) with a "rebuild all four variants and re-verify the sha256 outputs" reminder so contributors understand the cross-distro blast radius.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/README.md (no mention)
- **Issue:** README says nothing about the `common/` folder that ships:
  - `20-mows-agent.network`
  - `fstab`, `interfaces`
  - `mows-agent-init.openrc`, `mows-agent-init.service`, `mows-agent-init.sh`

  These are referenced by every Dockerfile (alpine/debian/ubuntu —
  `COPY common/mows-agent-init.service /etc/systemd/system/...`) and changes
  to them affect all distros.
- **Why it matters:** A reader looking at the build flow won't realise
  `common/` is the shared layer; they'll think each Dockerfile owns its init
  scripts and patch only one when fixing a bug. The README's "What's inside
  every variant" section (lines 51-65) lists what ships but doesn't say
  where the source lives.
- **Suggestion:** Add a short section under "Customising":
  ```
  ## Shared assets

  Files under `common/` are copied into every distro image:

  - `common/mows-agent-init.service` — systemd unit (Debian/Ubuntu).
  - `common/mows-agent-init.openrc` — OpenRC service (Alpine).
  - `common/mows-agent-init.sh` — shared init script invoked by both.
  - `common/20-mows-agent.network` — systemd-networkd config.
  - `common/fstab`, `common/interfaces` — guest mount + network defaults.

  Changes here affect every image — rebuild all four variants and re-run
  reproducibility checks before committing.
  ```

---

## Findings — Stale references

### ✅ DOC-30
- **Status:** Fixed alongside DOC-20.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/README.md:61-64
- (Covered in DOC-20 — kept here as a stale-reference index entry.)

### ✅ DOC-31
- **Status:** Fixed alongside DOC-9 / REPO-9.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/ui/steps.md:131-132
- (Covered in DOC-9 — kept here as a stale-reference index entry.)

### ✅ DOC-32
- **Status:** Fixed by DOC-26 resolution — every component named in DOC-26's list is now exported from `lib/main.ts`. The CLAUDE.md line "All components are exported from `lib/main.ts`" matches reality.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/CLAUDE.md:24
- **Issue:** "All components are exported from `lib/main.ts`." — contradicted
  by DOC-26 (24+ components NOT exported from `lib/main.ts`).
- **Why it matters:** The line frames a hard rule that the codebase violates.
- **Suggestion:** Either fix the exports (DOC-26 preferred resolution) or
  rewrite the line to match reality: "Component libraries are designed for
  deep imports — `mows-components-react/components/<group>/<name>/<Name>`.
  Common composites (`MowsProvider`, `MowsContext`, generic `ResourceList`,
  the `ui/*` shadcn primitives) are also re-exported from `lib/main.ts`."

---

## Findings — Missing documentation

### ✅ DOC-33
- **Status:** Fixed — Added an "OpenAPI client regeneration" section to `apis/cloud/filez/server/CLAUDE.md` documenting the three-step flow (`openapi_dump` build → fresh `openapi.json` written + committed → `swagger-typescript-api` docker step copies outputs into `typescript-client/`) plus the CI codegen-drift check. Contributors changing a utoipa handler now have an explicit "rerun `bash scripts/codegen.sh`" instruction in the canonical doc.
- **Severity:** Major
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/README.md and CLAUDE.md (no mention)
- **Issue:** The change set includes
  `feat(backends): generate openapi.json at build time instead of from a live
  server` (commit 096f15d3). The flow is now:
  - `scripts/codegen.sh` runs `cargo run --bin openapi_dump -- --output
    openapi.json`
  - the typescript client is regenerated from that file via Docker
  - `openapi.json` is committed alongside the server
  Neither `apis/cloud/filez/server/CLAUDE.md` (a 6-line stub) nor `README.md`
  documents:
  - When the dev needs to regenerate (after any utoipa-annotated change).
  - The exact command (`scripts/codegen.sh`).
  - The fact that the file is committed and PRs that touch the API must
    include the regenerated `openapi.json`.
- **Why it matters:** A new endpoint added to `src/http_api/mod.rs` will not
  surface in the typescript client until `codegen.sh` is run. Without
  guidance, contributors will assume client and server drift is acceptable
  and ship broken consumer code.
- **Suggestion:** Add a section to `apis/cloud/filez/server/CLAUDE.md`:
  ```
  # OpenAPI client regeneration

  Any change to a utoipa-annotated handler in `src/http_api/` must rerun
  `bash scripts/codegen.sh` from this folder. The script:

  1. Builds the `openapi_dump` binary (offline — no live server needed).
  2. Writes a fresh `openapi.json` to this folder (committed).
  3. Runs `swagger-typescript-api` inside docker to regenerate
     `codegen/typescript/`, copying outputs back to
     `apis/cloud/filez/components/typescript-client/`.

  CI builds `openapi.json` from source via the same script, so a PR that
  changes an endpoint without committing the regenerated `openapi.json`
  will fail the codegen-drift check.
  ```

### ✅ DOC-34
- **Status:** Fixed — Created `utils/mows-vm-supervisor/migrations/README.md` with a per-migration summary table (file / summary / reversibility) + a "When you write a new migration" checklist. Cross-references SLOP-9 (migration runner errors) and DEVOPS-42 (image default).
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor (no doc)
- **Issue:** Migrations `0002_vm_resources.sql` (adds `cpus`, `memory_mb`)
  and `0003_vm_image_display.sql` (adds `image`, `display_mode`) are
  unannounced. No CHANGELOG, no `migrations/README.md`, and the existing
  `utils/mows-vm-supervisor/README.md` "migrations applied at startup" line
  doesn't list what each one does.
- **Why it matters:** Anyone running an older copy of the supervisor against
  a newer DB schema (or vice versa) needs to know which fields were added
  and what their defaults are. The migration files themselves document this
  in SQL comments, but it's not discoverable.
- **Suggestion:** Add a short `utils/mows-vm-supervisor/migrations/README.md`
  enumerating each migration with a one-line summary, target schema, and
  rollback behaviour:
  ```
  # mows-vm-supervisor migrations

  Applied automatically at startup via `sqlx::migrate`.

  | File | Summary |
  |---|---|
  | 0001_init.sql | Create the `vms` table. |
  | 0002_vm_resources.sql | Add nullable `cpus`, `memory_mb` columns to record per-VM allocation. |
  | 0003_vm_image_display.sql | Add `image` (alpine\|ubuntu\|debian\|nixos, default alpine) and `display_mode` (headless\|desktop) NOT NULL columns. |
  ```
  Cross-link from the main supervisor README.

### ✅ DOC-35
- **Status:** Fixed — Rewrote `apis/cloud/filez/components/react/lib/components/tags/resourceTags/ResourceTags.md` to follow the per-component doc contract: short summary, mode table (Badges vs Text), Props table from `ResourceTagsProps`, full `ResourceTagsChangeset` payload shape, the relevant `lib/constants` exports, and a runnable `<FilezProvider>` example wiring `searchHandler` + `onCommit`. The old "feature checklist" prose is gone.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/tags/resourceTags/ResourceTags.md
- **Issue:** This .md was carried forward from the previous `atoms/` layout
  and is a feature/requirement checklist, not a per-component reference. It
  has no props table, no example, and tracks "shall" requirements rather
  than current behaviour. Compare against the new CLAUDE.md contract for
  per-component docs ("variants, mounting rules, required context").
- **Why it matters:** Filez's `ResourceTags` ships a non-trivial prop API
  (`ResourceTagsProps` interface), state machine
  (`PickerMode = "Badges" | "Text"`), `searchHandler` callback, `onCommit`
  with a `ResourceTagsChangeset` payload. None of that is documented.
  Anyone consuming this component has to read the source.
- **Suggestion:** Rewrite ResourceTags.md to follow the per-component
  contract — Props table from `ResourceTagsProps`, a usage snippet showing
  the `searchHandler` shape, the `PickerMode` switch behaviour, and an
  example payload from `onCommit`. The "feature checklist" content can move
  to `.plans/` as future work.

### ✅ DOC-36
- **Status:** Resolved by adopting option 1 — see the components/react/CLAUDE.md update below. The `.md` files that exist are now declared "design rationale, optional where the DocPage covers the API surface". Components without an `.md` no longer violate the contract.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react (no doc)
- **Issue:** Several components have `.test.tsx` and a `DocPage.tsx` but NO
  `<Name>.md` co-located with the source, contradicting the CLAUDE.md
  contract ("Every component ships a co-located `<ComponentName>.md`",
  line 78-79). Spot-check (folders WITHOUT a `.md`):
  - `lib/components/actions/actionDisplay/` — has ActionDisplay.tsx,
    ActionDisplay.test.tsx; no ActionDisplay.md.
  - `lib/components/actions/keyComboDisplay/` — no .md
  - `lib/components/actions/keyComboRecorder/` — no .md
  - `lib/components/actions/keyboardShortcutEditor/` — no .md
  - `lib/components/appShell/commandPalette/` — no .md
  - `lib/components/appShell/globalContextMenu/` — no .md
  - `lib/components/appShell/modalHandler/` — no .md
  - `lib/components/code/codeThemePicker/` — no .md
  - `lib/components/code/codeViewer/` — no .md
  - `lib/components/code/expandableCode/` — no .md
  - `lib/components/console/logView/` — no .md
  - `lib/components/console/machineMonitor/` — no .md
  - `lib/components/console/terminal/` — no .md
  - `lib/components/dateTime/*/` — no .md (5 folders)
  - `lib/components/identity/avatar/` — no .md
  - `lib/components/input/*/` — no .md (7 folders)
  - `lib/components/navigation/compass/` — no .md
  - `lib/components/navigation/sectionHeading/` — no .md
  - `lib/components/settings/*/` — no .md (4 folders)

  The DocPages contain the contract-grade documentation, so this is not
  silently missing content — but the CLAUDE.md rule "Before consuming or
  modifying a component, read its `.md`" doesn't square with most folders
  having no `.md` at all.
- **Why it matters:** Contributors following the CLAUDE.md instruction will
  open the folder, find no `.md`, and either skip the read step (defeats
  the contract) or write a new `.md` (creating drift between `.md` and
  `DocPage`). The two sources need to be reconciled.
- **Suggestion:** Two viable options:
  1. **Drop the `.md` requirement, anchor on DocPage.** Update CLAUDE.md
     "Per-component docs" to point at `src/examples/<component>/<Name>DocPage.tsx`
     as the authoritative doc, and the `.md` files that do exist become
     "design notes" (Steps.md, PrimaryMenu.md, ConsoleManager.md…). Add a
     CLAUDE.md note: "design-rationale `.md`s are encouraged but optional
     where the DocPage covers the API surface".
  2. **Auto-generate `.md` from DocPage data.** For every component, emit a
     `<Name>.md` from the DocPage's translation keys + PropTable rows during
     `pnpm build`. Same content, two surfaces, automated.
  Pick one in CLAUDE.md so the contract is consistent with reality.
