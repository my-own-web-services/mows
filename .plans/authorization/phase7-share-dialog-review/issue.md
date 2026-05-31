# Phase 7 ShareDialog — multi-review round 1

Date: 2026-05-31
Scope: `components/react/lib/components/identity/shareDialog/` (component +
types + tests), the supporting DocPage scaffolding under
`components/react/src/examples/shareDialog/`, the lib export + demos +
language registrations, and the realtime chat consumer's swap from the
old channel-only ShareDialog to the new generic primitive.

Reviewers: 4 parallel `Explore` agents (Security, Tech, QA, Slop).

## Findings — dispositions

Severity legend: ▲ Critical · ◆ Major · ○ Minor

### R1 — TOCTOU between dialog re-open and in-flight onShare (SEC-1 / SEC-2) ◆

If the parent closes the dialog while `onShare` is in flight and re-opens
it before the promise settles, the reset useEffect (deps `[open, …]`)
wipes the form state mid-await. When `onShare` finally resolves, the
subsequent `onOpenChange(false)` fires against the second open, and any
state the second open had set up is silently lost.

This is a real race but its consequences are minor — the worst outcome
is a confusing UX (dialog closes after the user re-opened it, or stale
"share submitted" toast). No security boundary is crossed: the actual
policy submission already happened with the data the user originally
confirmed.

**Disposition:** FIX with the conventional async-cancel pattern — track a
monotonically increasing submission id in a ref; only honour the
post-await close if the id still matches.

### R2 — Allow/Deny path never end-to-end submitted (QA-1) ◆

The Allow/Deny toggle test only verifies the radios render; nothing
clicks Deny + Read + Share and asserts `effect: "Deny"` reaches
`onShare`. The render-only test would pass even if a regression
made the radio inert.

**Disposition:** FIX. Add `submits with effect: "Deny"` test.

### R3 — RTL section missing `<ExampleCard>` (TECH-1) ◆

CLAUDE.md §5 (Doc pages) explicitly requires the RTL section to ship an
`<ExampleCard hideHeader>` previewing the component under `dir="rtl"`.
My DocPage has the section heading + body but no example. Drift from
the canonical doc shape.

**Disposition:** FIX. Add `Rtl.tsx` example file, register in `index.ts`,
reference from the DocPage's RTL section.

### R4 — `subjectKindLabel` switch is not exhaustiveness-guarded (TECH-2 / SLOP-1) ○

The four-case switch covers every current `ShareSubjectKind` but has no
`never`-binding default. A future fifth kind silently returns
`undefined` instead of failing at compile time.

**Disposition:** FIX. Add `default: { const _exhaustive: never = kind;
return _exhaustive; }`.

### R5 — Effect cast lacks runtime narrowing (SEC-3) ○

`onValueChange={(value) => setEffect(value as ShareEffect)}` casts a
string blind. Today the RadioGroup constrains it; a future regression
or a custom adapter could let other strings through.

**Disposition:** FIX. Wrap with a `VALID_EFFECTS` set check; default to
`"Allow"` on invalid input.

### R6 — Empty `subjects` array silently renders a broken dialog (QA-4) ◆

If a caller passes `subjects={[]}`, the dialog renders with no tabs and
no picker; submit always errors with "Pick someone". The behaviour is
correct (no crash) but the UX is a silent footgun — the caller has no
signal they misconfigured.

**Disposition:** FIX. Render a clear empty-state message instead of a
mute dialog; add a test pinning this behaviour.

### R7 — Empty `subjects` shouldn't even mount the dialog body usefully (QA-4 corollary) ○

Same root cause as R6. The current code defaults `selectedKind` to
`"user"` even when `availableKinds` is empty, which is dead state.

**Disposition:** Fixed by R6 (the empty-state branch returns before any
of the kind/picker logic runs).

### R8 — Chat consumer's action narrowing has no runtime guard (SEC-5 / QA-8) ◆

`input.actions as ("ChannelsRead" | "ChannelsList" | "ChannelsPublish")[]`
in ActiveRoom.tsx is safe-by-construction *today* (only
`CHAT_SHARE_ACTIONS` ever ships), but a future bug — wider action set,
manual dialog mutation, third-party adapter — would slip through
silently and forward bogus action ids to the backend.

**Disposition:** FIX. Guard the cast with a runtime allowlist that
throws on unknown ids — narrows the cast to "safe by both construction
AND runtime check".

### R9 — Reset-on-reopen test only verifies one of five state fields (QA-6) ○

The test toggles + verifies `selectedActionIds` but doesn't pin
`effect`, `error`, `selectedKind`, `selectedSubject`. A regression
that drops the `setEffect("Allow")` line would not be caught.

**Disposition:** FIX. Extend the existing test to assert effect, error,
and kind reset alongside actions.

### R10 — Sentinel NIL_UUID duplicated across example files (SLOP-2) ○

The literal `"00000000-0000-0000-0000-000000000000"` appears in
`Default.tsx:38` and `PublicOnly.tsx:14`. The test fixture already
factors it into a `NIL` constant. Examples and tests should share the
same export.

**Disposition:** FIX. Export `NIL_UUID` from
`identity/shareDialog/types.ts`; consume from both examples.

### R11 — `initialSubjectId` fallback path not tested (QA-2) ○

When the caller passes an id that doesn't exist in `subjects`, the dialog
falls back silently to the first available subject. The fallback works
but is untested — a future refactor could regress it without anyone
noticing.

**Disposition:** FIX. Add a one-line test.

### R12 — Multiple `excludeSubjectIds` not tested (QA-3) ○

Single-id exclusion is tested; multi-id isn't. The implementation uses a
`Set` so it should already work; the test just pins it.

**Disposition:** FIX. Extend the existing exclude test with a second id.

### R13 — Cyclic implications never asserted to terminate (QA-5 / SEC-6) ○

`buildImplicationClosure` has the cycle-break check (`if
(acc.has(implied)) continue`) but no test proves cycles terminate +
expand correctly.

**Disposition:** FIX. Add `handles cyclic implications` test.

### R14 — `void within;` placeholder is a dead-import smell (SLOP / QA-7) ○

Imports `within` from testing-library and silences ESLint with `void
within;` "for future use". Either use it now or remove it.

**Disposition:** FIX. Remove the import + the placeholder; reinstate
when a real scoped query lands.

### R15 — DocPage behaviour entries have zero margin for new tests (QA-10) ○

Every existing test has a corresponding behaviour entry. Adding a test
without updating the DocPage will silently desync.

**Disposition:** ACCEPT — the codebase already runs a behaviourEntry
integrity test that fails the build when a citation drifts; the
forcing function exists. No code change needed.

### R16 — Multiple sentinel subjects of the same kind auto-select first (SEC-4) ○

If a caller passes two `kind: "public"` subjects, switching to the
Public tab auto-selects whichever appears first in the array. The
caller-controlled subjects array is trusted (no XSS path), but the
component doesn't document the assumption.

**Disposition:** ACCEPT — document only. The caller surface is "you
supply the subjects", and supplying two of the same sentinel is a
caller bug. Add a one-line comment near the auto-select logic.

### Deferred / accepted-without-change

- **R-D1 (QA-9):** action-list perf at 100+ items — speculative, no
  current consumer has that many actions. Accept; revisit if a
  consumer hits the wall.
- **R-D2 (R11 of the prior session, QA-7 here):** `void within;` clean-up
  already addressed under R14.
- **R-D3 (TECH "i18n via strings vs MowsContext"):** the strings-prop
  design is deliberate — keeps the component i18n-neutral so apps that
  don't use MowsContext (or use a different i18n stack) can still
  consume. No change.

## Implementation order

R3 + R4 + R5 + R10 + R14 + R16 (DocPage / type / cosmetic) → R6
(empty-subjects branch) → R8 (chat consumer guard) → R1 (submission
race) → tests R2 + R9 + R11 + R12 + R13.
