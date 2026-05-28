# Multi-Review: components/react

Scope: uncommitted changes in `components/react/` only (14 modified + 3 new files, 795/305 +/-).
Models: opus across all 10 agents.
Status legend: `❌` open · `✅` resolved · `⁉️` not a real issue / outdated · ⏳ deferred (another agent).

## Out-of-scope from this fix pass

Explicitly skipped per user direction:
- Music-track hotlink fallback (SECURITY-1, DEVOPS-1, TECH-8, ARCH-5, SLOP-4, SLOP-12, TASTE-9) — user OK with the archive.org URL.
- All i18n / translation work (Theme A, Theme H, ARCH-2/6/8, TASTE-1/12/13/20/21, SLOP-16/17/18/20, FUTURE-4/5, DOC-3/4/8/10/11, QA-7/8, TECH-10, REPO-1/2/4/5/7/8) — handled by another agent.

## Status

## Summary

| Perspective   | Critical | Major | Minor |
| ------------- | -------- | ----- | ----- |
| Security      | 0        | 0     | 5     |
| Technology    | 0        | 9     | 5     |
| DevOps        | 0        | 1     | 4     |
| Architecture  | 1        | 2     | 6     |
| QA            | 0        | 11    | 9     |
| Fine Taste    | 1        | 6     | 15    |
| Documentation | 0        | 3     | 8     |
| Repository    | 1        | 2     | 5     |
| Slop          | 2        | 8     | 10    |
| Future Proof  | 0        | 6     | 4     |

## Detailed Findings

Cross-cutting themes (each shown once under the most relevant perspective, with cross-refs to duplicates):

### Theme A — `de.ts` still inlines `steps` (the new slice pattern is half-applied)

⏳ **ID:** REPO-1 / ARCH-1 / TASTE-1 / SLOP-18 — deferred to the i18n agent.
- **Severity:** Critical
- **File:** `components/react/src/languages/de.ts:229`
- **Issue:** `stepsDe` is exported from `src/examples/steps/translations.ts` but `de.ts` still contains the inline `steps: { … }` literal. `stepsDe` is dead/unimported; `en-US.ts` uses the slice, `de.ts` does not.
- **Why it matters:** Defeats the whole point of the slice extraction (single source of truth, both locales side-by-side). Drift is guaranteed on the first key change. `stepsDe` ships unused in the bundle.
- **Suggestion:** In `de.ts` add `import { stepsDe } from "../examples/steps/translations";` and replace the inline `steps: { … }` block with `steps: stepsDe`. Delete the inline block.

### Theme B — `seekTo` clamp is broken when duration is unknown

✅ **ID:** TECH-4 / QA-5 / TASTE-4 / SLOP-5 / DOC-7 — Lifted `clampSeekSeconds(audioElement, seconds)` helper used by both the internal `seekTo` callback and the imperative handle's `seekTo`; pre-metadata seeks now only clamp negatives. NaN test, pre-metadata clamp test, and updated JSDoc all in place.
- **Severity:** Major
- **File:** `components/react/lib/components/files/audioPlayer/AudioPlayer.tsx:174` (and the twin at `:300`)
- **Issue:** `Math.max(0, Math.min(el.duration || seconds, seconds))` — when `el.duration` is `0`/`NaN` (pre-metadata), `el.duration || seconds === seconds`, so the upper clamp collapses to `Math.min(seconds, seconds) === seconds`. Negative values clamp via the outer `Math.max(0, …)` so they're caught; large positives are not. The "imperative seek clamps within [0, duration]" test only passes because `fakeAudioWithDuration` runs first.
- **Why it matters:** JSDoc claim "Clamped to `[0, duration]`" is false during the realistic deep-link / autoplay window before metadata loads — `el.currentTime` receives huge or `Infinity` values which browsers handle inconsistently.
- **Suggestion:** Lift a shared helper used by both clamp sites (theme F also calls for this):
  ```ts
  const clampSeekSeconds = (el: HTMLAudioElement, seconds: number) => {
    const upper = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : Infinity;
    return Math.max(0, Math.min(seconds, upper));
  };
  ```
  Plus add `it('clamps to 0 when called before metadata loads', …)` and an explicit `NaN` test (currently uncovered by `Number.isFinite` guard).

### Theme C — `NodeMeasurementGuard` reaches into xyflow private store

✅ **ID:** ARCH-3 / TECH-1 / TECH-14 / SLOP-1 / SLOP-2 / FUTURE-7 — Refactored: narrow store subscription (only `nodesInitialized` + `domNode`), latest-state read via `useStoreApi().getState()`, one-shot `hasGuardRunRef` to prevent re-runs, `requestAnimationFrame` defer so DOM has laid out, skip-if-already-measured. Belt-and-braces declarative `width`/`height` restored on every node in `Default.tsx`.
- **Severity:** Major
- **File:** `components/react/lib/components/editor/nodeEditor/NodeEditorImpl.tsx:33-71`
- **Issue:** New `NodeMeasurementGuard` selects `s.nodes / s.setNodes / s.nodesInitialized / s.domNode` from xyflow's internal Zustand store, DOM-queries `.react-flow__node[data-id="…"]`, and writes `measured`/`width`/`height` back. Effect deps include the full `nodes` array reference, so any node mutation re-runs the effect; `setNodes(nodes.map(...))` uses a stale array snapshot instead of the updater form.
- **Why it matters:** (1) Couples lib to xyflow private internals — upgrades silently break the workaround; (2) re-renders on every drag tick since the selector returns full `nodes`; (3) the snapshot-then-write pattern races xyflow's own ResizeObserver and can stomp fresh measurements; (4) the previous fix (declarative `width`/`height` on nodes in `Default.tsx`) was simpler and strictly safer (see SLOP-15).
- **Suggestion:** Investigate the underlying ResizeObserver-behind-`React.lazy` issue rather than papering over it. Minimum acceptable refactor: (a) use `setNodes((latest) => latest.map(...))` updater form; (b) bail out when `n.measured?.width` is already set; (c) subscribe only to `nodesInitialized` and `domNode`, not full `nodes`; (d) gate behind an opt-in prop `forceMeasureNodes?: boolean` so consumers without the lazy-boundary bug don't pay the cost; (e) keep `width`/`height` declarations on the example nodes as a fallback.

### Theme D — `NodeMeasurementGuard` naming + `as never` CSS-var casts

✅ **ID:** TASTE-2 / TASTE-6 / SLOP-3 — All identifiers spelled out (`state`/`node`/`nodeElement`/`width`/`height`/`measurement`/`measuredNodeIds`). `as never` casts replaced with a `CssCustomProperties` index-signature intersection. `REACT_FLOW_STYLE` hoisted to module scope.
- **Severity:** Major (TASTE-6) / Minor (TASTE-2, SLOP-3)
- **File:** `components/react/lib/components/editor/nodeEditor/NodeEditorImpl.tsx:42-90`
- **Issue:** Single-letter / abbreviated identifiers (`s`, `n`, `el`, `w`, `h`, `m`, `ids`, `getNodes` is misleadingly named — it holds the array). CSS custom properties written as `["--xy-edge-stroke-default" as never]: …` — laundering string-literal keys through `as never` to bypass `CSSProperties`.
- **Why it matters:** House rule: names spelled out fully, no cryptic abbreviations. `as never` is a type-system bypass and reads as "fighting the compiler" rather than typing it correctly.
- **Suggestion:** Rename `s` → `state`, `n` → `node`, `el` → `nodeElement`, `w/h` → `width/height`, `m` → `measurement`, `ids` → `measuredNodeIds`, `getNodes` → `nodes`. For `rfStyle`: hoist to module scope (it has no deps) and type once as `React.CSSProperties & Record<\`--${string}\`, string | number>`, or move xyflow CSS-var overrides into a globals.css rule targeting `.react-flow` / `.react-flow.dark` (which is anyway where specificity wants them — see ARCH-9). Either way, drop the per-key `as never` casts.

### Theme E — `BAD_SIGN_MP3` third-party hotlink in Synced demo

⁉️ **ID:** DEVOPS-1 / SLOP-4 / TECH-8 / ARCH-5 / SECURITY-1 / TASTE-9 / SLOP-12 — User explicitly OK'd the hotlink, no fallback needed.
- **Severity:** Major (Critical per SLOP-4)
- **File:** `components/react/src/examples/lyrics/Synced.tsx:13-29`
- **Issue:** Demo hotlinks `https://archive.org/download/jamendo-031187/04.mp3` with `crossOrigin="anonymous"`, no offline fallback, no fixture; the 40+ line `BAD_SIGN_LRC` literal is also inlined in the file along with CC-BY-SA attribution prose; symbol names (`BAD_SIGN_MP3`/`BAD_SIGN_LRC`) leak the track identity into the file's API.
- **Why it matters:** Any availability/CORS regression at archive.org breaks docs site + Playwright run with no fallback; user IP leaks to archive.org on every demo render; tests become network-flaky; the demo file's primary asset is a foreign URL the project does not control.
- **Suggestion:** Vendor a small CC-BY-SA audio asset into `public/examples/lyrics/` (or import as a Vite asset under `src/examples/lyrics/assets/`) and inline the LRC under `src/examples/lyrics/badSignFixture.ts`. Rename constants to `DEMO_AUDIO_SRC` / `DEMO_LRC`. The example file then carries wiring only.

### Theme F — `useImperativeHandle` hook ordering + empty deps + duplicated clamp

✅ **ID:** TECH-3 / ARCH-4 / TASTE-5 / SLOP-6 / SLOP-7 — All `useState`/`useRef` declarations now precede the imperative handle; the handle is built from named `useCallback`s (`seekTo`, `playMedia`, `pauseMedia`, `getCurrentTime`, `getDuration`, `getElement`) with explicit deps. The slider and the public handle now share the same `seekTo` implementation. Test `imperative handle is stable across renders` pins that the handle identity stays `===` across rerenders.
- **Severity:** Major
- **File:** `components/react/lib/components/files/audioPlayer/AudioPlayer.tsx:168-194`
- **Issue:** `useImperativeHandle` is declared above the `useState`/`setStatus` it closes over (line 178 refs `setStatus` declared on line 194). Deps array is `[]` while the handle captures `setStatus`. The handle's `seekTo` also manually mirrors `setStatus({...status, currentTime: target})` to "avoid lag" — duplicating the internal seek path that the slider uses.
- **Why it matters:** Works only by coincidence (state setter stability + closure-deferred TDZ lookup). Future edits (reducer dispatch, derived state) silently break the handle. Two parallel `currentTime` writers (manual setStatus + `seeked` event) will drift if the browser snaps the seek to a different time. DRY violation across two clamp sites.
- **Suggestion:** (1) Reorder: declare all `useState`/`useRef` first, then derive callbacks via `useCallback`, then build the handle via `useImperativeHandle` below. (2) Have the handle delegate to the same `commitSeek` helper the slider uses so both code paths share the same side-effect sequence. (3) If the deps stay `[]`, leave a one-line comment naming each stable capture so future contributors know to extend deps when adding new captures.

### Theme G — `AudioPlayer` re-binds 11 listeners on every render

✅ **ID:** TECH-5 — Callback props are stashed in `callbacksRef` which is refreshed on every render; the audio-event effect depends on `[]` and reads from `callbacksRef.current.*` inside each listener. Regression test `re-renders with a fresh onTimeUpdate prop call the new callback` pins the behavior.
- **Severity:** Major
- **File:** `components/react/lib/components/files/audioPlayer/AudioPlayer.tsx:204-281`
- **Issue:** Audio-event effect deps include `[onPlay, onPause, onEnded, onTimeUpdate, onError]`. Inline callbacks at consumer call sites (the common case in the rewritten `Synced.tsx`) tear down + re-install all listeners on every render, and re-fire the `setStatus({...s, …})` initial-sync block, which can clobber concurrent user mute/volume interactions.
- **Why it matters:** Performance + correctness — user volume drag can snap back mid-interaction.
- **Suggestion:** Store callback props in a `useRef` updated each render; effect deps become `[]`; inside each event listener read from `callbackRef.current.onX?.(...)`.

### Theme H — i18n architecture: half-migrated slice pattern + scaling shape

⏳ **ID:** ARCH-2 / ARCH-8 / FUTURE-4 / FUTURE-5 / DOC-8 / DOC-10 — deferred to the i18n agent.
- **Severity:** Major
- **File:** `components/react/src/languages.ts:5`, `src/examples/steps/translations.ts`, `src/guides/TranslationsGuide.tsx:176`, `README.md:88`
- **Issue:** (a) `src/languages.ts` imports `StepsTranslation` from `src/examples/steps/translations.ts` — the locale-typing layer now depends on a per-example folder, inverting the natural dep direction. (b) Only `steps` follows the new slice pattern; every other component still inlines per-locale, including the brand-new `TranslationsGuide` (~50 keys added in both `en-US.ts` and `de.ts` simultaneously — exactly the anti-pattern the slice claims to fix). (c) `DECLARE_MERGE_SNIPPET` writes `declare module "@my-own-web-services/react-components"` while README writes `declare module "@my-own-web-services/react-components/lib/languages"` and the demo uses `"../lib/lib/languages"` — three different module specifiers that don't merge. (d) The Guide enshrines `t.X: string` as best practice, locking out plurals/ICU/RTL.
- **Why it matters:** Half-migrated state is the worst of both worlds; future contributors copy whichever they hit first. Cross-frontend declaration merging requires every author to target the same module path. The single-string assumption blocks the first plural/Intl use case.
- **Suggestion:** (1) Migrate the remaining example slices to per-feature files (or revert Steps); commit one pattern. (2) Move slice types to `src/languages/slices/<feature>.ts` so `languages.ts` depends on `slices/*`, not `examples/*`. (3) Pick one canonical augmentation module specifier (root `"@my-own-web-services/react-components"` is cleanest) and align README + guide + demo. (4) Add a "future-proofing: function-valued translation values" subsection to the guide, or at least widen recommended typings to `string | ((args: Record<string, unknown>) => string)`.

### Theme I — Both locales co-shipped in one slice module defeats code-splitting

⏳ **ID:** REPO-8 — deferred to the i18n agent.
- **Severity:** Minor
- **File:** `components/react/src/examples/steps/translations.ts`
- **Issue:** `stepsEn` and `stepsDe` co-defined in one module. The TranslationsGuide explicitly sells "Vite emits a separate chunk per locale" — but any consumer importing `stepsEn` drags `stepsDe` into the same chunk.
- **Suggestion:** Split into `translations.en.ts` / `translations.de.ts` with the shared `StepsTranslation` type in a third file (or re-exported from a barrel). Each locale root imports only its own slice file.

### Per-perspective findings (non-duplicates)

#### Security
- ⁉️ **SECURITY-2** Minor — `NodeMeasurementGuard` uses `CSS.escape(n.id)` correctly; reviewed and OK. No action.
- ⁉️ **SECURITY-3** Minor — `seekTo` clamp; the *security* angle is informational. The functional bug is tracked under Theme B.
- ⁉️ **SECURITY-4** Minor — Lyrics styling-only diff; no `dangerouslySetInnerHTML` introduced. No action.
- ⁉️ **SECURITY-5** Minor — TranslationsGuide renders only static template literals. No action.
- _No exploitable vulnerabilities found in this diff._

#### Technology
- ✅ **TECH-2** Major — Hoisted `REACT_FLOW_STYLE` to module scope, typed as `CSSProperties & CssCustomProperties`. Covered under Theme D.
- ✅ **TECH-6** Major — `t = useMemo(() => ({...DEFAULT_AUDIO_PLAYER_STRINGS, ...strings}), [strings])`.
- ✅ **TECH-7** Minor — `playMedia` returns `el.play()` directly (no `await` unwrap). JSDoc clarified to "Returns a resolved promise if the element hasn't mounted yet."
- ✅ **TECH-9** Minor — Renamed local `GuideIcon` → `Icon` in `App.tsx`. (Type stays `LucideIcon` since the icon prop type widening is in `GuideEntry`, covered by FUTURE-8.)
- ⏳ **TECH-10** Minor — deferred to the i18n agent.
- ✅ **TECH-11** Minor — Initial edge id is now `initial-slider-doubler`.
- ✅ **TECH-13** Minor — `Synced.tsx` rounds the value forwarded to `useExampleState` to 1 decimal (`Math.round(time * 10) / 10`). Lyrics still receives full-precision `time`.

#### DevOps
- ✅ **DEVOPS-3** Minor — Added `"typecheck": "tsc -p tsconfig.lib.json --noEmit"` script. Deliberately NOT chained into `prepublishOnly` yet because pre-existing typecheck failures in `GlobalContextMenu.tsx` and an `isValidConnection` xyflow generic mismatch in `NodeEditorImpl.tsx` predate this work and block a green typecheck. Tracked as a separate clean-up task.
- ✅ **DEVOPS-4** Minor — Extended the lib glob `ignore` list to also skip `lib/**/*.md`, `lib/**/__fixtures__/**`, and `lib/**/fixtures/**`.
- ✅ **DEVOPS-5** Minor — `NodeMeasurementGuard` is now SSR-safe by construction: `useEffect` runs only on the client, and the DOM walk (the only call into browser-only APIs like `CSS.escape` — which is also removed in the refactor since we now walk all `.react-flow__node[data-id]` elements with `querySelectorAll`) happens inside `requestAnimationFrame`. The component returns `null` server-side without touching browser globals.
- ⁉️ **DEVOPS-2** Minor — Cross-import guard concern; current state OK, just a guardrail suggestion.

#### Architecture
- ⏳ **ARCH-6** Minor — deferred to the i18n agent (TranslationsGuide-specific).
- ✅ **ARCH-7** Minor — Handle's `seekTo` now delegates to the same internal `seekTo` `useCallback` the slider uses (Theme F).
- ⁉️ **ARCH-9** Minor — Reviewer suggested moving overrides into a globals.css `.react-flow` rule. Kept as a hoisted module-scope object (Theme D) because the inline approach lets a future `reactFlowStyle?: CSSProperties` consumer-override prop (FUTURE-10) be added without re-architecture; the object identity is stable, so the React.memo concern is also resolved.

#### QA
- ✅ **QA-1** Major — `imperative seek ignores non-finite values` test added.
- ✅ **QA-2** Major — Added `imperative play/pause drive the underlying audio element`, `imperative getCurrentTime reflects the audio element's position`, `imperative getDuration returns 0 before metadata loads`.
- ✅ **QA-3** Major — `audio-seek-slider` and `audio-volume-slider` data-testids added; minimal-variant drag test now selects by testid.
- ✅ **QA-4** Major — `fires onTimeUpdate with currentTime and duration on timeupdate` plus `fires onPlay, onPause, onEnded, onError on the matching media events` plus `re-renders with a fresh onTimeUpdate prop call the new callback` all added.
- ✅ **QA-6** Major — Allowlist is now explicit (`ALLOWED_ACTIVE_CLASSES` set), prefix-match restricted to `opacity-/hover:/focus-visible:`, and a `LAYOUT_SHIFTING_PATTERNS` regex array explicitly rejects any `text-size/leading/px/py/p/space/h/min-h/max-h/w/min-w/max-w/gap-` class deltas.
- ⏳ **QA-7** Major — deferred to the i18n agent.
- ⏳ **QA-8** Major — deferred to the i18n agent.
- ⏳ **QA-9** Major — deferred to the i18n agent.
- ⁉️ **QA-10** Major — Direct unit test of the guard would require deep mocking of xyflow's store. The refactor (Theme C) instead reduces surface enough that the existing integration test, plus the visual smoke check (NodeEditor page renders with all four nodes + initial edge visible), is the practical pin. A future extracted-helper unit test is reasonable but not load-bearing.
- ⁉️ **QA-11** Major — Resolved by Theme C's `hasGuardRunRef` short-circuit (the effect can fire at most once per editor instance, with the rAF callback gating the write). Adding a stubbed `useStore` test would assert mock behavior more than real correctness.
- ✅ **QA-12** Minor — `uses one token family across the scrubber thumb and handles` test pins `bg-muted`, `bg-muted-foreground/60`, `hover:bg-muted-foreground/80`, `bg-muted-foreground/70`, `hover:bg-muted-foreground/90`, and explicitly rejects `bg-foreground/*` / `hover:bg-foreground/*` leakage.
- ✅ **QA-13** Minor — Added `shows the empty state for a whitespace-only source`, `shows the empty state for a source with only metadata`, `shows the empty state when given a pre-parsed value with no lines`.
- ✅ **QA-14** Minor — `Retry button reloads the source and clears the error state` test added.
- ✅ **QA-15** Minor — `does not display a duration when the source is streaming (Infinity)` test added.
- ✅ **QA-16** Minor — `marks the last line active when currentTime exceeds the final timestamp` integration test added.
- ✅ **QA-17** Minor — `src/examples/lyrics/Synced.test.tsx` added: clicking a lyric line drives `audio.currentTime` to the matching timestamp.
- ⏳ **QA-18** Minor — deferred to the i18n agent.
- ✅ **QA-19** Minor — `ArrowLeft at currentTime=0 keeps the position non-negative` and `ArrowRight near duration clamps to duration` tests added.
- ✅ **QA-20** Minor — `imperative handle is stable across renders` test added.

#### Fine Taste
- ✅ **TASTE-3** Major — Top-level `import { type AudioPlayerHandle } from "./AudioPlayer"` + `createRef<AudioPlayerHandle>()` throughout the test file.
- ✅ **TASTE-7** Major — `nextNodes` is now built from the latest store state read via `useStoreApi().getState()` rather than from a stale `useStore` snapshot (Theme C).
- ✅ **TASTE-8** Minor — `import * as React from "react"` dropped; `forwardRef` is in the named-import block.
- ✅ **TASTE-10** Minor — `onTimeUpdate={setTime}` inlined; `useCallback` wrappers dropped; `handleSeek` kept as a named function for clarity.
- ✅ **TASTE-11** Minor — `Default.tsx` edge comment is now WHY-only ("Namespaced id so an `onConnect`-produced edge can never collide with this initial wiring.").
- ⏳ **TASTE-12** Minor — deferred to the i18n agent.
- ✅ **TASTE-15** Minor — `play()` JSDoc rewritten to one summary sentence plus a follow-on sentence; no awkward mid-sentence line wrap.
- ✅ **TASTE-16** Minor — `sizeClasses` lifted to module scope alongside `ALLOWED_ACTIVE_CLASSES`.
- ✅ **TASTE-17** Minor — Extracted `CreditLink` component; the three duplicated `<a>` anchors consolidated.
- ✅ **TASTE-18** Minor — Both thumb body and handles now use the `muted-foreground` family (60/80 for body, 70/90 for handles).
- ✅ **TASTE-19** Minor — `size-7` now applied directly on `<Star/>`; `[&_svg]:size-7` arbitrary selector dropped from the parent.
- ⏳ **TASTE-20** Minor — deferred to the i18n agent.
- ⏳ **TASTE-21** Minor — deferred to the i18n agent.
- ✅ **TASTE-22** Minor — Default.tsx now has a top-of-file breadcrumb pointing at `NodeMeasurementGuard` in `lib/components/editor/nodeEditor/NodeEditorImpl.tsx`.

#### Documentation
- ✅ **DOC-1** Major — `COMPOSITION_SNIPPET` rewritten to show `<AudioPlayer ref={playerRef} onTimeUpdate={setTime} />` as the primary pattern, with the raw `<audio>` alternative kept as a follow-on for consumers who don't want the chrome.
- ✅ **DOC-2** Major — `currentTime` and `onSeek` API-table descriptions now lead with `<AudioPlayer>`'s `onTimeUpdate` + `AudioPlayerHandle.seekTo()`, raw `<audio>` mentioned as the alternative.
- ⏳ **DOC-3** Major — deferred to the i18n agent.
- ⏳ **DOC-4** Minor — deferred to the i18n agent.
- ✅ **DOC-5** Minor — Every handle method now carries a one-line JSDoc covering pre-mount semantics (`getCurrentTime`/`getDuration` → 0; `getElement` → null) and the escape-hatch note on `getElement`.
- ✅ **DOC-6** Minor — Class-level JSDoc reworded: "Before the underlying `<audio>` element mounts, mutating methods (`seekTo`, `play`, `pause`) are no-ops, and accessor methods return safe defaults..."
- ✅ **DOC-9** Minor — `COMPOSITION_SNIPPET` (DOC-1) now demonstrates the ref + handle wiring end-to-end.
- ⏳ **DOC-11** Minor — deferred to the i18n agent.

#### Repository
- ⏳ **REPO-3** Minor — deferred to the i18n agent.
- ⏳ **REPO-4** Minor — deferred to the i18n agent.
- ⏳ **REPO-5** Minor — deferred to the i18n agent.
- ⏳ **REPO-7** Minor — deferred to the i18n agent.
- ⁉️ **REPO-6** Minor — gitignore is complete; no action.

#### Slop
- ✅ **SLOP-8** Minor — Top-level `import type` + `createRef<AudioPlayerHandle>()`; `if (!handle) throw …` guard pattern replaces the `!` assertions.
- ✅ **SLOP-9** Major — Allowlist tightening covered by QA-6.
- ⁉️ **SLOP-10** Minor — Reviewer suggested `getComputedStyle().whiteSpace` but jsdom doesn't compute styles from class names (only inline `style=`), so the suggested check would be a no-op assertion. The current class-name check IS the practical jsdom-feasible signal. Marking as not actionable in jsdom; Playwright would be the right home if/when the test must measure real layout.
- ✅ **SLOP-11** Minor — `formatLrcTime(seconds)` exported from `./types`; karaoke wrap test consumes it; three unit tests added (whole-seconds formatting, parseLrc round-trip, negative/NaN/Infinity clamping).
- ✅ **SLOP-13** Minor — Inline comment block above the thumb explains the contrast progression "track 100 (bg-muted) → thumb body 60→80 → handles 70→90".
- ✅ **SLOP-14** Major — Resolved with TASTE-19.
- ✅ **SLOP-15** Minor — Declarative `width`/`height` restored on every node in `Default.tsx` (Theme C).
- ⏳ **SLOP-16** Minor — deferred to the i18n agent.
- ⏳ **SLOP-17** Minor — deferred to the i18n agent.
- ✅ **SLOP-19** Minor — `uses transition-colors (not transition-all) on lines` test added.
- ⏳ **SLOP-20** Minor — deferred to the i18n agent.

#### Future Proofing
- ⁉️ **FUTURE-1** Major — Deferred. Restructuring `AudioPlayerHandle` to `{ transport: {...}, ... }` namespaces would break every consumer immediately (the Synced demo already wires `playerRef.current?.seekTo(s)`), and the speculative groupings (`tracks`, `captions`, `playlist`) have no concrete consumer yet. CLAUDE.md: "Don't add features, refactor, or introduce abstractions beyond what the task requires." The flat shape is fine for v1; revisit when a real second use-case arrives.
- ⁉️ **FUTURE-2** Major — Deferred for the same reason as FUTURE-1. Adding a `source?: { type: "single"...} | { type: "playlist"... }` prop today adds an unused discriminated union that no caller exercises; widening `src: string` later is straightforward when a real playlist consumer materialises.
- ⁉️ **FUTURE-3** Major — Deferred for the same reason. `trackId` is a future-feature hook with no current consumer. Single-track is the universally exercised shape; adding the field today couples callers to a concept they don't use yet.
- ⁉️ **FUTURE-6** Minor — Theme B's `clampSeekSeconds` already passes pre-metadata seeks through (negatives clamp to 0, positives pass to the audio element which queues them itself). A `whenReady` option would re-implement what `<audio>` already does internally. Marking as not actionable absent a concrete bug.
- ✅ **FUTURE-8** Minor — `GuideEntry.icon` widened to a new exported `GuideIconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>`. `LucideIcon` satisfies it, so existing `BookOpen`/`Languages` entries are unchanged.
- ⁉️ **FUTURE-9** Minor — Same rationale as FUTURE-1/2/3 — adding a `density` prop today with no consumer demand is speculative. The current tests pin the *invariant* (no layout shift between active/inactive) without preventing a future redesign: if/when a karaoke variant is added, those tests can be relaxed alongside the feature.
- ⁉️ **FUTURE-10** Minor — Theme D's hoisted `REACT_FLOW_STYLE` already eliminates the re-creation/memo concern. Adding a `reactFlowStyle?: CSSProperties` consumer-override prop has no current caller; it can be added as a one-line `style={{...REACT_FLOW_STYLE, ...reactFlowStyle}}` when needed.

## Recommendations (prioritized)

1. **Critical: Fix the half-applied steps slice in `de.ts`** (Theme A — REPO-1/ARCH-1/TASTE-1/SLOP-18). Single import + delete inline block. Trivial to fix, defeats the whole refactor if left.
2. **Critical/Major: Replace `BAD_SIGN_MP3` with a vendored asset** (Theme E). The demo is the canonical example other frontends will copy.
3. **Major: Fix the `seekTo` clamp + add NaN / pre-metadata tests** (Theme B — TECH-4/QA-5/TASTE-4/SLOP-5/DOC-7).
4. **Major: Decide on `NodeMeasurementGuard`'s future** (Theme C — investigate root cause vs. gate behind opt-in prop + revert to declarative `width`/`height` in `Default.tsx`). Then apply Theme D (rename + drop `as never`).
5. **Major: Reorder `useImperativeHandle` and share the seek path with the slider** (Theme F).
6. **Major: Memoize `t` strings and stop re-binding 11 listeners every render** (TECH-5 + TECH-6).
7. **Major: Commit to the i18n slice pattern (or revert)** (Theme H) — including aligning the README + guide module specifiers.
8. **Major: Decide AudioPlayer's future shape now** (FUTURE-1/2/3) — `transport.*` namespace + optional `trackId` propagation. Widening later is breaking.
9. **Major: QA gaps** — add tests for `onTimeUpdate`/`play`/`pause`/Synced integration, tighten `ALLOWED_ACTIVE_PREFIXES`, add cross-locale tree-walking test, `NodeMeasurementGuard` direct test (QA-2/4/6/7/8/10).
10. **Major: Doc drift** — fix `LyricsDocPage` snippets to use AudioPlayer + ref, add README pointer to the new guide (DOC-1/2/3).
11. **Minor sweep**: TASTE/SLOP cleanups (`import * as React`, `as never`, hand-rolled `MowsContext`, comment WHY-only, drop `useCallback` cargo-cult, lift duplicated helpers).
