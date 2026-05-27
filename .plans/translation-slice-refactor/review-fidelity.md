# Translation-slice extraction fidelity audit (commit `abd21df1`)

## Verdict

The mechanical extraction is **byte-for-byte faithful** for every component that existed
before the refactor. All 79 slice files are present, all three required exports
(`<Name>Translation`, `<name>En`, `<name>De`) are well-formed, the rewritten parent
files reference every slice once, and imports are deduplicated and in sorted (case-
sensitive ASCII) order.

One genuine **content addition** rides along inside this otherwise-mechanical commit:
the `emojiPicker` slice is new — it was never in the pre-refactor `languages.ts` /
`en-US.ts` / `de.ts`, so it cannot have been "extracted" from anything. See
[`§ emojiPicker`](#emojipicker--new-content-not-an-extraction) below.

## Method

I built two small helpers (parked under `/tmp/extract-*.mjs`) that pull a single
top-level keyed block out of a TypeScript object literal — backtick-/quote-aware
brace counting, de-indented by four spaces. They let me programmatically diff the
slice file's body against the matching block in the parent commit:

```
git show abd21df1^:components/react/src/languages.ts            ↔  examples/<n>/translations.ts (kind=type)
git show abd21df1^:components/react/src/languages/en-US.ts      ↔  examples/<n>/translations.ts (kind=en)
git show abd21df1^:components/react/src/languages/de.ts         ↔  examples/<n>/translations.ts (kind=de)
```

Beyond the requested 6-8 spot-checks I ran the diff across **all 79 slices** to
make sure nothing slipped between them.

## Spot-checks (all clean)

| Slice                | Type | EN  | DE  | Notes                                          |
|----------------------|:----:|:---:|:---:|------------------------------------------------|
| `avatar`             |  ok  | ok  | ok  | Trivial — small block, German umlauts intact (`ü, é, ñ, …` in `unicodeInitial`) |
| `badge`              |  ok  | ok  | ok  | Trivial — variants block matches verbatim     |
| `button`             |  ok  | ok  | ok  | Medium — `variants` / `sizes` / `asChild` blocks all match |
| `card`               |  ok  | ok  | ok  | Medium — every nested key in order            |
| `videoViewer`        |  ok  | ok  | ok  | Large — full DOC block + behaviour list verbatim |
| `lyrics`             |  ok  | ok  | ok  | Large — multi-mode block (`.lrc` / synced / fallback) verbatim |
| `inlineEdit`         |  ok  | ok  | ok  | Large — modal/inline mode block + commit/cancel statements intact |
| `dateTimePicker`     |  ok  | ok  | ok  | Non-ASCII — umlauts (`ä`, `ö`, `ü`, `ß`) and em-dash preserved |
| `locationPicker`     |  ok  | ok  | ok  | Non-ASCII — `Koordinatenwähler`, `Lösch-Button`, `Festgelegtes Verhalten` all intact |

In every case `diff` returned zero output for the type, en, and de bodies.

The pre-refactor source already used a mix of expanded and collapsed (single-line)
literal styles (e.g. `mapStylePicker`, `map`, `locationPicker` were already collapsed
to `{ a: 'x', b: 'y' }` form). The slice files preserve whichever style was used,
which is the right call for byte-for-byte fidelity.

## Full sweep across all 79 slices

Running the same diff for every component:

```
Total slices: 79
Mismatches: 2 / 79
  - steps         (expected: this slice predates abd21df1; the parent commit
                   already had it as `steps: StepsTranslation;` so there is no
                   inline block to compare against — not a bug)
  - emojiPicker   (see next section)
```

## `emojiPicker` — new content, not an extraction

`abd21df1` adds `components/react/src/examples/emojiPicker/translations.ts`
(132 lines), the matching `EmojiPickerTranslation` field in `languages.ts`, and
the matching `emojiPicker: emojiPickerEn/De` references in both locale files.

However:

- `git show abd21df1^:components/react/src/languages.ts | grep -i emoji` returns
  nothing related to a picker (only the `🇺🇸 / 🇩🇪` flag emojis).
- Same for `languages/en-US.ts` and `languages/de.ts` in the parent commit.
- `EmojiPicker.tsx` itself is **untracked** in this branch
  (`/home/paul/projects/mows/components/react/lib/components/input/emojiPicker/EmojiPicker.tsx`
  exists on disk but is not in `git ls-files`).

So the script could not have extracted these strings — they were authored as
part of this commit. The format also gives it away: the en/de bodies are
collapsed to one entry per line (e.g.
`default: { title: 'Default', description: 'Full picker with search, ...' },`)
which is what a human types, not what a block-by-block brace-counter would
produce from an indented literal.

**Why this matters:** the commit message claims the refactor is "mechanical" /
"intentionally kept verbatim of the original inline literal." For `emojiPicker`
that contract is technically violated — there was no original literal — and the
new content has not been content-reviewed alongside the refactor. If the intent
of `abd21df1` is *purely* a refactor, the emojiPicker addition should be moved
into its own commit (alongside its source component and tests) so it can get
the normal "new feature" review treatment.

Concrete pointers:

- `components/react/src/examples/emojiPicker/translations.ts:14` —
  `EmojiPickerTranslation` interface (4 top-level example modes + full `doc` block).
- `components/react/src/languages.ts` (post-commit) — `import type { EmojiPickerTranslation } …`
  and `emojiPicker: EmojiPickerTranslation;` slot in the `examples:` block.
- `components/react/src/languages/en-US.ts` (post-commit) and `languages/de.ts`
  similarly import and slot `emojiPickerEn` / `emojiPickerDe`.

(Not a fidelity bug per se; flagged because the audit asked for "any structural
divergence" and this is the only thing in the diff that isn't a pure
extraction.)

## Structural sanity of the rewritten parent files

### `components/react/src/languages.ts` (post-refactor)

- 79 `import type { <Name>Translation } from "./examples/<name>/translations";` lines.
- 79 `<name>: <Name>Translation;` lines in the `examples: { … }` block (one per
  slice). Set of slice keys == set of imported types, no leftovers and no
  duplicates.
- Imports are sorted case-sensitively (so `KeyComboDisplay` < `KeyboardShortcutEditor`
  because uppercase `C` < lowercase `b`). `sort -c` complains about this but it
  is consistent and intentional.
- Imports are unique (`sort -u` == `wc -l`).
- The `BaseTranslation` import (`{ Language, Translation }`) at the top is
  unchanged from the parent commit.

### `components/react/src/languages/en-US.ts` and `de.ts` (post-refactor)

- Both files have 79 `import { <name>En / De } from "../examples/<name>/translations";`
  lines, sorted and deduplicated identically to the type file.
- Both files have 79 `<name>: <name>En,` / `<name>: <name>De,` references in
  the `examples:` block (plus the inline `_harness` literal, which is correctly
  left in place — that one is not a slice).
- The set of slice keys in the en file == set in the de file (verified via
  `diff /tmp/en_order.txt /tmp/de_order.txt` — empty).
- The set of slice keys in the locale files differs from the **order** of fields
  in the type declaration (notably `timeline`, `nodeEditor`, `consoleManager`,
  `dateTimeDisplay` are interleaved differently). This is **not a bug** —
  TypeScript object-literal field order is unconstrained by the declared
  interface order — but worth mentioning so a future reader doesn't go hunting
  for it. The en and de files are identical in ordering, which is what matters.

### Counts cross-check

- `git ls-tree -r abd21df1 components/react/src/examples/ | grep translations.ts | wc -l` → **79**
- Imports in `languages.ts` → **79**
- Imports in `languages/en-US.ts` → **79**
- Imports in `languages/de.ts` → **79**
- Slice-key references in `languages.ts` → **79**
- Slice-key references in `languages/en-US.ts` → **79**
- Slice-key references in `languages/de.ts` → **79**

All seven counts reconcile. The 80th `examples/` directory is `harness/`, which
correctly has no `translations.ts` (its strings live under the inline `_harness`
literal in the locale files).

### Per-slice export shape

For every one of the 79 slice files, exactly one of each of these declarations
exists with matching name capitalisation:

```
export interface <Name>Translation { ... }
export const <name>En: <Name>Translation = { ... };
export const <name>De: <Name>Translation = { ... };
```

(Verified via the regex sweep across the slice files — `Structural issues: 0 / 79`.)

## What I did not find

- No dropped sentences, missing words, or mis-escaped characters in any of the
  spot-checked slices.
- No reordered keys within a slice (the EN block order inside each slice matches
  the type-block field order, and the DE block mirrors EN).
- No structural divergence between the type and the en/de values within any
  slice — every nested key path lines up.
- No backtick string with an embedded raw `}` that could confuse the brace
  counter — the only `}` characters inside backticks are template-literal
  interpolations like `\`${variable}\``, which the brace counter handles
  correctly because it tracks `inBacktick` state.
- No leftover inline literals in the rewritten parent files (the only inline
  block left is `_harness`, which is intentional).
