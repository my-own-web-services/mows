# Translation slice refactor — test-coverage gap audit

Scope: the slice-pattern refactor at
`components/react/src/examples/<name>/translations.ts` (79 files), the
trimmed `src/languages.ts` / `src/languages/{en-US,de}.ts`, the new
`src/guides/TranslationsGuide.tsx` + test, and `src/languages.test.ts`.

For each gap below: what could regress unnoticed, a concrete test to
close it, and an importance rating.

---

## 1. Slice-shape drift (type + values co-located)

### Gap 1.1 — Slice values are typed against the slice interface, so drift IS caught (no test gap here)

Each slice file annotates both locale exports with the slice type:

```ts
export const stepsEn: StepsTranslation = { … };
export const stepsDe: StepsTranslation = { … };
```

So if someone adds `newKey: string` to `StepsTranslation` but forgets to
fill it in `stepsDe`, `tsc` errors at the `stepsDe:` annotation in the
slice file itself — caught at compile time. The top-level
`const translation: Translation = { … }` annotation in
`src/languages/en-US.ts` / `de.ts` is now mostly redundant for slice
keys but still load-bearing for the non-sliced parts (`example.pageTitle`,
`example.sidebar.*`, `example.guides.*`, `example.demos.*`, the inline
`example.common`, etc.).

- Concrete test idea: none required for slices proper. Already
  guaranteed structurally. **No new test recommended.**
- Importance: n/a.

### Gap 1.2 — A slice author can downgrade the slice export's annotation and silently break the guarantee

If a future PR accidentally writes `export const stepsDe = { … }`
(no `: StepsTranslation`), the slice file still typechecks (object
type is inferred). The drift would only surface at the consumer
(`src/languages/de.ts`) where `steps: stepsDe` flows into the
`Translation`-annotated literal. That works today, but only because
the top-level locale file still has the `: Translation` annotation.
Strip that too in a future cleanup and drift becomes silent.

- Concrete test idea: a meta-test that imports every
  `src/examples/*/translations.ts` module and asserts that the keys
  of `xxxEn` and `xxxDe` are deeply identical, recursing into nested
  objects (compare `JSON.stringify(Object.keys(...).sort())` recursively,
  or do a structural compare function). Fails fast on any slice whose
  two locales disagree in shape, regardless of TS annotation health.
- Importance: **medium**. The TS guard rail is real today, but cheap to
  add and survives accidental annotation loss.

### Gap 1.3 — A slice can be added to the filesystem but never wired into the top-level tree

Nothing forces a new `src/examples/foo/translations.ts` to be referenced
from `src/languages.ts` and both locale files. A reviewer must notice
manually. The slice would just sit unused — every locale file still
typechecks because the new keys aren't part of `Translation`.

- Concrete test idea: at test time, glob every
  `src/examples/*/translations.ts`, import it, and assert each exported
  `<name>En` slice is referenced-by-identity from the resolved en-US
  translation tree (`expect(en.example.examples[name]).toBe(xxxEn)`).
  Symmetrically for `de`. The slice file naming convention already
  matches the property name, so the wiring check can be driven by file
  name alone.
- Importance: **high**. Catches the most likely real-world regression
  (new component added with its own slice, but author forgot one of the
  three wire-up sites in the slimmed-down `languages.ts` / `en-US.ts` /
  `de.ts`).

---

## 2. Cross-slice consistency (shared doc-page shape)

Almost every slice repeats the same doc-page shape verbatim:

```ts
doc: {
    installation: { title; commandTab; manualTab; manualStep1..3 };
    usage:        { title; body };
    composition:  { title; body };
    examples:     { title; …per-example entries };
    definedBehaviour: { title; intro; verifiedBy; statements: {…} };
    rtl:          { title; body };
    apiReference: { title; intro };
};
```

This is policy from `components/react/CLAUDE.md` — "Doc pages" section.
Today the shape is duplicated as inline literals in each slice. There is
no `DocPageSlice` helper type. Drift between slices is invisible to
tsc.

### Gap 2.1 — A slice can drop a required doc section silently

If someone removes `composition: { title; body }` from a slice
(e.g. mowing through `nodeEditor/translations.ts`), the doc page for
that component will crash at render time when `<DocSection
description={t.doc.composition.body} />` reads undefined. No test fires
until that specific DocPage is mounted, which the existing
TranslationsGuide test doesn't do for arbitrary component pages.

- Concrete test idea: extract a `DocPageSlice` shape (even just a type)
  and a runtime structural assertion: glob every slice, runtime-walk the
  `doc` sub-tree, assert every required key is a non-empty string and
  every required nested object is present. The current 79 slices share
  the contract, so the test is `for each slice: expect(slice.doc) to
  satisfy expectedDocShape`. Pair this with a TS-only helper:
  `type DocPageSlice = { installation: DocInstallation; usage: DocSectionBody; … }` and a
  conditional-type-based satisfies check
  (`type Assert<T extends DocPageSlice> = T;` applied per slice).
- Importance: **high**. The doc shape is the most copy-pasted thing in
  the refactor; today the cost of touching it is N edits with no
  guard rail.

### Gap 2.2 — Statement keys under `definedBehaviour.statements` can drift between slices, breaking the BehaviourList → test mapping

Each slice owns its own bag of statement keys (e.g.
`derivesStatuses`, `ariaCurrent` for Steps). The `<BehaviourList>` in
the component's DocPage references those keys by name. If a key is
renamed in the slice but the DocPage isn't updated (or vice versa),
the DocPage crashes at render with `Cannot read properties of
undefined`. No co-located test verifies the mapping.

- Concrete test idea: per-component DocPage smoke test that renders
  `<XxxDocPage>` under both locales and asserts no console errors are
  produced. Could be a single parameterised test driven by the
  `componentRoutes` registry, mounting each DocPage in turn under a
  stub `MowsContext`. Optional stronger version: extract a
  `<BehaviourList statementsKey="…">` contract and assert all keys
  referenced by the DocPage exist in the slice.
- Importance: **medium-high**. Cheaper alternative to Gap 2.1's
  full structural assertion, and it catches the broader class of
  "DocPage reads a key that the slice no longer has".

### Gap 2.3 — Slices that legitimately diverge from the canonical shape have no opt-out marker

Today everything just happens to share the shape. If `chart` or `map`
ever needs to add a section the others don't have, there's no
disciplined way to opt in to "the shared shape PLUS my extras". A
shared `DocPageSlice` helper (Gap 2.1) makes this trivial via
intersection (`DocPageSlice & { extra: … }`).

- Concrete test idea: same as 2.1 — once the shape is a named type,
  diverging from it becomes a deliberate type-system act.
- Importance: **low** (no current divergence), but folds into Gap 2.1.

---

## 3. Lazy-loading dynamics — additional gaps beyond `languages.test.ts`

`src/languages.test.ts` already covers: registry codes, thunk shape,
en≠de identity, module-cache stability across calls, and one slice
identity check (Steps).

### Gap 3.1 — The slice-identity check is hard-coded to Steps only

If `audioPlayerEn` ever gets accidentally double-imported, deep-merged,
or rewired by hand in `en-US.ts`, no test fails until something in
the UI breaks. The current single-slice identity check
(`expect(en.example.examples.steps).toBe(stepsEn)`) only guards Steps.

- Concrete test idea: glob every `src/examples/*/translations.ts`,
  pull the `<name>En` / `<name>De` exports, and assert
  `en.example.examples[name] === xxxEn` and same for de — for all 79
  slices in one parameterised test. Single failure pinpoints the
  broken wire-up. This subsumes part of Gap 1.3 and Gap 3.1 in one
  test.
- Importance: **high**.

### Gap 3.2 — `getBrowserLanguage` storage-key behaviour is uncovered

The provider reads `${storagePrefix}_language` from localStorage,
falling back to `navigator.language`. Today no test exercises:
(a) honouring a stored code, (b) honouring an unstored browser
language, (c) falling back to en-US for an unknown locale, or
(d) writing the storage key on `setLanguage`. Regression here means
silently ignoring a user's saved preference.

- Concrete test idea: in a vitest test for `getBrowserLanguage`,
  stub `localStorage` + `navigator.language` and parameterise over
  `(stored, navLang, expectedCode)` rows: stored hits win, browser
  full-tag wins next, browser base-tag fallback, en-US last-resort.
  Plus a `MowsProvider` integration test: mount with `storagePrefix`,
  call `setLanguage(de)` via the exposed `useMows()` hook, assert
  `localStorage.getItem('test_language') === 'de'` and that consumers
  re-render with the German `t`.
- Importance: **medium-high**. Cheap unit-level coverage of a
  load-bearing function that nobody currently touches with a test.

### Gap 3.3 — End-to-end `<MowsProvider>` round-trip is uncovered

The unit tests prove `Language.import()` returns the right tree, but
nothing proves the provider actually swaps `t` and re-renders consumers
when `setLanguage(...)` is called. A regression in the
`setState({ currentTranslation })` ordering (e.g. forgetting the second
setState in `setLanguage`) would not be caught.

- Concrete test idea: render `<MowsProvider languages={languages}
  storagePrefix="t" initialTranslation={enTranslation}>` wrapping a
  tiny probe component that prints `useMows().t.example.pageTitle`,
  call `setLanguage(de)`, `await` a microtask, and assert the printed
  text flipped to the German value. Asserts the import →
  setState → re-render path in one go.
- Importance: **high**. The whole point of the dynamic-import wiring
  is the live switch; today nothing exercises it end-to-end.

### Gap 3.4 — Same-slice identity across a real round-trip is uncovered

The existing test loads en and de once and confirms Steps slice
identity. It doesn't confirm that, after a `setLanguage(de)` →
`setLanguage(en)` flip in the provider, the en tree on `t` is still
`===` to the eagerly-bundled `enTranslation` (so consumers using
`React.memo(...)` against `t.example.examples.steps` don't re-render
unnecessarily).

- Concrete test idea: in the round-trip test from 3.3, capture
  `useMows().t.example.examples.steps` before and after a
  `de → en` flip; assert object identity is preserved on return
  to en.
- Importance: **low-medium**. Mostly a memo-friendliness guarantee.

### Gap 3.5 — Each `Language.import` returns the FULL extended Translation, not the base

If a future contributor were to swap `import("./languages/de")` for the
library's `baseLanguages` thunk (which only returns `BaseTranslation`),
every app-side key would be missing at runtime but every typecheck
would still pass (because the thunk return type is `Translation`
through casting). Today: no test would catch that.

- Concrete test idea: after each `lang.import()` in
  `languages.test.ts`, assert a sample of app-side-only keys exist and
  are non-empty (`t.example.guides.translations.title`,
  `t.example.examples.steps.horizontal.title`,
  `t.example.demos.fileViewer.sampleName`). One of these already exists
  in the current suite — extend it to cover demos and guides too.
- Importance: **medium**.

---

## 4. App-side compliance test (analogue of `localesAreCompliant.test.ts`)

The lib has `lib/lib/languages/localesAreCompliant.test.ts` that
type-coerces both shipped locales to `BaseTranslation` and asserts
non-emptiness. That covers the LIB but **not** the augmented
`Translation` interface the example app declares via
`declare module "../lib/lib/languages"`.

### Gap 4.1 — No app-side equivalent of the compliance test

If a future refactor accidentally drops the `: Translation` annotation
from `src/languages/en-US.ts` (e.g. via a code-mod gone wrong), the
locale file still compiles — but any missing app-side key becomes a
runtime undefined. The lib's compliance test wouldn't catch this
because it only widens to `BaseTranslation`, not to the augmented
`Translation`.

- Concrete test idea: mirror the lib's pattern in
  `src/languages.test.ts` (or a sibling): import both default exports
  and re-coerce them to the augmented `Translation` —
  `const en: Translation = enDefault; const de: Translation = deDefault;`
  plus a trivial `expect(Object.keys(en.example.examples).length).toBeGreaterThan(70)`
  runtime check. The TS coercion is the load-bearing assertion; the
  vitest call exists so the test runs as part of the suite.
- Importance: **high**. Mirrors a guarantee the lib already has;
  cheap to add; closes a class of regressions the lib test cannot see.

---

## 5. TranslationsGuide test — what it does and doesn't catch

The current test renders the page once per locale and asserts each of
the 8 top-level section headings appears in the DOM. It also asserts
the "throws outside provider" guard.

### What it WOULD NOT catch

1. **Subsection drift**: each top-level section has 2–4 subsections
   (e.g. `overview.baseTranslation.title`, `overview.language.title`,
   …). If any of those titles becomes empty or a renaming drops a
   subsection from the DocPage but not from the index items, the test
   stays green.
2. **PageIndex anchor mismatch**: `indexItems` maps a label to an
   anchor id (`ANCHOR.overviewBase` → `overview-base`). If a refactor
   renames `ANCHOR.overviewBase` but forgets to update the
   `<DocSubsection id=…>`, the right-rail link goes to a non-existent
   anchor. The test never clicks a rail link, so it stays green.
3. **Code snippet rendering**: the page embeds ten static
   `*_SNIPPET` strings via `<CodeViewer>`. A regression that drops a
   snippet (or wires the wrong one to the wrong subsection) is
   invisible to the heading-only test.
4. **Body strings**: section/subsection `body` strings are passed via
   `description={…}` and only briefly checked via `<DocSection
   description>` — none of them are asserted to render. A missing
   body string is invisible.
5. **Language reactivity**: the test renders against each locale by
   building a context with the already-resolved tree. It doesn't
   prove the guide re-renders when the provider's `t` swaps under it.
6. **Both locales render the SAME structure**: today they're asserted
   independently. A regression where the German tree loses a section
   that English keeps is not caught — only "is the heading text I
   chose to expect present" is checked.

### Concrete test ideas

- 5a — **Subsection coverage** (low cost): extend the existing test
  to also assert every subsection title in the
  `t.<section>.<sub>.title` tree appears at least once. One nested
  loop over a small static table. **Importance: medium.**
- 5b — **Anchor reachability** (medium cost): for each id in
  `indexItems`, assert `container.querySelector(`#${id}`)` is non-null.
  Catches the rename-drift scenario directly. **Importance: medium.**
- 5c — **Body strings render** (low cost): pick the body strings the
  guide actually injects (`t.overview.intro`,
  `t.overview.baseTranslation.body`, etc.) and assert each renders.
  Catches a class of "we shrunk the schema and forgot a body slot"
  regressions. **Importance: low-medium.**
- 5d — **Structural parity across locales** (low cost): compute the set
  of headings rendered under en-US, compute the same under de, assert
  the two sets have equal size. The values differ, the count does
  not. Catches asymmetric pruning. **Importance: low.** (Subsumed by
  the Gap 1.2 / 4.1 tests.)
- 5e — **Snippet count** (very low cost): the file ships 10 snippet
  constants — assert the rendered DOM contains 10
  `<pre>`/`<code>`-like nodes under `<CodeViewer>`. Catches "I deleted
  a snippet mount by accident". **Importance: low.**

---

## Summary — top 3 to add next

1. **Slice wiring parity test (Gaps 1.3 + 3.1 combined)** — one
   parameterised test that globs `src/examples/*/translations.ts`,
   imports both `<name>En` / `<name>De`, and asserts each is
   `===`-identical to the value at `t.example.examples[<name>]` in the
   resolved en/de translation trees. Closes the highest-likelihood
   regression in the slimmed-down locale files in a single file.
   **High importance.**

2. **App-side compliance test (Gap 4.1)** — mirror the lib's
   `localesAreCompliant.test.ts` against the augmented `Translation`.
   Two lines of TS coercion plus two trivial runtime asserts. Closes
   the only gap where the lib has a guarantee and the app doesn't.
   **High importance.**

3. **Shared `DocPageSlice` shape + structural assertion (Gap 2.1, with
   2.2 as bonus)** — extract a named helper type for the canonical
   `doc:` shape, apply it to every slice, and add a runtime test that
   walks every slice's `doc` tree to assert each required key is a
   non-empty string. Locks in the policy from `CLAUDE.md`'s "Doc
   pages" section that today survives only by copy-paste discipline.
   **High importance.**

Honourable mention: the end-to-end `<MowsProvider>` round-trip test
(Gap 3.3) is independently valuable and not strictly translation-slice
specific, so it could land in a separate change against the provider.
