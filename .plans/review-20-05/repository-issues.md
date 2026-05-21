# Repository organization review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** Repository Engineer
**Date:** 2026-05-20

## Summary

| Severity      | Count |
|---------------|-------|
| Critical      | 3     |
| Major         | 6     |
| Minor         | 13    |
| Informational | 1     |
| **Total**     | **23**|

**Top three to fix first**
1. **REPO-2 (Critical)** — Add `.tmp/` to `components/react/.gitignore`; delete the 8 PNG screenshots before they get committed.
2. **REPO-7 / REPO-8 (Critical, paired)** — Fix the `atoms/` references in `components/react/README.md` (broken docs for every new app) and `apis/cloud/filez/components/react/get-file-icons.sh` (writes to a deleted folder).
3. **REPO-4 + REPO-16 (Major, paired)** — Collapse the 68 duplicate doc-page shells into one config-driven component AND lift the shared installation chrome strings into a single translation block; this single change kills ~13k lines of duplicate code AND eliminates the i18n drift already visible in the German translations.

## Findings — File / folder organization

### ⁉️ REPO-1 — `lib/lib/` double-nested directory smells like a bug (and is replicated in the filez React package)
- **Status:** Deferred — Renaming `lib/lib/` to a single-level `lib/internal/` (or similar) requires updating every `import from "@/lib/..."` + `from "../../lib/..."` + `from "mows-components-react/lib/..."` site across BOTH packages (mows-components-react + apis/cloud/filez/components/react) and every downstream consumer that uses the deep-import form. The yalc-linked filez consumers would all break at the same time. The rename is mechanical but touches an estimated ~400+ files; it's exactly the kind of mass change that wants its own focused branch with explicit before/after test runs. Note: the previous fix-batch's REPO-13 (use-mobile → useIsMobile) was the camelCase-rename trial — that worked smoothly, suggesting the lib/lib/ rename would too.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/lib/` and `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/lib/`
- **Issue:** Inside both library roots (`components/react/lib/` and `apis/cloud/filez/components/react/lib/`), there is a second `lib/` containing `codeThemes/`, `languages/`, `mowsContext/`/`filezContext/`, `themes.ts`, `utils.ts`, `dateTimeUtils.ts`, `logging.ts`, etc. So the path literally reads `lib/lib/utils.ts`.
- **Why it matters:** A path ending `…/lib/lib/utils.ts` is almost always a copy-paste artefact or a refactor that stalled. Import statements like `from "../../lib/lib/mowsContext/MowsContext"` (see e.g. `src/examples/badge/BadgeDocPage.tsx:5`) are confusing and grep-hostile (`lib/` matches both layers). Worse, the bug has been **propagated into a sibling package**, so a future fix has to land in two places. It also makes the public package structure ambiguous — what is the canonical place for non-component code?
- **Suggestion:** Pick a final taxonomy and stick with it. Either keep the outer name (`lib/`) but rename the inner one (e.g. `lib/internal/`, or split into `lib/utils/`, `lib/themes/`, `lib/i18n/` at the same level as `lib/components/`), or rename the outer build root (`src/lib`). Apply identically to both packages. Confirm the build/Vite alias paths first.

## Findings — Code duplication

### ⁉️ REPO-4 — 68 `*DocPage.tsx` files duplicate the same ~250-line shell with cosmetic differences
- **Status:** Deferred alongside ARCH-4 — same `<StandardDocPage>` abstraction unlocks both. Tracked in `.plans/component-demo-harness/PLAN.md` "Phase 2b" as the canonical follow-up branch.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/examples/*/[A-Z]*DocPage.tsx` (68 files, ~16,601 LOC combined)
- **Issue:** Every doc page repeats the same structure: identical imports (`DocPage`, `DocSection`, `DocSubsection`, `InstallationTabs`, `ManualSteps`, `ManualStep`, `BehaviourList`, `PropTable`, `CommandBlock`, `ExampleCard`, `CodeViewer`, `ExpandableCode`), the same `ANCHOR` constant style, the same `PACKAGE_INSTALL = "add mows-components-react"` literal, the same `useDocStrings` boilerplate (with the throw-on-missing-context check whose error message is the only thing that changes), the same `buildIndexItems(t)` shape, the same `buildBehaviourEntries(statements)` shape, and the same 7-section JSX (Installation → Examples → Usage → Composition → RTL → DefinedBehaviour → API Reference). Compare `BadgeDocPage.tsx` (250 lines), `CardDocPage.tsx` (266 lines), `ButtonDocPage.tsx` (303 lines) — the deltas are: the component name in the error string, the props list, the snippet, the anchor ids for the example subsections, and which examples appear.
- **Why it matters:** 16k lines is a maintenance bomb. Adding a section ("Accessibility", say), reordering the structure, or renaming an anchor in CLAUDE.md becomes 68 edits. The boilerplate also competes with the actual component-specific content (snippet + props + behaviour list) for attention in code review. CLAUDE.md (`# Doc pages`) explicitly says "doc pages are not free-form" and lists the required structure — that is exactly the kind of contract a single component can enforce. Today nothing prevents drift.
- **Suggestion:** Move the shell into a single `<ComponentDocPage>` (or `buildComponentDocPage(config)` helper) in `src/examples/harness/docPage/`. Each per-component page reduces to a config object: `{ tKey, anchors, install, usageSnippet, compositionSnippet, examples: [{anchor, exampleId}], behaviour: [...], props: [...] }`. The shell renders Installation/Examples/Usage/Composition/RTL/DefinedBehaviour/APIReference in the required order from this config. Net change: drop from ~16k LOC to ~3k LOC and make the structure mechanically enforced.

### ⁉️ REPO-5 — `useDocStrings` + "must be rendered inside `<MowsProvider>`" check is duplicated in every doc page
- **Status:** Deferred alongside ARCH-4 / REPO-4 — the helper hook lives inside the `<StandardDocPage>` primitive once the abstraction lands.
- **Severity:** Minor
- **File:** every `*DocPage.tsx` (e.g. `src/examples/badge/BadgeDocPage.tsx:69-75`, `src/examples/card/CardDocPage.tsx:80-86`, `src/examples/button/ButtonDocPage.tsx:89-95`)
- **Issue:** Each doc page has the same 7-line `useDocStrings = () => { const ctx = React.useContext(MowsContext); if (!ctx) { throw new Error(`<XDocPage> must be rendered inside <MowsProvider>`); } return ctx.t.example.examples.X; }`. The only varying part is the doc-key path (`.example.examples.button`, `.example.examples.badge`, ...).
- **Why it matters:** This is the same shape repeated 68 times — easy to drift (one page might forget the throw, or use `useMows()` differently). Throws also fire on first render, so the message gets read by humans; a tiny typo on one page would only surface for that component.
- **Suggestion:** Add `useDocStrings(componentKey: keyof Translation["example"]["examples"])` to `harness/docPage`. Or just inline it inside the proposed shell component (REPO-4).

### ⁉️ REPO-6 — `index.ts` per-example folder also follows a copy-paste pattern (68 of them, 1092 LOC)
- **Status:** Deferred alongside FUTURE-1 / FUTURE-2 — the filesystem-glob auto-discovery replaces both `index.ts` files AND `demos.tsx`'s manual registry in one shot. Tracked as the next harness-evolution branch after ARCH-4 lands.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/examples/*/index.ts`
- **Issue:** Every folder's `index.ts` defines `export const xxxExamples: ReadonlyArray<RegisteredExample> = [{ id: "default", source: defaultSource, ...defaultModule }, …]` plus an `xxxExampleById(id)` helper that throws on miss. This is mechanically uniform and consumed only by the corresponding doc page.
- **Why it matters:** Six lines of identical-shape code per component is 60–70 maintained files. Renaming `RegisteredExample` or `?raw` import shape would break 68 places.
- **Suggestion:** Generate the registry from a single `examples/registry.ts` that walks the folder via Vite's `import.meta.glob('./*/[A-Z]*.tsx', { eager: true, query: '?raw', as: 'raw' })` paired with the module glob. Per-folder index files disappear; lookups become `registry.get("badge", "default")` with the same throw-on-miss contract.

## Findings — Dead / orphaned code

### ✅ REPO-7 — Critical: `components/react/README.md` documents import paths that no longer exist (post-`atoms/` deletion)

**Fix:** Rewrote the four imports in `components/react/README.md` to use the new `appShell/...` paths (commandPalette, globalContextMenu, modalHandler, primaryMenu).
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/README.md:61-64`
- **Issue:** The README's "Minimal App.tsx" example still tells consumers to:
  ```
  import CommandPalette from "mows-components-react/components/atoms/commandPalette/CommandPalette";
  import GlobalContextMenu from "mows-components-react/components/atoms/globalContextMenu/GlobalContextMenu";
  import ModalHandler   from "mows-components-react/components/atoms/modalHandler/ModalHandler";
  import PrimaryMenu    from "mows-components-react/components/atoms/primaryMenu/PrimaryMenu";
  ```
  None of those `components/atoms/*` paths exist any more — they have all been moved under `components/appShell/*`. CLAUDE.md spells this out: "There is no `atoms/` bucket".
- **Why it matters:** This README is the entry point for every consuming app. CLAUDE.md says "All frontends must consume mows-components-react … Every consuming app must wrap its root in `<MowsProvider>` and mount the following four components". The four required components have broken import paths. Any new app following the README docs would fail to build.
- **Suggestion:** Update all four imports to the new `components/appShell/*` locations (e.g. `mows-components-react/components/appShell/commandPalette/CommandPalette`). While doing this, scrub the file for any other `/atoms/` references (none others found, but the search was narrow).

### ✅ REPO-8 — Critical: `apis/cloud/filez/components/react/get-file-icons.sh` still writes into the deleted `lib/components/atoms/FileIcon/` path

**Fix:** Deleted the script. Per filez `CLAUDE.md`, `FileIcon` lives in `mows-components-react` now and uses the upstream `vscode-material-icons` package — the script is fully obsolete.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/apis/cloud/filez/components/react/get-file-icons.sh:43,46,59,98,121`
- **Issue:** The script creates and writes to `./lib/components/atoms/FileIcon/`:
  - line 43: `mkdir -p ./lib/components/atoms/FileIcon/`
  - line 46: `cp ./vscode-material-icon-theme/src/core/icons/fileIcons.ts ./lib/components/atoms/FileIcon/fileIcons.ts`
  - line 59: `TEMP_FILE="./lib/components/atoms/FileIcon/fileIcons.temp.ts"`
  - line 98: `fs.writeFileSync('./lib/components/atoms/FileIcon/fileIcons.ts', result);`
  - line 121: human-facing echo telling the operator where the file landed.
  But the `atoms/` folder has been deleted from this package (filez React lib's CLAUDE.md says: "There is no `atoms/` bucket"), and `FileIcon` itself was moved up into `mows-components-react` (the new `components/react/lib/components/files/fileIcon/`).
- **Why it matters:** Running this script today re-creates the deleted folder and drops a 5000-line generated file into a path that is no longer wired into anything. The next person to look at the repo sees a phantom `atoms/FileIcon/` directory and either thinks the refactor is incomplete, or the script regenerates content that nothing consumes. Either way the script silently rots.
- **Suggestion:** Either (a) delete the script if `FileIcon` is no longer maintained from filez (the new `components/react/lib/components/files/fileIcon/FileIcon.tsx` says the icon set is bundled via `vscode-material-icons` directly, so filez doesn't need to mirror them), or (b) repoint the script at `mows-components-react/lib/components/files/fileIcon/` and document that it must be run from that package. Pick one and remove the dead path.

### ✅ REPO-9 — `lib/components/ui/steps.md` cross-references a demo set that no longer matches the file
- **Status:** Fixed — `steps.md:131` now points at `src/examples/steps/StepsDocPage.tsx` + lists the actual modes that ship.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/ui/steps.md:131`
- **Issue:** The line reads:
  ```
  - Demos: `src/uiDemos.tsx` — `Steps (Horizontal)` and `Steps (Vertical)`
  ```
  But the current `src/uiDemos.tsx` no longer contains `Steps (Horizontal)` / `Steps (Vertical)` entries — `Steps` was migrated to the new doc-page model (`src/examples/steps/StepsDocPage.tsx`), and `uiDemos` now lists a single `{ id: "steps", name: "Steps", render: () => <StepsDemo /> }` entry that itself just renders `<StepsDocPage />`.
- **Why it matters:** Doc rot. Anyone following the breadcrumb has to figure out the new convention themselves.
- **Suggestion:** Point the line at `src/examples/steps/`, or remove it altogether once the new doc-page is canonical.

### ⁉️ REPO-10 — `src/uiDemos.tsx` is a thin pass-through that competes with `demos.tsx` as the canonical demo registry
- **Status:** Deferred alongside FUTURE-1/REPO-6 — once the glob registry lands, both `uiDemos.tsx` and `demos.tsx` collapse into the auto-discovered list. Merging them ahead of time creates churn that the glob change would immediately invalidate.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/uiDemos.tsx` (182 LOC) consumed by `/home/paul/projects/mows/components/react/src/demos.tsx`
- **Issue:** `uiDemos.tsx` is now almost entirely a list of `{ id, name, render: () => <XDocPage /> }` entries (one per shadcn UI primitive) — it does not own any presentation logic. It also contains stale comments (`// ---- Button ----`, `// ---- Input / Textarea / Label ----`, etc.) that no longer correspond to inline demos, and a single `StepsDemo = () => <StepsDocPage />` wrapper that exists solely to bridge the old name. `demos.tsx` then `...uiDemos.map(...)` to merge them in.
- **Why it matters:** With everything now living under `src/examples/<component>/<X>DocPage.tsx`, the split between `demos.tsx` and `uiDemos.tsx` is just historical inertia. New contributors will not know whether to add to one, the other, or neither.
- **Suggestion:** Merge `uiDemos.tsx` into `demos.tsx` (or replace both with a single auto-discovered registry over `src/examples/*/[A-Z]*DocPage.tsx`, see REPO-6). Delete the stale `// ---- Button ----` comment markers either way.

## Findings — Superseded code not removed

### ⁉️ REPO-11 — `VmList.tsx` deleted; no leftover references (verified clean)
- **Severity:** Informational (no action needed)
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmList.tsx` (deleted)
- **Issue:** Cross-checked: grep for `VmList`, `AgentPane`, `StatusBadge`, `VmConsole` against `utils/mows-vm-supervisor/web/src` produced no orphan imports. References to `VmDisplay*` were either to the new Rust enum `VmDisplayMode` (api/vms.rs) or the new `VmDisplayModeChoice` type in modals — those are intentional new names, not stragglers.
- **Why noted:** Verifies the supersession story is clean. No fix needed; included so a future reviewer doesn't redo the check.

## Findings — Consistency

### ⁉️ REPO-12 — Single PascalCase folder breaks the camelCase folder convention used by every other component
- **Status:** Deferred — Renaming `list/ResourceList/` → `list/resourceList/` requires updating every `from "../../lib/components/list/ResourceList/..."` site (~30+ sites between mows-components-react + filez + supervisor web + the harness tests). Mechanical but high-blast-radius for a pure-style fix. Same as REPO-1 — bundles with the next naming-convention sweep branch.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/list/ResourceList/` and `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/list/ResourceList/` (mirrored)
- **Issue:** Every component folder under `lib/components/` is camelCase: `actionDisplay/`, `keyComboDisplay/`, `commandPalette/`, `dateTimePicker/`, `fileIcon/`, `videoViewer/`, etc. The single exception is `list/ResourceList/`.
- **Why it matters:** Mixed convention forces every contributor to look up which spelling is correct. Inside `ResourceList/` itself you also find a `rowHandlers/` subfolder (camelCase), making the PascalCase outer name even more out-of-place.
- **Suggestion:** Rename `list/ResourceList/` → `list/resourceList/` (in both packages). The `.tsx`/`.test.tsx` files stay PascalCase since that's the project's file convention.

### ✅ REPO-13 — `lib/hooks/use-mobile.tsx` uses kebab-case, every other hook file uses camelCase
- **Status:** Fixed — Renamed `lib/hooks/use-mobile.tsx` → `lib/hooks/useIsMobile.tsx`. The single importer (`lib/components/ui/sidebar.tsx`) updated. Hook directory naming is now uniformly camelCase across the package.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/hooks/use-mobile.tsx`
- **Issue:** This is the only file in the package whose filename uses kebab-case (`use-mobile.tsx`). Every other hook in the codebase uses camelCase: `lib/components/dateTime/dateTimePicker/useDateTimePicker.ts`, `lib/components/dateTime/dateTimeRangePicker/useDateTimeRangePicker.ts`. Inside the file the hook is named `useIsMobile`. This naming was inherited from shadcn's `sidebar.tsx` (`import { useIsMobile } from "@/hooks/use-mobile"`), so the kebab name leaked in.
- **Why it matters:** Inconsistent file naming is a small but loud signal that the package taxonomy is half-applied. New hooks will get added in either style and the inconsistency multiplies. Also the file lives under `lib/hooks/`, which is a brand-new top-level folder — every other hook lives next to its consuming component. This creates a third location for the same kind of thing (`lib/components/<group>/<component>/useX.ts` vs `lib/hooks/`).
- **Suggestion:** Either keep the shadcn convention everywhere (rename `useDateTimePicker.ts` → `use-date-time-picker.ts` for consistency — unlikely desirable) or rename the file to `useIsMobile.tsx` and update the one importer (`lib/components/ui/sidebar.tsx:6`). Also: decide whether `lib/hooks/` is the canonical hook home, or fold the file into `lib/lib/` (where `use-mobile` is a domain-agnostic utility hook).

### ✅ REPO-14 — Inconsistent file organization inside `files/fileViewer/formats/`: parents (Image, Image360, Video) sit flat, support files live in a subfolder
- **Status:** Fixed — Moved all three format viewers into their own camelCase subfolders (`imageViewer/`, `image360Viewer/`, `videoViewer/`). `VideoViewer.tsx` now sits next to its helpers in `videoViewer/`; its `./videoViewer/X` imports become `./X`. Updated 14 import sites + the `vi.mock(\`./videoViewer/shakaModule\`)` path inside the test. `pnpm vitest run lib/components/files/fileViewer` — 50/50 pass; the two pre-existing tsc errors (`virtual:mows-file-icons` ambient, `SelectMarkerEvent` upstream typings) are unrelated to this change.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/`
- **Issue:** The directory contains a mix of flat single files (`ImageViewer.tsx`, `Image360Viewer.tsx`, `VideoViewer.tsx` and their `.test.tsx`/`.md`) and a subfolder `videoViewer/` containing the video viewer's support files (`ControlBar.tsx`, `SeekPreview.tsx`, `frameGrabber.ts`, `keyboard.ts`, `mimeType.ts`, `shakaModule.ts`, `types.ts`). So `VideoViewer.tsx` is a sibling of its own internal directory.
- **Why it matters:** Either the format viewers are top-level components (in which case each should have its own folder — `videoViewer/VideoViewer.tsx`, `imageViewer/ImageViewer.tsx`) or they are flat (in which case the support files belong somewhere consistent). Today's mix means the next person adding a viewer has to guess which pattern to follow.
- **Suggestion:** Pick one. Either move all three viewers into their own subfolders (matching the existing convention for every other component), or pull the videoViewer support files up next to `VideoViewer.tsx` with a `videoViewer_` prefix. Most other folders in this package follow "one component, one folder" — apply it here too: rename `VideoViewer.tsx` → `videoViewer/VideoViewer.tsx`, `ImageViewer.tsx` → `imageViewer/ImageViewer.tsx`, `Image360Viewer.tsx` → `image360Viewer/Image360Viewer.tsx`.

### ⁉️ REPO-15 — Mixed import styles: 193 `@/` aliased vs ~492 deep relative `../../...` paths
- **Severity:** Minor
- **Status:** Deferred — Codemod-driven mass change (~492 sites to flip from relative to `@/`). The codemod itself is straightforward (`jscodeshift` or even a regex sed) but landing a 492-file diff inside this review-fix branch dwarfs every other change and forces a separate "imports normalization" review pass. The ESLint `no-restricted-imports` rule the reviewer suggests is the right enforcement once the codemod runs.
- **File:** repo-wide (sample: `lib/components/actions/keyComboRecorder/KeyComboRecorder.tsx` uses `@/components/...`; `src/examples/badge/BadgeDocPage.tsx` uses `../../../lib/components/...`)
- **Issue:** `tsconfig.app.json` declares `"@/*": ["./lib/*"]` so `@/components/ui/button` and `../../lib/components/ui/button` resolve to the same file. Today there are ~193 occurrences of `from "@/...`" and ~492 occurrences of `from "../../..."` in `src/` alone. Some files even mix the two styles within a single file (compare doc pages that import `../../../lib/components/...` for everything except `@/lib/utils`).
- **Why it matters:** Renames and moves break deep relative paths but not aliases. Code review is harder because two equivalent imports look different. Search across the codebase has to use both spellings.
- **Suggestion:** Standardise on `@/` for everything that points at `lib/`. Add an ESLint rule (`no-restricted-imports` with a regex on `../**/lib/...`) and run a one-shot codemod. Document the rule in `components/react/CLAUDE.md`.

### ⁉️ REPO-16 — Translation files: 67 identical copies of installation step strings make i18n drift inevitable
- **Status:** Deferred alongside ARCH-4 — the shared installation chrome strings move into the `<StandardDocPage>` primitive's translation namespace once that lands. Doing the lift now would require updating every existing DocPage's translation key path; doing it after ARCH-4 means each DocPage's translation tree shrinks by ~30 lines automatically.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/languages/en-US.ts` and `…/de.ts`
- **Issue:** Each of the 67 doc pages has its own `doc.installation` block under `example.examples.<component>`. `manualStep1: "Install the following dependencies:"` appears verbatim 67 times in en-US.ts (verified via `awk`), and 67 times in de.ts. `commandTab: "Command"`, `manualTab: "Manual"`, `installation.title: "Installation"` follow the same pattern. **The German file already has two different translations** of the same English line (`manualStep3: "Passe die Import-Pfade an deine Projektstruktur an."` vs `"Passe die Importpfade an dein Projekt an."`) — concrete proof of the drift this duplication enables.
- **Why it matters:** The `manualStep*` / `commandTab` / `manualTab` strings are not component-specific; they are part of the doc-page chrome (REPO-4). Today every translator edits every component's section to fix a typo. The German drift is happening already; fixing one and forgetting the other 66 is the default failure mode.
- **Suggestion:** Lift the shared doc-page chrome strings into a single `example.docPage.installation`, `example.docPage.usage`, etc. block. Component-specific keys keep only the component-specific copy (variant titles, behaviour statements, prop intros). This also enables REPO-4 (single doc-page component) — the shell component can read its chrome strings once instead of 67 times.

### ⁉️ REPO-17 — Translation files are 2700-3800 lines each, with everything in one nested object
- **Status:** Deferred alongside FUTURE-4 / FUTURE-5 / FUTURE-6 — same root cause and same blocker (no `Partial<Translation>` + fallback proxy yet). The per-component split lands as part of the i18n-namespacing infra branch.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/languages.ts` (2731 lines), `src/languages/en-US.ts` (3776 lines), `src/languages/de.ts` (3770 lines)
- **Issue:** These three files hold the entire example-app translation as a single deeply-nested literal. The `Translation` interface in `languages.ts` mirrors the structure with explicit per-component subtree types. Editing one component's strings means opening a multi-thousand-line file and scrolling for hundreds of lines to find the right block. There is no enforcement that the en-US and de structures stay in sync beyond the TS compiler typing both as `Translation`.
- **Why it matters:** Merge conflicts on a single file with 3770 changing lines are very painful. The cognitive load when adding a component is high — author has to add interface keys in `languages.ts`, the en-US tree, and the de tree, all in one PR. Splitting per-component would make ownership obvious and trim the per-file diff.
- **Suggestion:** Split per-component (mirroring the `lib/components/<group>/<component>/` taxonomy). E.g. `src/languages/en-US/index.ts` re-exports `import button from "./button"; import card from "./card";`. The `Translation` interface stays one file (or gets split too). Same for `de`. Net effect: a component change touches `languages.ts` + `<lang>/<component>.ts` × 2, not three multi-thousand-line files.

### ⁉️ REPO-18 — Inconsistent test placement: most tests co-located, harness tests under `examples/harness/`
- **Status:** Deferred — DocPage smoke tests need either (a) full provider mount per test (slow, but cheap) or (b) a shared harness-test scaffold (faster, but requires extracting the mount into a reusable utility). Both belong inside the ARCH-4 follow-up branch alongside `<StandardDocPage>` since that primitive becomes the natural unit-test target ("DocPage renders all 7 sections in the right order" against the config). The `behaviourEntryIntegrity.test.ts` already covers the doc-content correctness side.
- **Severity:** Minor
- **File:** various
- **Issue:** Component tests live next to source (`lib/components/<group>/<component>/<X>.test.tsx`) — 71 such tests. `src/examples/` contains 6 tests (`harness/cleanExampleSource.test.ts`, `harness/ExampleCard.test.tsx`, `harness/registryIntegrity.test.ts`, `harness/serializeState.test.ts`, `harness/docPage/BehaviourList.test.tsx`, `harness/docPage/renderInlineMarkup.test.tsx`). That's fine — harness logic is example-app code, not library code. But there are no tests for any `*DocPage.tsx` file (`registryIntegrity.test.ts` only checks the example registry). The DocPage shell logic (anchor ids, section order, behaviour-to-test mapping) is not test-covered. CLAUDE.md (`Per-component tests`) requires tests for every variant/mode in the library; the same standard should apply to the harness primitives.
- **Why it matters:** The doc-page mechanism is the main UX surface for the entire package — if it breaks, the docs site is broken. Today nothing catches "DocPage no longer renders the API Reference section" or "InstallationTabs swapped Command and Manual labels".
- **Suggestion:** Add a smoke test per DocPage primitive (`DocPage.test.tsx`, `DocSection.test.tsx`, `InstallationTabs.test.tsx`, etc.) — most of these primitives are already covered transitively, but explicit tests catch regressions faster than tracing through 67 doc pages. If REPO-4 (config-driven doc page) lands, a single test against the shell exercises every page.

## Findings — .gitignore completeness

### ✅ REPO-2 — Critical: `.tmp/` directory with 8 PNG screenshots committed (or staged) into the repo, no gitignore entry

**Fix:** Added `.tmp` to `components/react/.gitignore`; deleted the 8 PNGs (`rm -rf components/react/.tmp`).
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/.tmp/` (8 PNGs: `debug-thumb.png`, `videoviewer-auto-pick.png`, `videoviewer-hover-preview.png`, `videoviewer-quality-menu.png`, `videoviewer-seek-hover.png`, `videoviewer-thumb-hover.png`, `videoviewer-thumb-preview.png`, `videoviewer-thumb-real.png`)
- **Issue:** `git ls-files --others --exclude-standard` lists all 8 files, meaning they are untracked AND not ignored, so `git add -A` or a sloppy `git add components/react/` would commit them. Neither `/home/paul/projects/mows/.gitignore` nor `/home/paul/projects/mows/components/react/.gitignore` contains `.tmp` in any form (grep count = 0).
- **Why it matters:** Binary assets in a code repo bloat it permanently (Git keeps history forever). The path "`.tmp/`" plus filenames like `debug-thumb.png`, `*-hover-preview.png` make it obvious these are throwaway dev artefacts. They have to be cleaned up now, before someone commits them.
- **Suggestion:** Add `.tmp/` to `/home/paul/projects/mows/components/react/.gitignore` (and optionally also to root `.gitignore`). Then delete the directory locally. While we're at it, the convention used by every other tool is `tmp/` (without the leading dot) — pick one and document it.

### ⁉️ REPO-3a — Generated `openapi.json` is tracked for filez/manager but untracked for mows-vm-supervisor — inconsistent treatment of build artefacts
- **Status:** Accepted as deliberate divergence. `utils/mows-vm-supervisor/.gitignore` documents the reasoning inline: every `src/api/*.rs` edit regenerates `openapi.json`, and tracking would produce a noisy diff on every PR. Filez/manager track theirs because their TS client is consumed by a separate front-end repo; supervisor's TS client lives in the same workspace and is regenerated from source. CLAUDE.md (filez) and `scripts/codegen.sh` (supervisor) both spell out when to rerun codegen.
- **Severity:** Major
- **File:** `apis/cloud/filez/server/openapi.json` (tracked), `manager/openapi.json` (tracked), `utils/mows-vm-supervisor/openapi.json` (untracked, listed in `git ls-files --others --exclude-standard`)
- **Issue:** Commit 096f15d3 says "generate openapi.json at build time instead of from a live server". `utils/mows-vm-supervisor/scripts/codegen.sh` deletes and regenerates `openapi.json` from a `cargo run --bin openapi_dump`. But the file is committed for filez/manager and uncommitted for mows-vm-supervisor — three packages, three treatments. The corresponding TS client `web/src/api/generated/api-client.ts` is also untracked-but-needed under mows-vm-supervisor.
- **Why it matters:** Either the build artefacts get checked in (then every build creates diff noise that contributors have to ignore) or they don't (then a fresh clone needs to run codegen before anything builds). Mixing both is the worst of both worlds. The CLAUDE.md states: "frontend api clients should NEVER be created manually but always using the openapi spec and client generators" — i.e. the codegen step is mandatory, which argues for keeping artefacts out of git.
- **Suggestion:** Pick one. If artefacts stay tracked: track all three identically and add a CI check that `codegen.sh && git diff --exit-code` succeeds. If artefacts are excluded: add `openapi.json` and `web/src/api/generated/` to package-level `.gitignore`s and untrack the existing files (`git rm --cached`). Document the choice in root CLAUDE.md.

### ✅ REPO-3 — Root `.gitignore` is too thin given the polyglot repo
- **Status:** Fixed in the first fix-batch — root `/home/paul/projects/mows/.gitignore` now ships `.DS_Store`, `.idea/`, `.vscode/`, `*.swp`, `*.swo`, `dist/`, `dist-ssr/`, `.tmp/`, `*.log`, `npm-debug.log*`, `pnpm-debug.log*`, `yarn-debug.log*` alongside the original entries.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/.gitignore`
- **Issue:** Root file contains only `/target`, `.aider*`, `node_modules`, `.claude*`, `.yalc`, `yalc.lock`. There is no entry for: `.tmp/`, `dist/`, `dist-ssr/`, `*.log`, `*.DS_Store`, `*.idea/`, `*.vscode/`, generated `openapi.json` if it is supposed to be regenerated, or build artefacts under `utils/mows-vm-supervisor/codegen/`. The per-package `components/react/.gitignore` has the React-specific bits but they will not help any other package.
- **Why it matters:** Every new subpackage now has to remember to copy the appropriate ignores. The previous commit (`096f15d3`) says openapi.json is now generated at build time — but I don't see a corresponding gitignore rule, which could cause weird diffs.
- **Suggestion:** Centralise common ignores (logs, OS/editor files, dist directories, `.tmp/`) at the repo root, and keep package-specific ones in package gitignores.

## Findings — Other

### ⁉️ REPO-19 — Two parallel `languages/` layouts in the same package risk future confusion
- **Status:** Deferred alongside REPO-17 — once the app-level translation tree splits per component, the two layouts converge naturally (both become `<lang>/<component>.ts` files). Moving the convention without splitting the file would just create a third layout to be inconsistent with.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/lib/languages/<lang>/default.ts` vs `/home/paul/projects/mows/components/react/src/languages/<lang>.ts`
- **Issue:** Same package has two language-tree conventions: under `lib/lib/languages/de/default.ts` (220 LOC) is the generic library translation, and under `src/languages/de.ts` (3770 LOC) is the example-app translation that extends it. Folder layout differs (subfolder + `default.ts` vs flat single file) and naming differs (one is a folder per language, the other a file per language). The same dual layout is mirrored in `apis/cloud/filez/components/react/lib/lib/languages/{de,en-US}/default.ts`.
- **Why it matters:** Whoever next adds a language file has to pick a side, and the two patterns will keep drifting. CLAUDE.md says "Generic translations live in `lib/lib/languages/<lang>/default.ts`" — that contract is fine, but having two different shapes inside one package makes the rule less obvious.
- **Suggestion:** Pick a shape (preferably folder-per-language with multiple files, as the lib already does) and apply it on both sides. After REPO-17 splits the src translations per-component, the convergence is natural: `src/languages/<lang>/{button,card,...}.ts` matches `lib/lib/languages/<lang>/{primaryMenu,videoViewer,...}.ts`.

### ⁉️ REPO-20 — Cargo.lock shows 256-line change with no obvious Cargo.toml story
- **Status:** Accepted — `cargo tree --depth 0 --workspace` was run against `main` and the branch (per the reviewer's own suggestion in the prior fix-batch); the diff lines up with the explicit Cargo.toml additions in the supervisor (`subtle`, `argon2`, `tower_governor`, `petname`, `percent-encoding`, the workspace `tracing-subscriber` promotion, etc.). No unrelated `cargo update` churn.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/Cargo.lock`
- **Issue:** `git diff --stat Cargo.lock` shows `+244 / -12` lines. The branch's Cargo.toml manifests have been edited (notably `utils/mows-vm-supervisor/Cargo.toml`), but Cargo.lock churn of this size deserves a sanity check that it is purely the consequence of intentional dependency adds and not the byproduct of someone running `cargo update` on the side.
- **Why it matters:** Cargo.lock churn that doesn't trace back to a Cargo.toml change is one of the most common silent regression vectors (unintended dep upgrades, transitive yanks, MSRV drift).
- **Suggestion:** Before staging the lockfile, run `cargo tree --workspace --depth 0 > before` against `main`, then on the branch and diff. If the only delta lines up with the explicit Cargo.toml diffs, commit. Otherwise drop the unrelated lock churn (`git checkout main -- Cargo.lock && cargo build` to regenerate cleanly).

### ⁉️ REPO-21 — Sample assets shipped at full resolution under `src/assets/samples/` (1.5 MB JPG)
- **Status:** Accepted — Demo assets for `Image360Viewer` need actual 4000px source so the panorama unwraps with enough detail to demonstrate the viewer's pan/zoom. A 1024px version would look pixelated and undermine the demo's purpose. Production consumers of `mows-components-react` don't ship `src/assets/` — only `lib/` is published (verified via `package.json::files`); the 1.5MB JPG only matters in the docs harness, where it lazy-loads when the user navigates to `/Image360Viewer`.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/assets/samples/panorama-4000.jpg` (1.5 MB), `landscape-2000.webp` (312 KB)
- **Issue:** These are sample assets used by `Image360Viewer` / `ImageViewer` demo cards. Reasonable to include for the demo app, but a 1.5 MB JPG bloats the working copy for every contributor and lands in every yalc-published bundle slice unless the library build is careful to exclude them.
- **Why it matters:** A 4000px-wide JPG is overkill for a sample (a 1024px JPG would be ~300 KB). Multiplied across the team and CI caches, this adds up. The Image360Viewer demo will load it on every page hit in dev.
- **Suggestion:** Either move samples to `public/samples/` so they are static (loaded only when the demo opens) or re-encode the panorama to a smaller quality preset and store it under `src/assets/samples/`. Confirm `vite.config.ts` (library mode) excludes `src/assets/samples/*` from the published library bundle.

### ✅ REPO-22 — `lib/main.ts` audit recommended after the `atoms/` flattening
- **Status:** Verified — `grep "components/atoms/" components/react/lib/main.ts apis/cloud/filez/components/react/lib/main.ts` returns 0 matches in both packages. Every re-export points at the new semantic-group path. The ESLint `no-restricted-imports` rule banning the substring `/components/atoms/` lands as part of REPO-15's lint sweep.
- **Severity:** Minor (verification task)
- **File:** `/home/paul/projects/mows/components/react/lib/main.ts` and `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/main.ts`
- **Issue:** Now that the `atoms/` flattening is done, the public surface should be re-checked: (a) every re-export points at the new semantic-group path (no `components/atoms/...` strings), (b) the export order matches the new taxonomy. The filez `main.ts` already has the new layout and a "Filez components reorganized 2026-05-12" comment — confirm the same audit on the mows-components-react `main.ts`.
- **Suggestion:** Add a CI step `pnpm tsc --noEmit` for both packages and an ESLint `no-restricted-imports` rule that bans the literal substring `/components/atoms/`. That converts REPO-7 / REPO-8 / REPO-22 into a one-line lint failure if they ever recur.
