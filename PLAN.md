# Active plan

**Feature:** Component demo harness — shadcn-docs-style examples
**Detailed plan:** [.plans/component-demo-harness/PLAN.md](.plans/component-demo-harness/PLAN.md)

## Summary

Rebuild the `mows-components-react` demo page so each component shows
**many small examples**, each rendered in its own card with: headline,
description, live preview, the example's source code (via Monaco
`<CodeViewer>`), and a live JSON view of the example's reported state. Same
shape as the shadcn/ui docs.

## Locked decisions

1. ✅ Example headlines and descriptions go through the translation system,
   same as the rest of the demo strings.
2. ✅ First PR ships the harness + the `Steps` migration only. Remaining
   ~55 demos move in follow-up PRs, one group key at a time.
3. ✅ State tab renders JSON via the existing Monaco `<CodeViewer>` with a
   replacer that turns functions/circulars into stable placeholders.

## Status

- ✅ Decisions confirmed with user
- ✅ Phase 1: harness (`ExampleCard`, `useExampleState`,
      `cleanExampleSource`, `serializeState`, `ExamplePage`) + tests
- ✅ Phase 2: migrate `Steps` to the harness, replace the old
      `example.ui.steps.*` block with `example.examples.steps.*`
- ✅ `/multi-review` on the harness change before Phase 3 starts
      (run 2026-05-20, results in `.plans/review-20-05/`)
- ✅ Phase 3: incremental migration of remaining demos (see
      `.plans/component-demo-harness/MIGRATION.md` for the per-component
      tracker — all ~70 components migrated; only `StandardDocPage`
      abstraction (ARCH-4) remains)
