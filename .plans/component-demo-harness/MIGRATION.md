# Doc page migration tracker

**Target:** every component currently registered in `src/demos.tsx` or
`src/uiDemos.tsx` gets its own `<Component>DocPage` following the doc page
contract documented in `components/react/CLAUDE.md` › "Doc pages".

## Doc page contract (recap)

Each page:

- Uses `<DocPage indexItems>` shell with nested `<PageIndex>` rail.
- Has these sections in order: **Installation · Usage · Composition ·
  Examples · RTL · Defined behaviour · API Reference**.
- Uses only the harness primitives: `<DocSection>`, `<DocSubsection>`,
  `<InstallationTabs>`, `<CommandBlock>`, `<ManualSteps>`/`<ManualStep>`,
  `<ExampleCard hideHeader>`, `<ExpandableCode>` + `<CodeViewer fitContent>`,
  `<BehaviourList>`, `<PropTable>`. No raw `<section>`/`<h3>`/`<table>`.
- Anchor ids unprefixed (`installation`, `examples-…`, `api-reference`).
- All narrative + example metadata translated via the existing
  `Translation` interface. Prop / Type / Default / Description column
  labels stay English. JSX-tag mentions promoted via `renderInlineMarkup`
  through `renderDescription`.
- Per-example files under `src/examples/<component>/*.tsx`, each
  registered in `src/examples/<component>/index.ts`. Source loaded via
  `?raw`.

## Status

Legend: ✅ done · 🔧 partial · ❌ todo · ➖ N/A

### Pilot (already on the new contract)

- ✅ Steps — `StepsDocPage` is the reference implementation.

### Migrated

- ✅ PageIndex — `PageIndexDocPage`. Default + Nested examples. 10
  behaviour statements linked.
- ✅ CodeSnippet — `CodeSnippetDocPage`. Block / Inline / Languages
  examples. 6 behaviour statements linked.
- ✅ FileIcon — `FileIconDocPage`. Default / Sizes / Fallback examples. 7
  behaviour statements linked.
- ✅ SectionHeading — `SectionHeadingDocPage` (new demos entry added).
  Default / Levels examples. 8 behaviour statements linked.
- ✅ CodeViewer — `CodeViewerDocPage`. Default / Editable / FitContent
  examples. 2 behaviour statements (the test file only has 2).
- ✅ CodeThemePicker — `CodeThemePickerDocPage`. Popover / Standalone
  examples. 4 behaviour statements linked.

### Not started — `lib/components/` library components (~30)

Order of migration: navigation → code → input → ui primitives → bigger
surfaces.

**Group: navigation/**

- _(all migrated)_

**Group: code/**

- ❌ ExpandableCode _(needs tests — no test file yet)_

**Group: actions/**

- ❌ ActionDisplay
- ❌ KeyComboDisplay
- ❌ KeyboardShortcutEditor
- ❌ KeyComboRecorder

**Group: appShell/**

- ❌ PrimaryMenu
- ❌ CommandPalette
- ❌ GlobalContextMenu
- ❌ ModalHandler

**Group: console/**

- ❌ Terminal
- ❌ LogView
- ❌ MachineMonitor

**Group: dateTime/**

- ❌ DateTime (DateTimeDisplay)
- ❌ DateTimePicker
- ❌ TimePicker
- ❌ TimezoneSelector
- ❌ DateTimeRangePicker

**Group: files/**

- ❌ FileViewer
- ❌ Image360Viewer

**Group: identity/**

- ❌ Avatar

**Group: input/**

- ❌ ButtonSelect
- ❌ CopyValueButton
- ❌ InlineEdit
- ❌ NumberInput
- ❌ OptionPicker
- ❌ SearchInput
- ❌ SearchSelectPicker

**Group: list/**

- ❌ ResourceList

**Group: settings/**

- ❌ SettingsPanel
- ❌ LanguagePicker
- ❌ ThemePicker
- ❌ LoggingConfig

### Not started — `ui/` shadcn primitives (~25)

These are smaller surfaces. Each gets a single DocPage with minimal
sections (Installation / Composition / Examples / API Reference).

- ❌ Badge · Button · Calendar · Card · Checkbox · ContextMenu · Dialog
- ❌ DropdownMenu · HoverCard · Input · InputGroup · Label · Popover
- ❌ Progress · RadioGroup · Resizable · ScrollArea · Select · Skeleton
- ❌ Slider · Sonner · Switch · Tabs · Textarea · Compass

## Execution rules

- One component per commit, smallest reasonable diff.
- After every migration: run `pnpm vitest run` and skim the rendered page
  in the dev server.
- Translation keys added in both `en-US.ts` and `de.ts` in the same
  change.
- Don't drop the existing demo function until the new DocPage renders
  cleanly through `demos.tsx`.
- For each migrated component, update `components/react/<Component>.md`
  if any new example file added a behaviour the component-level doc
  didn't mention.

## Verification checklist per component

- [ ] DocPage file at `src/examples/<component>/<Name>DocPage.tsx`
      composing only harness primitives.
- [ ] Per-example files in `src/examples/<component>/*.tsx` registered in
      `index.ts` with `?raw` source imports.
- [ ] Translations under `example.examples.<component>.{…,doc}` in
      `languages.ts`, `languages/en-US.ts`, `languages/de.ts`.
- [ ] `demos.tsx` entry switched to `() => <Name>DocPage />`.
- [ ] `BehaviourList` entries point at real tests (file:line + name).
- [ ] `PropTable` rows cover every prop in the component's TS interface.
- [ ] `pnpm vitest run` passes.
- [ ] Browser-verified at `/<Name>` — page index works, hash navigation
      works, every example renders, prop table looks right.
