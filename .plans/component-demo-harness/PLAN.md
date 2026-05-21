# Component Demo Harness — shadcn-docs-style examples

## Goal

Replace the single-blob "one demo per component" page in
`components/react/src/` with a richer per-example layout, modeled on the
shadcn/ui docs. Each component should ship many small examples; each example
gets its own card containing:

- A headline + description
- A live preview of the component
- The exact source code that produced the preview
- A live view of the example's current state

## Why

The current `uiDemos.tsx` / `demos.tsx` files compress every variant of a
component into one `<Frame>` per component. That's good as a smoke test but
poor as documentation: there is no canonical "how do I write this" snippet,
no per-example narrative, and no visibility into what controlled state the
demo holds. shadcn's site solves all three with the preview/code/state
triptych per example.

## Non-goals

- Migrating every demo in one shot. We build the harness + migrate `Steps`
  first as the proof point, then convert the other ~55 demos incrementally.
- Authoring tooling (live editing of examples in-page). The CodeViewer is
  read-only here.
- Publishing the harness as part of the library. It lives in
  `src/` — it's the demo app, not a library export.

## Current state

- `components/react/src/uiDemos.tsx` (~25 demos) and `demos.tsx` (~30 demos)
  each export an array of `{ id, name, render }`.
- `demos.tsx` merges the two into a single `DemoEntry[]` and the sidebar
  renders one entry per component.
- A shared `<Frame>` / `<DemoFrame>` wrapper provides a card-like container
  per demo.
- All copy is translated through the `Translation` interface. `Steps` already
  has translation keys (`example.ui.steps.*`) and a doc page
  (`lib/components/ui/steps.md`).
- The library already ships a `<CodeViewer>` (Monaco-based, supports `tsx`
  and `json`) — we'll reuse it.

## Design

### File layout

```
components/react/src/
  examples/
    harness/
      ExampleCard.tsx       # The Card with preview / code / state tabs.
      ExamplePage.tsx       # Renders the stack of cards for one component.
      useExampleState.ts    # Hook + provider used by example components to
                            #   publish their live state to the harness.
      types.ts              # ExampleModule type contract.
    steps/
      Horizontal.tsx        # Each file = one example. Default export is the
      Vertical.tsx          #   ExampleModule (title, description, Example).
      StatusOverride.tsx
      index.ts              # Re-exports the registry for this component,
                            #   including the raw source via `?raw` imports.
    button/
      ...                   # (later phases)
```

### `ExampleModule` contract

```ts
// src/examples/harness/types.ts
import type { Translation } from "../../languages";

type Examples = Translation["example"]["examples"];

/**
 * A typed accessor into the `example.examples.*` translation slice.
 * `(t) => t.steps.horizontal` etc. The harness calls this with the live
 * translation object and reads `.title` / `.description`.
 */
export type ExampleStringsSelector = (
    t: Examples
) => { title: string; description: string };

export interface ExampleModule {
    readonly strings: ExampleStringsSelector;
    readonly Example: React.ComponentType;
}

export interface RegisteredExample extends ExampleModule {
    readonly id: string;
    readonly source: string;   // raw TSX of the example file
}
```

Each example file:

```tsx
// src/examples/steps/Horizontal.tsx
import { useState } from "react";
import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [current, setCurrent] = useState(1);
    useExampleState({ current, orientation: "horizontal" });
    return (
        <Steps current={current}>
            <Step title="Account" description="Sign up" />
            <Step title="Profile" />
            <Step title="Review" />
            <Step title="Done" />
        </Steps>
    );
};

const module: ExampleModule = {
    strings: (t) => t.steps.horizontal,
    Example
};
export default module;
```

The example file itself is what the Code tab shows. **The `Step` /
`Steps` titles, descriptions, and any inline button labels remain
hardcoded English** so the source snippet stays a working
copy-pasteable example. Translating user-facing strings *inside* the
example would corrupt the very thing the Code tab is supposed to teach.

The translation system only covers the example's *meta* (its title and
description as shown in the card header), via the `strings` selector
above.

Component registry:

```ts
// src/examples/steps/index.ts
import horizontal from "./Horizontal";
import horizontalSource from "./Horizontal.tsx?raw";
import vertical from "./Vertical";
import verticalSource from "./Vertical.tsx?raw";

export const stepsExamples: RegisteredExample[] = [
    { id: "horizontal", source: horizontalSource, ...horizontal },
    { id: "vertical",   source: verticalSource,   ...vertical }
];
```

`?raw` is the standard Vite suffix for raw-text imports — no plugin needed.
Source stays in lockstep with the rendered preview because they come from
the exact same file.

### `useExampleState` hook

The example must be able to publish its live state to the harness without
the harness needing to know each example's specific shape.

```ts
// src/examples/harness/useExampleState.ts
const ExampleStateContext = React.createContext<
    ((state: unknown) => void) | null
>(null);

export const ExampleStateProvider: FC<{
    children: ReactNode;
    onChange: (state: unknown) => void;
}> = ({ children, onChange }) => (
    <ExampleStateContext.Provider value={onChange}>
        {children}
    </ExampleStateContext.Provider>
);

export const useExampleState = (state: unknown): void => {
    const onChange = useContext(ExampleStateContext);
    const serialized = useMemo(
        () => JSON.stringify(state),
        [state]
    );
    useEffect(() => {
        onChange?.(state);
        // serialize-based key prevents identity churn when the example
        // builds a fresh object literal each render.
    }, [serialized, onChange]);
};
```

`<ExampleCard>` owns a `useState<unknown>(null)` for the published state and
passes the setter into `ExampleStateProvider`. Examples that don't publish
state simply omit the hook; the State tab then shows "no state reported".

### `ExampleCard` layout

```
┌─────────────────────────────────────────────────────────┐
│ CardHeader                                              │
│   CardTitle:       title                                │
│   CardDescription: description                          │
├─────────────────────────────────────────────────────────┤
│ CardContent                                             │
│   Tabs (defaultValue="preview")                         │
│     TabsList: [ Preview | Code | State ]                │
│     TabsContent preview: <ExampleStateProvider>         │
│                              <Example />                │
│                          </ExampleStateProvider>        │
│     TabsContent code:    <CodeViewer code source/>     │
│     TabsContent state:   <CodeViewer code=json/>       │
│                          or "no state reported" empty   │
└─────────────────────────────────────────────────────────┘
```

The example renders in every tab so its state stays alive — `<Tabs>`
unmounts inactive content by default, so we'll either set `forceMount` on
the preview or hoist the `<Example />` outside the tabs and put the tabs
purely around the code/state. The hoisted variant is simpler and avoids
double-mounting:

```
┌ Card ────────────────────────────────────────────┐
│ Header (title / description)                     │
│ ───────────────────────────────────────────────  │
│ Preview region: <ExampleStateProvider>           │
│                    <Example />                   │
│                  </ExampleStateProvider>         │
│ ───────────────────────────────────────────────  │
│ Tabs (defaultValue="code")                       │
│   TabsList: [ Code | State ]                     │
│   Code:  <CodeViewer code source language=tsx>   │
│   State: <CodeViewer code=json   language=json>  │
└──────────────────────────────────────────────────┘
```

### `ExamplePage`

```tsx
const ExamplePage: FC<{ examples: RegisteredExample[] }> = ({ examples }) => (
    <div className="flex flex-col gap-6">
        {examples.map((ex) => (
            <ExampleCard key={ex.id} {...ex} />
        ))}
    </div>
);
```

The existing `DemoEntry` keeps its `render: () => ReactNode` shape so
un-migrated demos still work. A migrated entry becomes
`render: () => <ExamplePage examples={stepsExamples} />`.

### Source rendering

`?raw` imports give us the full file including imports and the
`ExampleModule` boilerplate. The canonical cleanup lives in
`src/examples/harness/cleanExampleSource.ts` (DOC-25 — keep this section
in sync with that file's behaviour; `cleanExampleSource.test.ts` is the
authoritative spec). What it actually does today:

1. **Strip harness imports.** Any `import … from "../harness/…"` or
   `import … from "./harness/…"` line is removed wholesale (covers
   `ExampleModule`, `RegisteredExample`, harness types) — broader than
   the original plan, which only mentioned `useExampleState`.
2. **Strip `useExampleState(…)` calls** even when the call spans
   multiple lines. The implementation tracks paren depth so a multi-line
   `useExampleState({ open: false, onChange: …, … })` is removed as a
   single unit, not just the first line.
3. **Strip the `ExampleModule` trailer.** Everything from the
   `const module: ExampleModule = { … }; export default module` literal
   onward is dropped — readers shouldn't copy the harness's
   internal registration into their own app.

The previous bullet about a "regex-based" implementation was misleading:
multi-line paren tracking is intentionally stateful. Treat
`cleanExampleSource.test.ts` as the contract and update both this section
and the test together if the cleanup rules ever change.

## Locked decisions

1. **Translation strategy: through the translation system.** Each example
   gets `title` and `description` translation keys, same as today's demo
   strings. The `ExampleModule` type changes to:

   ```ts
   export interface ExampleModule {
       readonly titleKey: TranslationPath;     // resolved by harness via t
       readonly descriptionKey: TranslationPath;
       readonly Example: ComponentType;
   }
   ```

   In practice each example file imports its component's translation slice
   and the harness wires `t` resolution. New translation block per
   migrated component:

   ```ts
   // in src/languages.ts
   examples: {
       steps: {
           horizontal: { title: string; description: string };
           vertical:   { title: string; description: string };
           wizard:     { title: string; description: string };
           statusOverride: { title: string; description: string };
       };
   };
   ```

   This means Phase 2 also drops the existing `example.ui.steps.*` block
   and replaces it with `example.examples.steps.*`.

2. **First-PR scope: harness + `Steps` migration only.** The
   `DemoEntry.render` shape stays the same, so un-migrated demos render
   unchanged through the legacy path. Follow-up PRs migrate one group key
   at a time, tracked in `.plans/component-demo-harness/MIGRATION.md`.

3. **State view: JSON via `<CodeViewer>`** with a serialization helper
   that:
   - replaces functions with `"[Function]"`
   - replaces circular references with `"[Circular]"`
   - replaces non-serializable values (DOM nodes, refs) with their tag
     name where available, otherwise `"[Unserializable]"`
   - pretty-prints with 2-space indent

   Helper lives at `src/examples/harness/serializeState.ts`, unit tested
   for each replacement case.

## Phased task list

### Phase 1 — harness

- ✅ `src/examples/harness/types.ts` — `ExampleModule`, `RegisteredExample`
- ✅ `src/examples/harness/useExampleState.ts` — context + hook + provider
- ✅ `src/examples/harness/source.ts` — `cleanExampleSource` + tests
- ✅ `src/examples/harness/ExampleCard.tsx` — Card + preview region + Tabs
      with Code/State, using `<CodeViewer>`
- ✅ `src/examples/harness/ExamplePage.tsx` — renders a stack of cards
- ✅ `src/examples/harness/index.ts` — barrel
- ✅ Vitest: ExampleCard renders title/description/preview/code/state;
      state updates when example calls `useExampleState`

### Phase 2 — migrate Steps

- ✅ Add `example.examples` translation block to `languages.ts` with a
      `steps` slice holding `{ horizontal, vertical, statusOverride,
      wizard }`, each `{ title, description }`
- ✅ Fill in `languages/en-US.ts` and `languages/de.ts` for the new keys
- ✅ `src/examples/steps/Horizontal.tsx` — current horizontal demo split out
- ✅ `src/examples/steps/Vertical.tsx` — current vertical demo split out
- ✅ `src/examples/steps/StatusOverride.tsx` — covers `status` prop override
- ✅ `src/examples/steps/Wizard.tsx` — full controlled wizard with content
      panel switching, demonstrating real-world use
- ✅ `src/examples/steps/index.ts` — registry with `?raw` source imports
- ✅ Update `src/uiDemos.tsx`: replace the `StepsDemo` entry with
      `render: () => <ExamplePage examples={stepsExamples} />`
- ✅ Drop the old `example.ui.steps.*` translation block from
      `languages.ts`, `languages/en-US.ts`, `languages/de.ts` (replaced by
      `example.examples.steps.*`)
- ❌ Browser-verify all four examples render; Code tab shows the example
      source; State tab updates as you click Next/Reset
      *(blocked: chrome-devtools MCP can't attach — the user's Chrome is
      using the same profile. User needs to refresh
      `http://localhost:5175/` and confirm.)*

### Phase 3 — incremental migration (separate PRs)

- ❌ One PR per group key (`button`, `input`, `dateTime`, …) until all old
      single-blob demos are replaced. Track in CLAUDE.md or
      `.plans/component-demo-harness/MIGRATION.md`.

## Phase 2b — Per-component DocPage contract (added retroactively)

Phase 2's `Steps` migration produced a layout pattern that every
subsequent component migration follows verbatim. ARCH-14 flagged that
this contract was never written down in PLAN.md — only in CLAUDE.md and
MIGRATION.md — so reviewers had no canonical design doc to cross-check.
This section now lives here as the canonical design surface; CLAUDE.md
restates the same rules for day-to-day contributors. Any drift between
the two is a bug: PLAN.md wins.

**Doc-page primitive set (all in `src/examples/harness/docPage/`):**

| Primitive             | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `<DocPage>`           | Page shell + sticky right-rail `<PageIndex>`           |
| `<DocSection>`        | Top-level (`h3`) labelled section with anchor          |
| `<DocSubsection>`     | Nested (`h4`) labelled section                         |
| `<InstallationTabs>`  | Outer Command / Manual tab pair                        |
| `<CommandBlock>`      | Inner pnpm / npm / yarn / bun PM tabs (now in docPage/) |
| `<ManualSteps>` + `<ManualStep>` | Numbered manual install steps                |
| `<ExampleCard hideHeader>` | Per-mode preview / code / state triptych          |
| `<ExpandableCode>` + `<CodeViewer fitContent>` | All multi-line snippets          |
| `<CodeSnippet mode="inline">` | Inline `<TagName>` tokens in prose             |
| `<BehaviourList>`     | Test-anchored behaviour statements                     |
| `<PropTable>`         | One per exported component                             |

**Required section ordering** (matches CLAUDE.md; do not let MIGRATION.md
drift): **Installation → Examples → Usage → Composition → RTL →
Defined behaviour → API Reference**.

**Translation routing:** every narrative string + section title + example
title + behaviour statement flows through the `Translation` interface.
JS-API labels (Prop / Type / Default / Description, package manager
names) stay hardcoded English.

**Open follow-up (tracked as ARCH-4):** introduce a single
`<StandardDocPage config={…}>` primitive that takes the per-component
config object and renders the canonical layout. Lands ~13 k LOC of
ceremony as one config object per component. Deferred for a focused
follow-up branch; existing pages stay valid because the primitive will
emit the same JSX.

## Risk / open questions

- **Bundle size of CodeViewer.** Monaco is heavy. The library already
  lazy-loads it via `React.lazy`, so first-paint of the demo page won't
  include Monaco; it only loads when a user expands a Code/State tab.
  Confirm via the network panel during Phase 1 testing.
- **`?raw` typing.** Vite has a built-in module declaration; confirm the
  declaration is reachable from `tsconfig.app.json` (Vite ships
  `vite/client` types — likely already referenced).
- **State serialization.** A state object referencing a DOM node would
  throw `JSON.stringify`. Replacer must guard against this. Test with at
  least one example whose state contains a ref or callback.

## Multi-review handoff

Per the global CLAUDE.md rule ("each commit and plan should be revised with
the multi review command"), once Phase 1 lands the agent should run
`/multi-review` against the harness PR before Phase 2 lands. Any issues
emitted by reviewers go into `.plans/component-demo-harness/issues/`.
