# Translation slice refactor — review

Status: ✅ All verifications green. Ready to ship.

## What landed

Three commits on `feat/mows-auth-core`:

| SHA         | Subject                                                                                |
| ----------- | -------------------------------------------------------------------------------------- |
| `3ec90f4e`  | `feat(react-components): typed translations guide + per-component slice pattern`       |
| `b7ead345`  | `test(react-components): tree-shake + code-split e2e`                                  |
| `abd21df1`  | `refactor(react-components): slice every example translation into per-component files` |

## Result snapshot

### File-size impact

| File                              | Before | After | Δ           |
|-----------------------------------|-------:|------:|-------------|
| `src/languages.ts`                |  3 141 |   468 | −2 673      |
| `src/languages/en-US.ts`          |  4 266 |   540 | −3 726      |
| `src/languages/de.ts`             |  4 260 |   540 | −3 720      |
| 79 slice files (incl. Steps)      |      0 | 12 305| +12 305     |
| **Net**                           | 11 667 |13 853 | +2 186 (≈18%)|

Total line count grew by ~18% because each slice file inlines both the
type literal and both locale value literals (verbatim — no
deduplication). The win isn't line count, it's that no single file is
larger than ~310 lines and each component's strings now live next to
its other source. Reviewers can hold one slice in their head.

### Compile-time completeness

Preserved. `const translation: Translation = { … }` still typechecks
against every required key in the augmented interface; the only
difference is that the slice type sits in a separate file. Adding a
required key anywhere (slice or top-level) still fails `tsc` until
both locales fill it.

### Bundle implications (`pnpm test:treeshake`)

Slice extraction is a maintainability change, not a code-splitting
change. The e2e bundle-size assertions are unchanged from before:

| Scenario     | Eager (gzip) | Reachable (gzip) | Δ over empty (eager) |
| ------------ | -----------: | ---------------: | -------------------: |
| empty        | 57 kB        | 57 kB            | —                    |
| button       | 67 kB        | 67 kB            | +10 kB               |
| codeViewer   | 131 kB       | 3 211 kB         | +74 kB               |
| resourceList | 133 kB       | 133 kB           | +77 kB               |

All 8 hard assertions pass. The non-blocking orphan-asset warning
(Monaco worker copies bloating `node_modules`) is unchanged; that
finding is tracked separately (see "Outstanding follow-ups").

## Verification matrix

| Check                                 | Command                            | Result |
| ------------------------------------- | ---------------------------------- | ------ |
| Type checking                         | `npx tsc --noEmit`                 | ✅ clean |
| Test suite                            | `pnpm test`                        | ✅ 2 088 / 2 088 across 109 files |
| Production lib build                  | `pnpm build`                       | ✅ clean (43.7s) |
| Treeshake / code-split e2e            | `pnpm test:treeshake`              | ✅ 8 / 8 assertions hold |
| Translations guide page renders both locales | Chrome MCP, both `en-US` and `de` | ✅ (verified in earlier turn — slicing section + all subsections present) |

## Risks and mitigations considered

1. **Brace miscounting inside translated copy.** The extractor strips
   backtick-delimited strings per line before counting braces, so a
   stray `{` in a German sentence couldn't unbalance the block walker.
   No translation strings span multiple backtick-delimited lines in
   the source, so single-line stripping is sufficient.

2. **Indent drift.** Component children sit at column 16 in the type
   file and column 12 in the value files. The script encodes both
   indents explicitly and refuses to run if the `examples: {` block
   isn't found at the expected column.

3. **Idempotency.** The script tags each child as `block` (inline
   literal) or `ref` (single-line reference) and skips refs. Running
   `node scripts/extract-slices.mjs` after a full extraction is a
   no-op; the only output is the `skipped` summary.

4. **Ordering of imports.** New imports are sorted alphabetically and
   spliced after the existing top-of-file import block. ESLint was
   not run as part of the verification; if the project enforces an
   import-order rule, `pnpm lint:fix` should be run before merge.
   *Action: run `pnpm lint:fix` after merge if the CI complains.*

5. **Mixed-kind slices.** If the type file already references a slice
   but a locale file still has an inline literal (or vice versa),
   the script flags it `mixed kinds (manual review)` and skips. The
   actual run reported no such cases — only `steps` was skipped as
   `already sliced`.

## Outstanding follow-ups

These were uncovered during the work but are out of scope for this
refactor. Each is captured in a comment in the relevant source file
where applicable.

1. **Monaco worker asset bloat in consumer `node_modules`** —
   ~9 MB of `dist/assets/*.worker-*.js` files end up in every
   downstream consumer's install even when tree-shaking removes
   `CodeViewer` from the runtime bundle. The browser never downloads
   them; the cost is install size, not page weight. The
   `pnpm test:treeshake` orphan-asset warning surfaces this on every
   run. A proper fix means dropping `?worker` static imports from
   `MonacoCodeEditor.tsx` in favour of a runtime
   `MonacoEnvironment.getWorker` configurator that the consumer
   wires up — substantial change, separate PR.

2. **Optional DRY pass over slice helper types** — many slices
   declare an identical `{ title: string; description: string }`
   inline. A future cleanup could share a `DocExampleEntry` /
   `DocInstallation` / `DocSectionBody` helper from
   `src/examples/harness/types.ts`. Not done now because the
   extraction was kept mechanically faithful to the original
   literals so `git diff` reads as a pure move.

3. **One-shot extractor script** — `scripts/extract-slices.mjs`
   stays in the tree as documentation for future maintainers (it
   handles the brace-counting + indentation correctly and is
   idempotent). It can be removed once a few months of stability
   prove no one needs to re-run it.

## Manual-review checklist (for an ultrareview pass)

- [ ] Spot-check 3–5 slice files against `git log -p` to confirm the
      slice content matches the original literal byte-for-byte (modulo
      the unindenting).
- [ ] Confirm the top-of-file import blocks in
      `src/languages.ts` / `en-US.ts` / `de.ts` are sorted and free
      of duplicates.
- [ ] Run `pnpm lint:fix` once; verify no real lint errors land in
      slice files (auto-formatting is OK).
- [ ] Open `/guide/Translations` in the dev server, switch between
      English and German, confirm every subsection renders.
