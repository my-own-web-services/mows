# TranslationsGuide fidelity review

Scope: verify that `src/guides/TranslationsGuide.tsx` (rendered guide + inline
snippets) and the `example.guides.translations.*` copy in
`src/languages/en-US.ts` / `src/languages/de.ts` accurately describe how the
library actually works.

Sources of truth consulted:
- `/home/paul/projects/mows/components/react/src/guides/TranslationsGuide.tsx`
- `/home/paul/projects/mows/components/react/src/languages/en-US.ts` (lines 191-317)
- `/home/paul/projects/mows/components/react/src/languages/de.ts` (lines 191-317)
- `/home/paul/projects/mows/components/react/lib/lib/languages.ts`
- `/home/paul/projects/mows/components/react/src/languages.ts`
- `/home/paul/projects/mows/components/react/src/examples/steps/translations.ts`
- `/home/paul/projects/mows/components/react/src/main.tsx`
- `/home/paul/projects/mows/components/react/lib/lib/mowsContext/MowsContext.tsx`
- `/home/paul/projects/mows/components/react/lib/lib/languages/localesAreCompliant.test.ts`
- `/home/paul/projects/mows/components/react/lib/main.ts`
- `/home/paul/projects/mows/components/react/package.json` (exports map)

## 1. Overview

Snippets: `BASE_TRANSLATION_SNIPPET` (TranslationsGuide.tsx:42-63),
`LANGUAGE_SNIPPET` (lines 65-73).

Findings:
- `BaseTranslation` shape claims `primaryMenu.login` / `primaryMenu.logout`,
  `commandPalette.placeholder` / `noResults`, and the dynamic-key `actions`
  slot. Verified against `lib/lib/languages.ts:22-37`, `:133-138`,
  `:130-132`. Comment "Apps extend this — declaration merging adds their
  keys to the same tree" matches `export interface Translation extends
  BaseTranslation {}` at `lib/lib/languages.ts:233`.
- `Language` snippet (code/originalName/englishName/emoji + `import()` thunk)
  is a verbatim match for `lib/lib/languages.ts:235-241`.
- File-path citations: `lib/lib/languages.ts` is correct (the file exists at
  exactly that path within the package). `<MowsProvider>` carries the active
  tree on `useMows().t` — verified at `MowsContext.tsx:75` and `:360`.
- Provider body claims `<MowsProvider>` "picks up the user's stored choice
  via `storagePrefix` + browser language, runs the matching `Language.import()`
  on mount". Verified: `MowsContext.tsx:218-219` initialises
  `currentLanguage` via `getBrowserLanguage(...)` (which reads
  `localStorage[storageKey]` first, then `navigator.language`) and `:241`
  calls `this.setLanguage(this.state.currentLanguage)` from
  `componentDidMount` so the matching `Language.import()` runs on mount.
  `setLanguage` is at `:320-332` and re-renders consumers via setState
  on `currentTranslation`.

Verdict: accurate. No issues.

## 2. Setup

Snippets: `PROVIDER_MOUNT_SNIPPET` (TranslationsGuide.tsx:75-107) and
`LANGUAGE_LIST_SNIPPET` (lines 109-130).

Findings:
- `MowsProvider` props (`storagePrefix`, `languages`, `initialTranslation`)
  exist on `MowsProviderProps` (`MowsContext.tsx:433`, `:439`, `:440`). All
  three resolve correctly via `lib/main.ts:354 export * from
  "./lib/mowsContext/MowsContext"`, so the `import { MowsProvider } from
  "@my-own-web-services/react-components"` import on line 75 of the snippet is valid.
- **Mismatch between snippet and prose**: `setup.mountProvider.body`
  (en-US.ts:218 / de.ts:218) says "Pick it via `localStorage` first, then
  `navigator.language`, then a hardcoded English fallback — the example
  app's `main.tsx` shows the exact pattern." However, the snippet shown
  on the page uses the **eager** pattern (synchronous `import enTranslation
  from "./languages/en-US"` + a `Record<string, Translation>` lookup and a
  synchronous `pickInitialTranslation()` returning `Translation`), whereas
  `src/main.tsx:14-41` uses the **dynamic** pattern (`pickInitialLocale()`
  returning a locale string, then `await import()` inside
  `loadInitialTranslation().then(...)`). The picking logic is conceptually
  the same, but the import strategy is the opposite of what the snippet
  shows. The two patterns are explicitly contrasted later in
  `SLICE_BUNDLE_SNIPPET`. Either rewrite the snippet to match `main.tsx`
  (dynamic) or rephrase the body to say "the example app's `main.tsx`
  shows the dynamic counterpart; see Slicing → Bundle for both".
- `defaultLanguages.body` (en-US.ts:222) claims that omitting `languages`
  makes `<MowsProvider>` fall back to `baseLanguages` (English + German).
  Verified: `MowsContext.tsx:471 languages = baseLanguages`, and
  `baseLanguages` is defined at `:414-429` with exactly en-US and de
  entries that resolve to `lib/languages/<locale>/default`. The claim that
  this is "enough for apps that don't add their own translation keys" is
  accurate because the default translations live at
  `lib/lib/languages/<locale>/default.ts`.
- `LANGUAGE_LIST_SNIPPET` comment "Each `import()` resolves to YOUR
  extended `Translation`, not the library's bare `BaseTranslation`" is
  consistent with `src/languages.ts:450 export type Translation =
  MowsTranslation` re-export of the augmented interface — the
  `import()` thunk's return type `Promise<{ default: Translation }>`
  picks up the augmented type at the call site.

Verdict: accurate apart from the `mountProvider` snippet/prose mismatch
flagged above.

## 3. Reading

Snippets: `READ_HOOK_SNIPPET` (lines 132-138), `READ_CLASS_SNIPPET` (lines
140-152), `READ_ACTION_SNIPPET` (lines 154-171).

Findings:
- `useMows` and `MowsContext` are both exported from `@my-own-web-services/react-components`
  via the wildcard re-export at `lib/main.ts:354`. The class-component
  pattern (`static contextType = MowsContext; declare context:
  ContextType<typeof MowsContext>`) is exactly the pattern the library
  uses internally — see `MowsContext.tsx:391-392` (`withMows` HOC).
- `t.actions[ActionId]` access pattern: `BaseTranslation.actions` is typed
  `[key: string]: string` at `lib/lib/languages.ts:130-132`, so the snippet
  on lines 154-171 typechecks. The `...baseEn.actions` spread inside a
  locale file's `actions` literal is the right pattern (apps preserve every
  built-in action label rather than redeclaring them).
- Prose body for `reading.actions` (en-US.ts:238) names
  `CoreActionIds.OpenCommandPalette` as the example enum. That enum does
  not exist in the public API — the library defines `ActionIds` (not
  `CoreActionIds`) — but this is illustrative, not load-bearing. Worth
  flagging only if you want the example to point at the real enum.

Verdict: accurate, with one minor nit on the enum name in the
`reading.actions` body copy.

## 4. Extending

Snippet: `DECLARE_MERGE_SNIPPET` (lines 173-198) + `LOCALE_FILE_SNIPPET`
(lines 200-225).

Findings:
- `DECLARE_MERGE_SNIPPET` uses `declare module "@my-own-web-services/react-components" {
  interface Translation { … } }`. The in-repo example does the augmentation
  against the relative module path (`src/languages.ts:86 declare module
  "../lib/lib/languages"`). Declaration merging against the package
  barrel `@my-own-web-services/react-components` is valid because the `Translation`
  interface is exported through `lib/main.ts:349 export * from
  "./lib/languages"`, and TypeScript treats `@my-own-web-services/react-components` as
  the module that owns the interface for downstream consumers. This is
  the correct external-consumer pattern — flag it only if you want
  to additionally show the in-repo `../lib/lib/languages` variant for
  apps building inside the monorepo (which is what `src/languages.ts`
  actually uses).
- `LOCALE_FILE_SNIPPET` imports `baseEn from
  "@my-own-web-services/react-components/lib/languages/en-US/default"`. The
  `package.json` exports map (`./*` → `./dist/*`) plus the built artefact
  at `dist/lib/languages/en-US/default.{js,d.ts}` confirms this path
  resolves correctly for external consumers. The in-repo equivalent is
  `../../lib/lib/languages/en-US/default` (see
  `src/languages/en-US.ts:1`) — different because the in-repo path
  bypasses the package boundary.
- `const translation: Translation = { ...baseEn, … }` typechecking story is
  correct (see `src/languages/en-US.ts` for the live example). The base
  spread is the only way to keep the library's strings without
  redeclaring every key.
- `consumeOwnKeys.body` claim that there is "no second `useAppT()` hook"
  matches the implementation — the library exposes only `useMows()`
  (`MowsContext.tsx:404`) and surfaces app keys on the same `t` object.

Verdict: accurate.

## 5. Slicing

Snippets: `SLICE_FILE_SNIPPET` (lines 227-258), `SLICE_WIRING_SNIPPET`
(lines 260-295), `SLICE_BUNDLE_SNIPPET` (lines 297-328).

Findings:
- `SLICE_FILE_SNIPPET` mirrors the real
  `src/examples/steps/translations.ts`: three exports
  (`StepsTranslation` interface, `stepsEn`, `stepsDe`) with the same naming
  convention. The snippet collapses several keys with `// …` placeholders
  but the structure (top-level example entries + `doc` subtree) is the
  real shape — see `src/examples/steps/translations.ts:32-78`.
- `SLICE_WIRING_SNIPPET` reproduces `src/languages.ts:86-87,234` and
  `src/languages/en-US.ts:2`. The `declare module "../lib/lib/languages"`
  string matches `src/languages.ts:86` verbatim, which differs from the
  `@my-own-web-services/react-components` form used in the Extending section — both are
  shown because they correspond to in-repo vs external-consumer wiring.
- `SLICE_BUNDLE_SNIPPET` describes both approaches:
  - **Eager** variant: static imports both locales into the main chunk.
    Claim "Con: every user downloads every locale they don't use" is
    accurate for a static-import bundle layout.
  - **Dynamic** variant: `pickLocale()` then `await import("./languages/de")`.
    This is exactly the pattern in `src/main.tsx:14-27` (`pickInitialLocale`
    returns the locale string, `loadInitialTranslation` awaits the matching
    `import()`). Claim "Vite emits one chunk per locale" is true for this
    pattern.
  - `slicing.bundle.body` (en-US.ts:270) says "Slice extraction is a
    maintainability change, not a code-splitting change — the strings end
    up in the same chunk regardless of where the source lives." This is
    accurate: slice files are statically imported into the per-locale
    `src/languages/en-US.ts` / `de.ts` (see
    `src/languages/en-US.ts:2 import { stepsEn } from
    "../examples/steps/translations"`), so the bundler folds them into
    whatever chunk holds the locale file. Bundle layout is decided by how
    the entrypoint (re-)imports the locale modules, which is exactly
    what the body and the snippet say.

Verdict: accurate. The bundle subsection correctly distinguishes
maintainability (slicing) from code-splitting (entrypoint import strategy),
and the dynamic variant aligns with `main.tsx`.

## 6. Switching

Snippet: `SWITCH_RUNTIME_SNIPPET` (lines 330-350).

Findings:
- `useMows()` exposes `languages`, `setLanguage`, `currentLanguage` — all
  three confirmed on the `MowsContextType` interface
  (`MowsContext.tsx:78`, `:74`, `:76`).
- `setLanguage(language)` signature matches: it takes a `Language` and
  internally calls `language.import()` then persists via
  `localStorage.setItem(this.storageKeys.selectedLanguage,
  languageToSet.code)` (`MowsContext.tsx:329`). The body claim "persists
  the selection under `storagePrefix_language`" matches the storage-key
  layout at `MowsContext.tsx:129 selectedLanguage: ${prefix}_language`.
- `switching.runtime.body` (en-US.ts:278) reference to the bundled
  `<LanguagePicker>` matches `lib/main.ts:252 export { default as
  LanguagePicker }`.
- `switching.chunks.body` (en-US.ts:282) claim "each `Language.import` is a
  dynamic `import()` … Vite emits a separate chunk per locale" is correct
  for the example app's `src/languages.ts:459,466` (both entries use
  `() => import(./languages/...)`). The `initialTranslation`
  responsibility for first paint is correct (see `MowsContext.tsx:218`).

Verdict: accurate.

## 7. Safety

Snippet: `COMPLIANCE_TEST_SNIPPET` (lines 352-370).

Findings:
- The snippet is a near-verbatim transcription of
  `lib/lib/languages/localesAreCompliant.test.ts:15-33`. Imports, type
  annotations, and `expect(Object.keys(...).length).toBeGreaterThan(0)`
  match the live test file. The file path cited in
  `safety.complianceTest.body` (en-US.ts:294) is correct.
- `compileCheck.body` claim "Each per-locale module declares `const
  translation: Translation = { … }`" matches both
  `src/languages/en-US.ts` and the library's
  `lib/lib/languages/en-US/default.ts` (which targets `BaseTranslation`,
  the library's own contract — `Translation` extends `BaseTranslation`,
  so a `BaseTranslation` annotation suffices for the library locale).
- The compliance-test wording "running `pnpm test` (or `pnpm build`)
  surfaces a missing locale slot" is accurate: `tsc` runs during build
  and during the vitest run via project config.

Verdict: accurate.

## 8. Conventions

Subsections are body-only (no snippets).

Findings:
- `namespacing.body` (en-US.ts:302) accurately contrasts the library's
  component-namespaced keys (`primaryMenu`, `commandPalette`) with the
  feature-namespacing recommendation for apps. Confirmed against
  `lib/lib/languages.ts:22 primaryMenu`, `:133 commandPalette`.
- `flatKeys.body` cross-references "Reading translations" for the lone
  exception (action labels). That section does cover the `t.actions[id]`
  shape; the cross-reference is intact.
- `actionIds.body` re-states the dynamic-key rule and the "source from an
  enum/const" guideline — consistent with the implementation
  (`BaseTranslation.actions: { [key: string]: string }`).
- `spreadBase.body` claim about forgetting `...baseEn` failing only at the
  assignment site is correct: TypeScript's excess-property checking won't
  fire because the object would be missing keys, and the missing-key
  diagnostic is reported at the `const translation: Translation = { … }`
  binding, not at any specific field.

Verdict: accurate.

## Cross-cutting checks

### Anchor ids vs PageIndex items
Every anchor id referenced in the `indexItems` array
(TranslationsGuide.tsx:382-481) appears as an `id={...}` on either a
`<DocSection>` or a `<DocSubsection>` in the JSX (lines 485-718). The
`ANCHOR` constant (lines 8-40) is the single source of truth and is
consumed by both sides — no dangling references in either direction.

### en-US / de structural parity
The `example.guides.translations.*` subtree has matching key sets in both
locale files. Verified key-by-key for all 8 subsections (overview, setup,
reading, extending, slicing, switching, safety, conventions) and their
nested `{title, body}` pairs at en-US.ts:191-317 vs de.ts:191-317. The
type definition at `src/languages.ts:169-226` enforces this by design,
so a drift would surface as a tsc error first.

### main.tsx alignment with slicing.bundle
`src/main.tsx:14-41` implements the dynamic variant from
`SLICE_BUNDLE_SNIPPET` (TranslationsGuide.tsx:317-328): `pickInitialLocale`
returns a string discriminant, `loadInitialTranslation` awaits the
matching `import()` and only then mounts `<MowsProvider>`. The eager
variant in the same snippet is presented only as a contrast and is
**not** the pattern main.tsx uses — which is fine for the Slicing
section, but does conflict with the Setup → mountProvider body copy that
claims main.tsx shows the eager pattern (see §2 above).

## Summary

The guide is accurate end-to-end with one substantive issue:

1. **Setup → mountProvider mismatch** (TranslationsGuide.tsx:75-107 vs
   en-US.ts:218 / de.ts:218 vs src/main.tsx:14-41). The snippet shows the
   eager pattern; the body copy claims `main.tsx` shows "the exact
   pattern" but `main.tsx` actually uses the dynamic pattern. Fix either
   by (a) swapping the snippet to a dynamic-import version that mirrors
   `main.tsx`, or (b) rephrasing the body to "see Slicing → Bundle for
   the dynamic counterpart used in `main.tsx`".

Minor nit:

2. **`reading.actions` enum name** (en-US.ts:238 / de.ts:238) cites
   `CoreActionIds.OpenCommandPalette`. No such symbol exists in the
   public API (the library uses `ActionIds`). Illustrative only — flag
   if you want the example enum to point at a real export.

All other snippets, file-path citations, anchor ids, and structural
claims (overview / reading / extending / slicing / switching / safety /
conventions) accurately describe the implementation. The dynamic vs
eager bundle distinction in §5 is correct and aligns with `main.tsx`.
The compliance-test snippet is a faithful transcription of the live
test file. en-US ↔ de key parity holds for the entire
`example.guides.translations.*` subtree.
