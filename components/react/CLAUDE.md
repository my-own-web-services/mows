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
