# Translation slice — style review

**Summary:** 79 generated slices are quoting-clean (all values use backticks, no banned palette colours, no imports/unused imports, all trailing-newline-terminated). The two real style smells are (a) inconsistent line-breaking — three of the ten sampled slices collapse the entire object onto one or two lines, producing 280-460-char lines — and (b) the helper interfaces `ExampleEntry` / `DocInstallation` / `DocSectionBody` are not extracted: only the hand-authored `steps` slice declares them; the other 78 inline `{ title: string; description: string }` etc. on every field.

---

## Per-slice findings

Files sampled: all live under `/home/paul/projects/mows/components/react/src/examples/<name>/translations.ts`.

- **avatar** (171 lines, longest 163 chars)
  - Quoting: all backticks. ✓
  - Trailing newline: ✓
  - Imports: none.
  - Type inlines `{ title: string; description: string }` 4× and `{ title: string; body: string }` 3× — would collapse to 1 line each via shared helpers.
  - Body literals are nicely multi-lined (one key per line). Matches the gold shape.
  - No lint smells.

- **badge** (168 lines, longest 197 chars)
  - Same shape as avatar; one long English description line (~197 chars) that is still readable, no break needed.
  - Quoting / newline / imports: clean.
  - Same inline-helper redundancy.

- **button** (210 lines, longest 189 chars)
  - Clean. Type inlines `{ title; description }` 8× (the per-mode descriptions duplicate the `examples.<mode>` entries — that's a content concern, not style).
  - No quoting issues.

- **card** (171 lines, longest 189 chars)
  - Clean. Same shape.

- **codeViewer** (177 lines, longest **284** chars on line 142)
  - One German `composition.body` line is ~284 chars. Not unreadable, but the longest in this group. A wrap inside the template literal would help; eslint typically lets template literals slide so this likely won't lint-fail.
  - Otherwise clean.

- **dateTimePicker** (100 lines, longest **282** chars)
  - **Style outlier.** The entire `doc:` object is collapsed onto one line per top-level key (`installation`, `usage`, `composition`, `examples`, `definedBehaviour.statements`, `rtl`, `apiReference`). Lines 56, 57, 59, 72-74, 81, 84, 97-98 are all 200-280+ chars.
  - The earlier mode entries (lines 53-54, 78-79) are also one-line objects (`default: { title: \`...\`, description: \`...\` }`).
  - Quoting / newline / imports all fine — just visibly inconsistent with steps/avatar/etc.
  - **Recommend:** re-run the formatter (or the slice extractor) so each key gets its own line. Probably a prettier/printWidth disagreement in the generator output.

- **inlineEdit** (228 lines, longest 295 chars)
  - 295-char line is a single German body string (line 176); body strings are template literals so prettier won't wrap them. Acceptable.
  - Otherwise the file follows the gold shape — one key per line.

- **lyrics** (228 lines, longest **383** chars)
  - 383-char line is a single template-literal body containing markdown-ish backtick-escaped tokens (line 160, German `synced.description`). Not splittable without changing the rendered string.
  - Everything else is clean and shaped like the gold.

- **videoViewer** (234 lines, longest **462** chars)
  - 462-char German description (line 151) — again a single template-literal body, can't be split without changing output. Reasonable as a one-shot copy block.
  - File shape otherwise matches the gold reference.

- **resourceList** (144 lines, longest **414** chars)
  - **Second style outlier.** Top-level mode descriptions (lines 65-73, 106-114) are written as single-line objects, producing 270-414-char lines. The `doc.examples` block (lines 80-88, 121-129) duplicates the same content also as one-line objects. `doc.installation` and several `doc.*` sections are also collapsed onto one line.
  - Quoting / newline / imports all fine.
  - **Recommend:** same formatter pass as for `dateTimePicker`. The 9 modes × 2 locales × 2 places = 36 lines that should each become 4-line blocks.

### Sampled-file lint score

| File             | Lines | Longest | Backticks | Newline | Imports | Notes                                  |
| ---------------- | -----:| -------:|:---------:|:-------:|:-------:| --------------------------------------- |
| avatar           |  171  |   163   | ✓         | ✓       | none    | matches gold                            |
| badge            |  168  |   197   | ✓         | ✓       | none    | matches gold                            |
| button           |  210  |   189   | ✓         | ✓       | none    | matches gold                            |
| card             |  171  |   189   | ✓         | ✓       | none    | matches gold                            |
| codeViewer       |  177  |   284   | ✓         | ✓       | none    | 1 long template body — OK               |
| **dateTimePicker** | 100 | **282** | ✓         | ✓       | none    | **collapsed objects — needs reformat**  |
| inlineEdit       |  228  |   295   | ✓         | ✓       | none    | matches gold                            |
| lyrics           |  228  |   383   | ✓         | ✓       | none    | long template bodies (intended)         |
| videoViewer      |  234  |   462   | ✓         | ✓       | none    | long template bodies (intended)         |
| **resourceList** |  144  | **414** | ✓         | ✓       | none    | **collapsed objects — needs reformat**  |

---

## Repeated helper interfaces

Counts across **all 79** slices (grep on `src/examples/*/translations.ts`):

| Helper                       | Files declaring it |
|------------------------------|-------------------:|
| `interface DocSectionBody`   | 1 (only `steps`)   |
| `interface DocInstallation`  | 1 (only `steps`)   |
| `interface ExampleEntry`     | 1 (only `steps`)   |

The other 78 slices inline `{ title: string; description: string }` (ExampleEntry equivalent), `{ title: string; body: string }` (DocSectionBody equivalent), and the 6-field installation shape repeatedly. Body content is structurally identical across slices — the generator picked the inline path uniformly.

### Verdict — extract to a shared file?

**Yes, and worth doing now.** Concretely:

- Add a small `src/examples/translations/shared.ts` (or fold into an existing helper module in `src/`) that exports the three interfaces verbatim from the gold reference (lines 13-30 of `src/examples/steps/translations.ts`).
- Update each slice to:
  - `import type { ExampleEntry, DocInstallation, DocSectionBody } from "../translations/shared";`
  - Replace the inlined shapes in its `<X>Translation` interface.
- Net effect per slice: ~10-25 fewer interface lines, the slice's interface reads as `examples: { title: string; line: ExampleEntry; vertical: ExampleEntry; … }` instead of repeating `{ title: string; description: string }` six times.
- Inline shapes are *structurally* identical to the helpers — switching is type-safe (TS treats them as compatible), so the change is mechanical and reviewable in one pass.
- Risk: low. The slice value literals don't change at all; only the type aliases at the top of each file move to imports.

Doing this now beats deferring it because: (a) the generator-shape work has just landed and review-burden on the slices is still small; (b) every future slice added by the extractor will otherwise widen the duplication; (c) it removes the only structural divergence between `steps` (the hand-authored gold) and the rest, so future contributors can copy any slice and stay consistent.

---

## Genuine lint concerns

None that would block a lint run today. Everything below is "fix the generator output and re-run", not "fix individual hand-written code":

1. **Object-collapse inconsistency** between slices (`dateTimePicker`, `resourceList` vs. all others). The 280-460-char lines triggered by this aren't an ESLint rule in this repo by default, but they are visually annoying in diffs and reviews. Likely cause: the `scripts/extract-slices.mjs` output path didn't run through prettier — or ran with a different `printWidth`. Suggested fix: run `pnpm lint:fix` (or `prettier --write`) on `src/examples/*/translations.ts` after extraction; the formatter will re-break the collapsed objects without touching the template-literal bodies.
2. **Template-literal body length** in `lyrics`/`videoViewer` (380-460 char lines) is content, not style — splitting would change the rendered string. Leave them.
3. **No** banned palette literals (`bg-gray-50` etc.) appear in any of the 10 sampled files (regex against all 79 also clean).
4. **No** unused imports anywhere — none of the slices import anything.
5. **All 10** files end with a trailing newline.

### Quick win

A single `prettier --write 'src/examples/*/translations.ts'` followed by extracting the three shared interfaces would normalise every slice against the gold reference and shrink each file by ~15-30 lines on net. Both changes are mechanical and reviewable.
