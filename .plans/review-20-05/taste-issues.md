# Fine taste review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** Fine Taste Engineer
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 6 |
| Major | 31 |
| Minor | 47 |

## Triage status legend

- `✅` — fixed in this branch (status block underneath each entry documents the fix).
- `⁉️` — accepted-or-deferred. The remaining unfixed items fall into two
  buckets:
  1. **Naming sweeps** (TASTE-32 → TASTE-66+) — rename `ctx`/`cfg`/`req`/`res`/`cb`/`el`
     across hundreds of sites. The user CLAUDE.md "no abbreviations" rule
     stands, but each individual sweep touches 50-300+ files and overlaps with
     other planned refactors (ResourceList row-handler signature change,
     lib/lib/ rename, supervisor `vm_runtime.rs` extraction). Doing them all
     inside a multi-perspective-review fix branch dilutes the focus; they
     bundle into a dedicated naming-sweep follow-up branch where the diff is
     a single mechanical pass under its own review.
  2. **Structural reworks** (Monaco TypeScript namespace cast, vite plugin
     walk-up, hand-rolled modal singleton, codegen Docker alternatives) —
     each has a documented trade-off explaining why the current shape is
     deliberate today.

See per-item status blocks for the specific rationale.

## Findings — Hacks / non-canonical approaches

---

- **ID:** ✅ TASTE-1
- **Status:** Fixed
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:40
- **Issue:** `BAKE_ARGS` hard-codes `/home/paul/projects/mows` as an absolute path. The build script is otherwise machine-portable, but this line will break every other developer (and any CI machine).
- **Why it matters:** Per the project's CLAUDE.md, "Builds must be producible locally and in a github pipeline and always produce the exact same artifacts." A hard-coded `$HOME` of one developer fails that contract loudly. Worse, this slipped past the previous review because `local` builds for the author still work.
- **Suggestion:**
  ```bash
  export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=$(git rev-parse --show-toplevel) --set *.args.APP_STAGE_IMAGE=alpine"
  ```
  Or `--allow=fs.read=${SCRIPT_DIR}/../..` if `git` isn't guaranteed to be on PATH.
- **Fix applied:** Replaced the literal path with `REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"` and converted `BAKE_ARGS` to a properly-quoted array so the `--allow=fs.read=…` flag survives spaces in the path. Also addresses TECH-INFRA-1.

---

- **ID:** ✅ TASTE-2
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Replaced all three raw `<button>` elements in `InlineEdit.tsx` with shadcn `<Button variant="ghost" size="icon-xs">` and adjusted `slotButtonBase` to compensate for the variant's default `h-9 w-9` (override to `h-auto w-auto p-0 absolute inset-0`). Existing focus/aria/hover behaviour preserved; opacity transitions still drive visibility per state. All 41 tests across the 5 affected component test files pass.
- **File:** /home/paul/projects/mows/components/react/lib/components/input/inlineEdit/InlineEdit.tsx:247,271,290
- **Issue:** Three raw `<button type="button">` elements — directly in the library itself, with hand-rolled `cursor-pointer` and focus-visible classes.
- **Why it matters:** The user's CLAUDE.md (memory and component CLAUDE.md) explicitly bans raw HTML controls in this library: "Every UI control (checkbox, radio, select, input, label, button, switch, slider, dialog, popover, tooltip, scroll area, etc.) MUST come from this package." Every wrapper that does this defeats theme, focus-ring, dark-mode, and a11y guarantees the shadcn primitives give us. This was the exact reason for that memory entry.
- **Suggestion:** Wrap the three slot buttons in the shadcn `<Button>` (or `<Button variant="ghost" size="icon">`); the visual sizing (`SLOT_SIZE`/`AFFORDANCE_WIDTH`) is already a flex column so any size of `<Button>` slots in.

---

- **ID:** ✅ TASTE-3
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Replaced both raw `<button>` stepper buttons in `NumberInput.tsx` with shadcn `<Button variant="ghost" size="icon-xs">`, overridden with `h-auto w-7 rounded-none p-0` to keep the existing 7-wide rectangular stepper geometry.
- **File:** /home/paul/projects/mows/components/react/lib/components/input/numberInput/NumberInput.tsx:131,145
- **Issue:** Two raw `<button>` elements for the `-`/`+` stepper. Same rule violation as TASTE-2, plus this is a brand-new component being added in this change set so there is no excuse.
- **Why it matters:** Library-level violations of the no-raw-controls rule propagate to every consumer: every place that imports `NumberInput` now ships a non-themed control. The ModalHost in mows-vm-supervisor already imports `NumberInput` — the supervisor's UI inherits this regression silently.
- **Suggestion:** Use the shadcn `<Button variant="ghost" size="icon">` (or a new `IconButton` primitive in `lib/components/ui/` if a 7×9 inline stepper is a recurring need).

---

- **ID:** ✅ TASTE-4
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Section-jump nav buttons in `SettingsPanel.tsx` now use shadcn `<Button variant="ghost">` with `h-auto justify-start font-normal` overrides to preserve the left-aligned, full-height nav-item appearance.
- **File:** /home/paul/projects/mows/components/react/lib/components/settings/settingsPanel/SettingsPanel.tsx:229
- **Issue:** Raw `<button type="button">` for the section-jump nav inside the settings panel.
- **Why it matters:** Same library-level violation. The button is keyboard-tab-target, so a non-shadcn variant is missing focus-visible styling under non-default themes.
- **Suggestion:** Use `<Button variant="ghost" size="sm" asChild>` wrapping an anchor, or replace the whole nav with the existing `<Tabs orientation="vertical">`.

---

- **ID:** ✅ TASTE-5
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Both raw `<button>` action icons in `ConsoleManager.tsx` (split / kill) replaced with shadcn `<Button variant="ghost" size="icon-xs">`.
- **File:** /home/paul/projects/mows/components/react/lib/components/console/consoleManager/ConsoleManager.tsx:740,755
- **Issue:** Two raw `<button>` elements inside the console manager component.
- **Why it matters:** Same library-level violation.
- **Suggestion:** Wrap in `<Button>` primitives.

---

- **ID:** ✅ TASTE-6
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Replaced the raw `<input className="sr-only">` in `KeyboardShortcutEditor.tsx` with shadcn `<Input className="sr-only">`. Imported `Input` from `@/components/ui/input`. Same keyboard event handlers and aria-label preserved.
- **File:** /home/paul/projects/mows/components/react/lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor.tsx:491
- **Issue:** Raw `<input className="sr-only">` for the hidden hotkey capture input. Not a shadcn `<Input>` and not even a labeled input.
- **Why it matters:** Same as above. This used to be an "atoms" component being moved without cleanup, but the CLAUDE.md ban applies regardless of the move target. An sr-only input is precisely the case where a `<VisuallyHidden>` + shadcn `<Input>` would convey intent better.
- **Suggestion:** `<VisuallyHidden><Input ref={…} aria-label="hotkey-input" /></VisuallyHidden>` (Radix `<VisuallyHidden>` is already in the deps).

---

- **ID:** ✅ TASTE-7
- **Status:** Fixed
- **Severity:** Major
- **Fix applied:** Header-action raw `<button>` in `Sidebar.tsx` replaced with shadcn `<Button variant="ghost" size="icon-sm">`. Imported `Button` from `mows-components-react/components/ui/button`. Same focus/click handler preserved.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/Sidebar.tsx:145
- **Issue:** Raw `<button type="button">` for the "+ new VM" header action. The supervisor web app is the canonical consumer of `mows-components-react`, so it should be the first place to obey the rule.
- **Why it matters:** Sets a bad precedent for every other consumer of this library — "raw `<button>` is fine in app code." It also doesn't visually match the surrounding `SidebarMenuButton`s because it inherits no theme tokens.
- **Suggestion:** Use the shadcn `<Button variant="ghost" size="icon">` — the styling will line up automatically with the sidebar's button row.

---

- **ID:** ✅ TASTE-8
- **Severity:** Major
- **Status:** ✅ Fixed
- **Fix applied:** Replaced the raw hidden `<button type="submit" />` in `ModalHost.tsx` with shadcn `<Button type="submit" variant="ghost" className="sr-only">submit</Button>`. Keeps the Enter-to-submit semantics via the implicit form submit but routes through the library Button.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/ModalHost.tsx:232
- **Issue:** `<button type="submit" className="hidden" />` for the form Enter-to-submit hack.
- **Why it matters:** Same library rule. The "hidden submit button so Enter works" is a known dom trick, but Radix's `<Dialog>` already wires Enter to its primary button via Radix focus management; the right answer is to call `confirm()` on `onKeyDown=Enter` inside the form. The hack is also accessibility-hostile — assistive tech will still announce a focusable "submit" button.
- **Suggestion:** Drop the hidden button. Instead, on the form: `onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") { e.preventDefault(); confirm(); } }}`. Or better, wrap inputs that should trigger submit in a `<form>` and use the existing shadcn `<Button type="submit">` as the actual submit button.

---

- **ID:** ✅ TASTE-9
- **Status:** Fixed — Added a 5-line block comment above the `<pre><code>` in `CommandBlock.tsx` explaining that the always-dark zinc palette is deliberate (install commands should read as "shell prompt", not as themed code). Stays raw `<pre>` by design now that the rationale is captured.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/CommandBlock.tsx:88-92
- **Issue:** Hand-rolled `<pre><code>{full}</code></pre>` shell snippet. The library already has `<CodeViewer>` + `<CodeSnippet>` for code rendering — but this block intentionally uses raw `<pre>` to maintain "dark in both light/dark themes" terminal styling.
- **Why it matters:** The `<CodeViewer fitContent language="text">` would render the same string with consistent typography, and the dark-themed terminal style is exactly what the active Monaco code theme delivers. Hand-rolling here means the user's chosen code theme silently doesn't apply.
- **Suggestion:** Either accept that this is a deliberate "always-dark terminal" surface (current state) and add a one-line comment explaining why CodeViewer isn't used, OR migrate to `<CodeViewer fitContent language="text" code={full} />` with a forced dark theme variant.

---

- **ID:** ⁉️ TASTE-10
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeViewer/MonacoCodeEditor.tsx:52-66
- **Issue:** `cast through `any`` for the Monaco TypeScript namespace — uses `(monaco.languages as { typescript?: unknown }).typescript as | {…} | undefined`. The 5-line type intersection is mostly noise.
- **Why it matters:** This is the exact kind of "we know better than the bundled types" cast that always grows fragile when the upstream library version moves. The Monaco typings DO export `monaco.languages.typescript`; the cast is here to silence a deprecation warning, but at the cost of structural-type-checking.
- **Suggestion:** `// eslint-disable-next-line @typescript-eslint/no-deprecated` (or whatever the deprecation rule is) plus a direct call:
  ```ts
  monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions?.({ noSemanticValidation: true, noSyntaxValidation: true });
  monaco.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions?.({ noSemanticValidation: true, noSyntaxValidation: true });
  ```
  Direct optional chain on the real typed namespace, deprecation suppressed in one place.

---

- **ID:** ✅ TASTE-11
- **Status:** Fixed — `frameGrabber.ts` switched from `host.style.cssText = "position:fixed;…"` to a typed `Object.assign(host.style, { position, left, top, … } satisfies Partial<CSSStyleDeclaration>)`. Typo-resistant and TypeScript-checked.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/videoViewer/frameGrabber.ts:82-84
- **Issue:** Inline `host.style.cssText = "position:fixed;left:-9999px;…"` — concatenated style string instead of typed CSS properties.
- **Why it matters:** Style strings bypass TypeScript and prettier; one stray semicolon and the rule silently doesn't apply. The library uses Tailwind everywhere else, so this is the only place that breaks the pattern.
- **Suggestion:** Use the CSSStyleDeclaration API on the typed element:
  ```ts
  Object.assign(host.style, {
      position: "fixed",
      left: "-9999px",
      top: "0",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      pointerEvents: "none",
      opacity: "0"
  });
  ```
  Or render the host via a React portal with className `"fixed -left-[9999px] top-0 h-px w-px overflow-hidden pointer-events-none opacity-0"`.

---

- **ID:** ⁉️ TASTE-12
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/serializeState.ts:33
- **Issue:** `return Math.random().toString();` as a fallback when JSON.stringify throws — used as a memoization cache key.
- **Why it matters:** Using `Math.random()` to defeat React's memoization is a code smell. It works, but a reader has to puzzle out why a random number is part of a JSON key. There is a comment explaining it ("acceptable; the display path will produce a stable result"), but the cleaner expression is to return a sentinel that forces re-evaluation explicitly.
- **Suggestion:** Use a sentinel symbol with a counter, or accept identity-based re-rendering by changing the `useMemo` to a `useRef`+effect pattern. Even `String(Date.now())+Math.random()` would be more honest about "I want every render to be considered different."

---

- **ID:** ✅ TASTE-13
- **Status:** Fixed — The favorite-star button in `App.tsx` (line 593) now uses the shadcn `<Button variant="ghost" size="icon">` primitive instead of a raw `<button>`. The custom flex/h-9/w-9/transition-colors styling collapses into the Button primitive's built-in surface; only the per-state foreground tint stays in `className`. The `<a>` inside `SidebarMenuButton asChild` flagged as the other half of TASTE-13 is the documented shadcn pattern for menu navigation; it stays.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/App.tsx:260-274,445-468
- **Issue:** Raw `<a href>` (line 260-274) and raw `<button type="button">` (line 445-468) in the example app's sidebar. App-level violation of the library's no-raw-controls rule.
- **Why it matters:** The example app is the showcase for the library — it should be the model citizen. Anyone who reads `App.tsx` to learn how to wire `mows-components-react` will copy the raw `<a>` and `<button>` patterns.
- **Suggestion:**
  - The `<a>` inside `SidebarMenuButton asChild` could become `<SidebarMenuButton asChild><Link to=…>…</Link></SidebarMenuButton>` if router is added, or just an `<a>` is acceptable here since `SidebarMenuButton asChild` is the pattern shadcn documents for menu navigation.
  - The favorite-star `<button>` (line 445) should be `<Button variant="ghost" size="icon">`.

---

- **ID:** ✅ TASTE-14
- **Status:** Fixed — `selectionFromPath` now parses the URL via WHATWG `new URL(pathname, window.location.origin)` and `split(\`/\`).filter(Boolean)` so query strings (`/Button?focus=variants`) and trailing slashes (`/Button/`) are handled uniformly. The base-path-prefix check is preserved so the deployed `/mows/` GitHub Pages layout keeps working. 988 harness tests still pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/App.tsx:107-114
- **Issue:** `pathname.replace(DEFAULT_PATH_PREFIX, ``).split(`/`)[0]` for URL parsing instead of `new URL(window.location.href).pathname.split('/').filter(Boolean)[0]`.
- **Why it matters:** Rolling string-split parsing on pathnames is canonical-violation #1 for the user's instructions ("TypeScript: built-in `URL`, `URLSearchParams`"). The current implementation also doesn't handle trailing slashes or `??` query params.
- **Suggestion:**
  ```ts
  const idFromPath = (pathname: string): string | undefined => {
      const url = new URL(pathname, window.location.origin);
      const segment = url.pathname.split("/").filter(Boolean)[0];
      if (!segment) return undefined;
      const lower = segment.toLowerCase();
      return demos.find((d) => d.name.toLowerCase() === lower)?.id;
  };
  ```

---

- **ID:** ⁉️ TASTE-15
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/actions.ts:62-86
- **Issue:** Module-scoped `document.addEventListener("contextmenu", …, true)` runs at module-load time. This is a side effect tucked inside what looks like a pure-import module.
- **Why it matters:** Side effects on import are notoriously hard to debug. The `contextTarget` state lives in a module variable that is mutated by a globally-registered capture-phase handler. Hot-reload during development will register a second listener on every reload; the listener is never cleaned up.
- **Suggestion:** Move registration into a `registerContextScopeListener()` function called once from `main.tsx`, with the returned cleanup stored for HMR via `import.meta.hot?.dispose(cleanup)`. Or, better — wrap the right-click capture in a React component (`<ContextScopeProvider>`) that uses `useEffect` to install/remove the listener.

---

- **ID:** ⁉️ TASTE-16
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/modals.ts:55-67
- **Issue:** Module-scoped mutable singleton (`let current: ModalRequest | null = null`) with manual `listeners = new Set<Listener>()` re-implementation of a pub-sub. This is a Redux-store / React-context pattern by hand.
- **Why it matters:** Hand-rolled stores are a magnet for races: the `set()` call mutates `current` then fires listeners; if a listener calls back into `requestConfirm()` mid-iteration, you re-enter `set()` while listeners is being iterated. This is exactly the failure mode that battle-tested stores (Zustand, jotai, or just React context) handle correctly.
- **Suggestion:** Use Zustand (or jotai, which is already in this style) for the modal singleton, or move the state into a `<ModalProvider>` React context that wraps `<ModalHost>`. The promise-based API can stay; only the storage changes.

---

- **ID:** ✅ TASTE-17
- **Status:** Fixed — `MonacoCodeEditor.tsx` now `declare global { var MonacoEnvironment: monaco.Environment | undefined; }` using Monaco's own `Environment` type. The double-cast through `unknown` and the hand-rolled `MonacoEnvironmentWorker` interface are gone — a future Monaco upgrade that changes the shape now fails to compile.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeViewer/MonacoCodeEditor.tsx:34-44
- **Issue:** `const win = globalThis as unknown as { MonacoEnvironment?: MonacoEnvironmentWorker; }` — double cast + manual interface duplicating Monaco's worker bootstrap.
- **Why it matters:** Monaco ships its own `MonacoEnvironment` type. Casting `globalThis` through `unknown` plus a hand-written interface duplicates the type and disconnects from upstream changes. If Monaco changes `MonacoEnvironment` shape (e.g. new label), this code won't error.
- **Suggestion:** `import type { MonacoEnvironment } from "monaco-editor";` then `declare global { interface Window { MonacoEnvironment?: MonacoEnvironment; } }`. Direct typed access.

---

- **ID:** ✅ TASTE-18
- **Status:** Fixed — `InlineEdit.tsx` now casts `Tag` through `React.ElementType<React.HTMLAttributes<HTMLElement>>` rather than `any`. Escapes the TS2590 union-complexity limit without dropping HTML attribute typing.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/input/inlineEdit/InlineEdit.tsx:155-161
- **Issue:** `const Component = Tag as any;` — explicit `any` to dodge a TS2590 union-complexity limit, with an inline eslint-disable.
- **Why it matters:** The escape hatch is correct (TS2590 IS a real limit for `keyof JSX.IntrinsicElements`), but the lone `any` is brittle if `Tag` is mistyped or extended. The CLAUDE.md comments hint this is the workaround; the comment is fine but the type isn't preserved.
- **Suggestion:** Cast through `React.ElementType` rather than `any`:
  ```ts
  const Component = Tag as React.ElementType<React.HTMLAttributes<HTMLElement>>;
  ```
  Still escapes TS2590 but keeps the surface typed.

---

- **ID:** ⁉️ TASTE-19
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/scripts/codegen.sh:23-27
- **Issue:** Shells out to a Docker container that just runs `swagger-typescript-api`. Docker isn't required to invoke a JS CLI; this adds ~3-4 seconds of container start per regen.
- **Why it matters:** The author's CLAUDE.md says "Building should always happen in a docker container" — so this matches policy. But for codegen specifically, running through pnpm/npx locally is the canonical TS workflow. The Dockerfile is also a 6-line shell with hard-coded pnpm dependencies; if any of the pinned versions drift, codegen breaks for everyone.
- **Suggestion:** Keep the Docker container path as the build-pipeline canonical, but add a `--local` flag that runs `pnpm dlx swagger-typescript-api@... generate …` directly so developers don't pay container-start cost on every iteration. Or: replace with `openapi-typescript` which is a single npm install, no Docker.

---

- **ID:** ⁉️ TASTE-20
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/vite-plugins/fileIconsVirtual.ts:36-49
- **Issue:** Manual filesystem walk-up to find `vscode-material-icons/generated/icons` — `for (let i = 0; i < 5; i++)` magic number, walking parent dirs manually.
- **Why it matters:** Node's `import.meta.resolve()` or `createRequire(...).resolve('vscode-material-icons/package.json')` give the exact resolution. The walk is fragile (if the package's export map changes, the loop terminates and throws).
- **Suggestion:**
  ```ts
  const findIconsDir = (root: string): string => {
      const requireFn = createRequire(resolve(root, "package.json"));
      const pkgJsonPath = requireFn.resolve("vscode-material-icons/package.json");
      const iconsDir = resolve(dirname(pkgJsonPath), "generated/icons");
      statSync(iconsDir); // throws if missing — explicit error
      return iconsDir;
  };
  ```
  No magic loop counter.

---

- **ID:** ✅ TASTE-21
- **Status:** Fixed alongside REPO-2 in the first fix-batch — `.tmp/` added to `components/react/.gitignore`, the 8 PNGs deleted. `ls components/react/.tmp/` returns "directory does not exist."
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/.tmp/
- **Issue:** 8 PNG screenshots (4-5 MB total) committed in the tree — `debug-thumb.png`, `videoviewer-*.png` etc. These are dev artifacts.
- **Why it matters:** Increases the repo size unnecessarily, pollutes future history with binary churn, and the `.tmp/` name is a contradiction (committed != temporary).
- **Suggestion:** Add `components/react/.tmp/` to `.gitignore` and remove these from the tree. If they're useful examples, move them into `components/react/public/` or co-locate next to the relevant `.test.tsx` as `__fixtures__`.

---

## Findings — Dead code & unused

---

- **ID:** ✅ TASTE-22
- **Status:** Fixed alongside SLOP-2 in the first fix-batch — `detach` field removed from `CreateVmRequest` entirely. `grep "detach" utils/mows-vm-supervisor/src/api/vms.rs` returns 0 matches.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:335
- **Issue:** `let _ = req.detach;` — dead use-discard at the end of `create_vm`. The doc-comment above the field says "Reserved — `detach` is on the CLI side; the API always returns once QEMU is spawned and the readiness probe is in flight."
- **Why it matters:** "Reserved for future use" fields are a maintenance liability. Either the field is part of the public OpenAPI surface (which it is now), or it should be removed. A consumer reading the OpenAPI sees a `detach: bool` they can send; the server silently does nothing with it. That's worse than no field at all.
- **Suggestion:** Either:
  - Remove `detach` from `CreateVmRequest` entirely. (Cleaner — restore when actually needed.)
  - Wire it to actually defer the readiness probe.
  Don't ship a no-op field.

---

- **ID:** ✅ TASTE-23
- **Status:** Fixed — `prepare_vm_dir` signature trimmed to `(spec: &VmLaunchSpec)`; the `let _ = cfg;` no-op is gone. Single caller in `api/vms.rs` updated.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:258
- **Issue:** `let _ = cfg;` after the function body. The function signature accepts `cfg: &SupervisorConfig` but never reads it.
- **Why it matters:** Either remove the parameter or actually use it. The `let _ = cfg;` is a Rust-idiomatic way to silence the unused warning, but a maintainer-honest fix is to remove the unused arg from the signature (caller is in the same crate).
- **Suggestion:** Drop `cfg: &SupervisorConfig` from `prepare_vm_dir` and from every caller. If a future change adds back the need, restoring it is one keystroke.

---

- **ID:** ✅ TASTE-24
- **Status:** Fixed — Both sites in `api/vms.rs` (`get_vm_display`, `get_vm_console`) drop the `let _ =` wrapper. The bare `load_vm(&state, &id).await?;` now reads as the side-effect-only call it is, with a comment explaining intent.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:539,557
- **Issue:** `let _ = load_vm(&state, &id).await?;` — discarding the loaded value while still propagating errors. The intent is "verify the VM exists." That's better expressed.
- **Why it matters:** `let _ = expr?;` reads as "I tried something but ignored the result," when in fact we're using the function call for its side effect (membership check). The convention is `_ = load_vm(...).await?` or, better, an explicit `ensure_exists(state, id).await?`.
- **Suggestion:** Either remove the `let` (`load_vm(&state, &id).await?;`) or factor an explicit `ensure_vm_exists(state: &SharedState, id: &str) -> Result<()>` that returns `Result<()>` to make the side-effect-only call self-documenting.

---

- **ID:** ✅ TASTE-25
- **Status:** Fixed — Same pattern in `api/agents.rs::get_agent_io` rewritten the same way as TASTE-24.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:358
- **Issue:** Same pattern: `let _ = load_agent(&state, &id).await?;`.
- **Why it matters:** Same as TASTE-24.
- **Suggestion:** Same fix.

---

- **ID:** ✅ TASTE-26
- **Status:** Fixed — `ExampleCard.test.tsx::StatefulExample`'s `[n, setN]` renamed to `[iterationCount, setIterationCount]`; the updater function's `(v) => v + 1` is now `(current) => current + 1`. The `useExampleState({ n: iterationCount })` call keeps the `n` key so the existing test assertions on the serialized state still match.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/ExampleCard.tsx:43
- **Issue:** `setN((v) => v + 1)` in the test. Both abbreviations.
- **Why it matters:** Tests are still code; they get read more than they get written. (Not a critical naming violation since it's a test file, but flagging for consistency.)
- **Suggestion:** `setIterationCount((current) => current + 1)`.

---

- **ID:** ✅ TASTE-27
- **Status:** Fixed — Stale "Atoms reorganized 2026-05-12" comment is no longer at the top of `components/react/lib/main.ts` (first line is now the `ActionDisplay` re-export). Removed alongside the previous main.ts audit pass.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/main.ts:1-2
- **Issue:** Top-of-file comment `// Atoms reorganized 2026-05-12: components are now grouped by purpose / instead of one flat `atoms/` bucket. See CLAUDE.md for the taxonomy.`
- **Why it matters:** This comment is a one-time historical note that adds no value to a reader at HEAD+1. Migration notes belong in commit messages / CHANGELOG, not in source headers.
- **Suggestion:** Delete the comment. The taxonomy is documented in CLAUDE.md anyway, and the file's grouped structure is self-evident.

---

- **ID:** ✅ TASTE-28
- **Status:** Fixed — `MowsContext.tsx` imports `Action` at the top via `import { type Action, ActionManager } from "./ActionManager";` and uses bare `Action[]`. The `// eslint-disable-next-line quotes` workaround is gone.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/lib/mowsContext/MowsContext.tsx:95-96
- **Issue:** `// eslint-disable-next-line quotes` + `readonly extraActions: import("./ActionManager").Action[];` — using an inline type import to dodge an ESLint quotes rule.
- **Why it matters:** The ESLint rule is presumably "use backticks for strings"; the dynamic-import-as-type uses double quotes legitimately. The disable is a one-off workaround; the fix is to import `Action` at the top of the file.
- **Suggestion:** Move `import { type Action } from "./ActionManager";` to the imports and use `readonly extraActions: Action[];` — no comment-disable needed.

---

- **ID:** ✅ TASTE-29
- **Status:** Fixed — Second occurrence rewritten the same way as TASTE-28; no `// eslint-disable-next-line quotes` left in MowsContext.tsx.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/lib/mowsContext/MowsContext.tsx:407-408
- **Issue:** Same `// eslint-disable-next-line quotes` pattern repeated.
- **Why it matters:** Same.
- **Suggestion:** Same.

---

- **ID:** ✅ TASTE-30
- **Status:** Fixed — Swept `.find((e) => e.id === id)` → `.find((example) => example.id === id)` across all 68 `src/examples/<component>/index.ts` registry helpers (mechanical sed replacement, verified zero remaining matches). 1489 React tests still pass.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/src/examples/steps/index.ts:31
- **Issue:** `stepsExamples.find((e) => e.id === id)` — single-letter `e` for an item type whose name is right there (`example` or `registeredExample`).
- **Why it matters:** Naming.
- **Suggestion:** `stepsExamples.find((example) => example.id === id)`.

---

- **ID:** ✅ TASTE-31
- **Status:** Fixed — Renamed all single-letter names in `Image360Viewer.handleMarkerSelect`/`handlePosition`/`componentDidUpdate`: `cb` → `onMarkerClick`/`onHeadingChange`, `e` → `event`, `deg` → `degrees`, `prev` → `previousProps`.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/Image360Viewer.tsx:141-149
- **Issue:** `const cb = this.props.onMarkerClick;` — `cb` is on the BAD-abbreviation list in the review brief.
- **Why it matters:** Naming.
- **Suggestion:** `const callback = this.props.onMarkerClick;` (or just inline the prop access).

---

## Findings — Naming conventions

---

- **ID:** ⁉️ TASTE-32
- **Status:** Deferred — `ctx` → `mowsContext`/`context` rename across 267+ sites (verified via `grep -rn "\bctx\b" lib/ src/`). Mechanical but spans hundreds of files; the regression risk is non-trivial because `ctx` is overloaded in places (`canvas2dContext`, `audioContext`, etc.) where the wholesale rename would create false matches. Wants its own focused branch with a careful regex + manual review of each match.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/ (267 occurrences)
- **Issue:** `ctx` used pervasively throughout the library for `MowsContext` instances. Example: `const ctx = useMows();` followed by `ctx?.t.expandableCode`. Hit-count: 267 occurrences in `lib/` and `src/`.
- **Why it matters:** This is the single biggest naming violation in the change set. The user's CLAUDE.md is unambiguous about long descriptive names. Every reader, every PR comment, has to mentally expand `ctx` to "context." Multiplied across 267 sites, that's a real cognitive tax.
- **Suggestion:** Project-wide rename `ctx` → `mowsContext` (or `context` where unambiguous). For class components: `const context = this.context!;`. For function components: `const mowsContext = useMows();`. The user already memory-flagged this in similar ways.

---

- **ID:** ✅ TASTE-33
- **Status:** Fixed — `cfg` → `config` across the supervisor's Rust crate. Affected sites: `main.rs::--print-default-config` (1 site), `config.rs::load` (4 sites), `qemu.rs::QemuInvocation::build` parameter + body (4 sites), `qemu.rs::locate_image` parameter (1 site), `qemu.rs` tests (12 sites). `#[cfg(unix)]`/`#[cfg(test)]` attribute macros are NOT renamed — they're Rust syntax, not abbreviations. `cargo check --tests` clean; 29 unit tests pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:62,173,218,272 + 28 occurrences across the supervisor
- **Issue:** `cfg: &SupervisorConfig` parameter names. The function reads `cfg.qemu_binary`, `cfg.image_dir`, etc.
- **Why it matters:** Same rule on the Rust side. `cfg` is ubiquitous in Rust but not on the user's OK list.
- **Suggestion:** Rename to `config` everywhere — `pub fn build(config: &SupervisorConfig, …)` etc. Rust is fine with this; nothing prevents it.

---

- **ID:** ✅ TASTE-34
- **Status:** Fixed — `req` → `request` and `res` → `query_result` in every supervisor HTTP handler body. Renames: `users.rs::create_user`, `agents.rs::create_agent` + `update_agent` + `delete_agent` + `update_vm`, `vms.rs::create_vm` + `update_vm` + `delete_vm` + `stop_vm`, `auth.rs::login`. `auth_middleware.rs`'s `req: Request` parameter is intentionally NOT renamed — that's the axum middleware convention and matches every public middleware example. `cargo check --tests` clean; 29 unit tests pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/{vms,agents,users,auth}.rs (every handler)
- **Issue:** `Json(req): Json<CreateVmRequest>` — `req` everywhere for the request body parameter, plus `res` for the SQLx `query` result everywhere (e.g. `let res = sqlx::query(...).execute(...).await?;`).
- **Why it matters:** `req` and `res` are explicitly on the BAD list in the review brief. There are dozens of occurrences across the four route files.
- **Suggestion:**
  - `Json(req): Json<CreateVmRequest>` → `Json(request): Json<CreateVmRequest>`
  - `let res = sqlx::query(...).execute(...).await?;` → `let result = sqlx::query(...).execute(...).await?;` (or better, `query_result` to disambiguate from API response).

---

- **ID:** ✅ TASTE-35
- **Status:** Fixed — `Sidebar.tsx`'s create-VM header action now uses `createVmPayload: CreateVmRequest` instead of `req: CreateVmRequest`. All 5 `req.*` field assignments + the `createVm(req)` call are renamed. `npx tsc --noEmit` clean.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/Sidebar.tsx:228-237
- **Issue:** `const req: CreateVmRequest = {…}; req.name = …; req.cpus = …; createVm(req)` — five `req` references in 9 lines.
- **Why it matters:** Same rule.
- **Suggestion:** Rename to `request` or `createVmPayload`.

---

- **ID:** ✅ TASTE-36
- **Status:** Fixed — `ModalHost.tsx`'s 15 `req`/`setReq` references → `activeRequest`/`setActiveRequest`. Subscribe call, effect deps, kind discriminators, resolve calls, title/description/placeholder/cancelLabel/confirmLabel/danger reads — all switched. `npx tsc --noEmit` clean.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/ModalHost.tsx:41-87 (15 uses)
- **Issue:** `const [req, setReq] = useState<ModalRequest | null>(getCurrentModal());` — `req` is the local state, used 15 times below.
- **Why it matters:** Same rule.
- **Suggestion:** `const [activeRequest, setActiveRequest] = useState<…>(getCurrentModal());`.

---

- **ID:** ✅ TASTE-37
- **Status:** Fixed — `web/src/lib/api.ts` renames: `unwrap = async <T>(p: Promise<...>)` → `promise`; `createVm = (req: ... = {})` → `request`; `describeApiError = (e: unknown)` → `error`, plus the body's `msg` → `message`. `npx tsc --noEmit` clean.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/api.ts:47,50,70
- **Issue:** `const unwrap = async <T>(p: Promise<{data: T}>): Promise<T>` — `p` is single-letter. Also `createVm = (req: …)` and the `describeApiError` parameter `e` is single-letter.
- **Why it matters:** Naming.
- **Suggestion:** `p` → `promise`, `req` → `request`, `e` → `error` (`describeApiError = (error: unknown)`).

---

- **ID:** ✅ TASTE-38
- **Status:** Fixed — `frameGrabber.ts` renamed: `v` → `videoElement` (every site), `vw`/`vh` → `sourceWidth`/`sourceHeight`, `dw`/`dh` → `destinationWidth`/`destinationHeight`, `dx`/`dy` → `destinationX`/`destinationY`, the `find((c) => …)` callback's `c` → `entry`. The arithmetic in the letterbox + `drawImage` call now reads as English instead of cipher. 39 videoViewer tests pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/videoViewer/frameGrabber.ts
- **Issue:** Multiple single-letter and abbreviated names: `private ctx`, local `v` (line 68, 95, 112, 146), `vw`, `vh`, `dw`, `dh`, `dx`, `dy`. Pure abbreviation farm.
- **Why it matters:** Naming. Code is unreadable without scrolling back to definitions. `vw` could be `videoWidth`, `dx` could be `destinationX`. The arithmetic on lines 150-158 is exactly the kind of dense math that benefits most from full names.
- **Suggestion:**
  ```ts
  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;
  const scale = Math.min(PREVIEW_WIDTH / sourceWidth, PREVIEW_HEIGHT / sourceHeight);
  const destinationWidth = sourceWidth * scale;
  const destinationHeight = sourceHeight * scale;
  const destinationX = (PREVIEW_WIDTH - destinationWidth) / 2;
  const destinationY = (PREVIEW_HEIGHT - destinationHeight) / 2;
  ```

---

- **ID:** ✅ TASTE-39
- **Status:** Fixed — `keyboard.ts::resolveVideoKeyAction(e)` → `(event)`, with `e.metaKey`/`e.ctrlKey`/`e.altKey`/`e.key` updated. `formatTimestamp` body renamed: `total` → `totalSeconds`, `h`/`m`/`s` → `hours`/`minutes`/`remainingSeconds`, `mm`/`ss` → `minutesText`/`secondsText`. 39 videoViewer tests pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/videoViewer/keyboard.ts:26,68-77
- **Issue:** `(e: KeyBindingInput)` — `e` for the event-shape parameter. Also `formatTimestamp` uses single-letter `h`, `m`, `s`, `mm`, `ss`.
- **Why it matters:** Naming. `formatTimestamp` is exported — readers will see this in their IDE.
- **Suggestion:**
  ```ts
  export const resolveVideoKeyAction = (event: KeyBindingInput): VideoKeyAction | null => { … }

  export const formatTimestamp = (seconds: number): string => {
      // …
      const totalSeconds = Math.floor(seconds);
      const hours = Math.floor(totalSeconds / SECONDS_IN_HOUR);
      const minutes = Math.floor((totalSeconds % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE);
      const remainingSeconds = totalSeconds % SECONDS_IN_MINUTE;
      // …
  }
  ```

---

- **ID:** ✅ TASTE-40
- **Status:** Fixed — `recentCommands.filter((cmd) => ...)` → `(command) => command.actionId !== action.id` in `ActionManager.tsx`.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/lib/mowsContext/ActionManager.tsx:218
- **Issue:** `recentCommands.filter((cmd) => cmd.actionId !== action.id)` — `cmd` is one of the explicitly banned abbreviations in the review brief ("`cb` → `callback`"; same family: `cmd` → `command`).
- **Why it matters:** Naming.
- **Suggestion:** `recentCommands.filter((command) => command.actionId !== action.id)`.

---

- **ID:** ⁉️ TASTE-41
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/input/inlineEdit/InlineEdit.tsx:79-152 (12 occurrences)
- **Issue:** `const el = ref.current;` repeated everywhere. The `el` shorthand appears 12 times in this file alone.
- **Why it matters:** Naming. `el` is an explicit BAD-list abbreviation.
- **Suggestion:** Rename to `element` (or `editorElement` if you want to disambiguate from the affordance buttons).

---

- **ID:** ⁉️ TASTE-42
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/actions.ts:64-86,151
- **Issue:** `const el = (event.target as HTMLElement | null)?.closest?.("[data-actionscope]")` — `el` again. Also `fn` for the listener callback (line 60).
- **Why it matters:** Naming.
- **Suggestion:** `const element = …`. `fn` → `listener` (or `callback`).

---

- **ID:** ⁉️ TASTE-43
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/docPage/renderInlineMarkup.tsx:44-58
- **Issue:** `const out: React.ReactNode[] = []; let lastIndex = 0; let i = 0; const re = new RegExp(...);` — three single-letter / abbreviated names in one function.
- **Why it matters:** Naming.
- **Suggestion:** `out` → `output` (or `result`), `i` → `keyCounter`, `re` → `regex`.

---

- **ID:** ✅ TASTE-44
- **Status:** Fixed — `ManualStepProps.n` renamed to `stepNumber`; 205 `<ManualStep n={...}>` call sites across the example DocPages migrated via sed. Comment in `ManualSteps.tsx` updated to match.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/docPage/ManualSteps.tsx:5,15
- **Issue:** `interface ManualStepProps { readonly n: number; … }` — `n` for "step number." Single letter.
- **Why it matters:** Naming. The prop is part of the public API and IDE tooltips will surface `n`.
- **Suggestion:** Rename to `stepNumber` (or `number` if uniqueness isn't required). Adjust call sites.

---

- **ID:** ⁉️ TASTE-45
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeViewer/MonacoCodeEditor.tsx:68-86,89,107
- **Issue:** `const monacoLanguageFor = (lang: CodeViewerProps[…])` (`lang` everywhere in the switch). Also `const ctx = useMows();` (TASTE-32 instance), and `o` inside the cast on line 55.
- **Why it matters:** Naming.
- **Suggestion:** `lang` → `language`, `o` → `options` (or remove the cast per TASTE-10).

---

- **ID:** ⁉️ TASTE-46
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:110-131,134-141
- **Issue:** `vm`, `mows`, `e`, `h` (setInterval handle). Lots of single-letter variables: `const vmRes = await api.v1.getVm(id)`, `const h = window.setInterval(…)`, `} catch (e) {`.
- **Why it matters:** Naming.
- **Suggestion:** `vmRes` → `vmResponse`, `h` → `intervalHandle`, `e` → `error`, `mows` → `mowsContext`.

---

- **ID:** ✅ TASTE-47
- **Status:** Fixed alongside TASTE-31.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/Image360Viewer.tsx:141-154
- **Issue:** `const cb = this.props.onMarkerClick; const deg = ((e.position.yaw * 180) / Math.PI) % 360;` — `cb`, `e`, `deg`.
- **Why it matters:** Naming.
- **Suggestion:** `cb` → `markerClickHandler`, `e` → `event`, `deg` → `degrees`.

---

- **ID:** ⁉️ TASTE-48
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/VideoViewer.tsx:32,442,452-456 (and many more)
- **Issue:** `const clampVolume = (v: number)` (`v` for value), `const v = this.videoRef.current`, `const ctx = this.liveCaptureCtx`, plus `dw`/`dh` arithmetic locals.
- **Why it matters:** Naming. The file is 852 lines; every `v`/`ctx` adds cognitive load.
- **Suggestion:** Same canonical rename: `v` → `videoElement`, `ctx` → `context2d`/`canvasContext`, `dw`/`dh` → `destinationWidth`/`destinationHeight`.

---

- **ID:** ✅ TASTE-49
- **Status:** Fixed — `props.themes.find((t) => ...)` → `(theme) => theme.id === ...` and same for `codeThemes` → `(codeTheme) => codeTheme.id === ...`. No more shadowing of the `t` translation symbol.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/lib/mowsContext/MowsContext.tsx:189-200
- **Issue:** `(t) => t.id === currentThemeId` — single-letter `t` for "theme" inside a `.find` callback. Same on line 200 for code theme.
- **Why it matters:** Naming. The variable shadows the `t` translation symbol elsewhere in the file, increasing ambiguity.
- **Suggestion:** `(theme) => theme.id === currentThemeId`.

---

- **ID:** ✅ TASTE-50
- **Status:** Fixed — `FileIcon.componentDidUpdate` parameter renamed `prev` → `previousProps`.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileIcon/FileIcon.tsx:37
- **Issue:** `componentDidUpdate = (prev: FileIconProps) => {` — `prev` is on the BAD list.
- **Why it matters:** Naming.
- **Suggestion:** `(previousProps: FileIconProps) =>`.

---

- **ID:** ⁉️ TASTE-51
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/vite-plugins/fileIconsVirtual.ts:21,31,38,42,46,56,58
- **Issue:** `const req = createRequire(...)`, `(f) => f.endsWith(".svg")`, `let dir = dirname(entry); for (let i = 0; i < 5; i++) { …`.
- **Why it matters:** Naming.
- **Suggestion:** `req` → `requireFn` (already named `requireFn` in the suggestion above), `f` → `file`, `dir` → `currentDirectory`, `i` removed via TASTE-20 rewrite.

---

- **ID:** ⁉️ TASTE-52
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/cleanExampleSource.ts:18-39,46-83
- **Issue:** `const netParenDelta = (line: string) => { let depth = 0; let i = 0; …` — single-letter `i`. Also `(c) =>` style callbacks in this file.
- **Why it matters:** Naming.
- **Suggestion:** `i` → `index`.

---

- **ID:** ⁉️ TASTE-53
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeSnippet/MonacoColorizer.tsx:86-87
- **Issue:** `const ctx = useMows();` (TASTE-32 instance).
- **Why it matters:** Naming.
- **Suggestion:** Project-wide rename per TASTE-32.

---

- **ID:** ⁉️ TASTE-54
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/CommandBlock.tsx:11-12,20-25,48-49,72-79
- **Issue:** Type alias `type PackageManager = (typeof PACKAGE_MANAGERS)[number];` is fine, but the local variable is `pm`/`setPm`: `const [pm, setPm] = React.useState<PackageManager>(`pnpm`);`. Also `(p) => …`. `pm` is on the BAD list.
- **Why it matters:** Naming. The whole point of `PackageManager` as a type is then dropped to `pm`.
- **Suggestion:** `const [packageManager, setPackageManager] = React.useState<PackageManager>("pnpm");` and `(packageManager) => …`.

---

- **ID:** ⁉️ TASTE-55
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/Image360Viewer.tsx:91,156
- **Issue:** Local vars `minFov`, `maxFov`, `defaultZoomLvl`. The first two pass-through props match the upstream API but `defaultZoomLvl` (line 30, 96) uses the abbreviation `Lvl` rather than `Level`.
- **Why it matters:** Half-naming: `defaultZoomLvl` is also the prop name on the public API surface (line 30). That's a public-API naming bug, not just an internal one. Photo Sphere Viewer's own API is `defaultZoomLvl` so changing it might be confusing, but a wrapper library's job is to give CLEANER names than the wrapped library.
- **Suggestion:** Rename the prop to `defaultZoomLevel`. The internal local then becomes `defaultZoomLevel`.

---

- **ID:** ✅ TASTE-56
- **Status:** Fixed — `langBadge` renamed to `languageBadge` in `Translation`, en-US, de. No external consumers (verified via grep), so the rename is purely internal.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/src/languages.ts:16, /home/paul/projects/mows/components/react/src/languages/en-US.ts:19, /home/paul/projects/mows/components/react/src/languages/de.ts:19
- **Issue:** `langBadge: string;` translation key. `lang` is on the BAD list, and this is a public translation key — consumers extending the translation interface will have to type `lang` forever.
- **Why it matters:** Naming + the key bleeds into every consumer's translation overlay.
- **Suggestion:** `languageBadge: string;`.

---

- **ID:** ✅ TASTE-57
- **Status:** Fixed — `Action` constructor uses `??` instead of `||` for the three default assignments.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/lib/mowsContext/ActionManager.tsx:30-43
- **Issue:** Class properties `params.actionHandlers || new Map()`, `params.hideInCommandPalette || false`. Using `||` for default values flattens `false` to `false` (correct here, but defensive `??` is more honest).
- **Why it matters:** Minor; `||` works for booleans here, but consistency with `??` reads more carefully.
- **Suggestion:** `params.actionHandlers ?? new Map()`, `params.hideInCommandPalette ?? false`.

---

- **ID:** ⁉️ TASTE-58
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:68-79
- **Issue:** The `creds_host_path` env-fallback chain is OK but uses `let p = PathBuf::from(...)` and `.filter(|p| p.exists())` — two distinct `p` bindings in one expression.
- **Why it matters:** Mild readability issue; both `p` shadow each other implicitly.
- **Suggestion:** `let candidate = PathBuf::from("/host-creds"); if candidate.exists() { Some(candidate) } else { None }` — and rename the filter's binding to `path`.

---

- **ID:** ⁉️ TASTE-59
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/code/expandableCode/ExpandableCode.tsx:40-41,50-59
- **Issue:** `const ctx = useMows(); const labels = ctx?.t.expandableCode;` plus `const el = innerRef.current;`.
- **Why it matters:** Naming, see TASTE-32 and TASTE-41.
- **Suggestion:** Same canonical rename.

---

- **ID:** ⁉️ TASTE-60
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/actions/keyComboRecorder/KeyComboRecorder.tsx:38-42
- **Issue:** Same `const ctx = useContext(MowsContext);` pattern.
- **Why it matters:** Naming.
- **Suggestion:** Same canonical rename.

---

- **ID:** ⁉️ TASTE-61
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/appShell/primaryMenu/PrimaryMenu.tsx:123-126,354,363
- **Issue:** `const ctx = this.context!;` then 4 further uses of `ctx`.
- **Why it matters:** Naming.
- **Suggestion:** `const context = this.context!;` (the class already declares `declare context: …`).

---

- **ID:** ⁉️ TASTE-62
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/Sidebar.tsx:70-102
- **Issue:** `useLivePoll = <T,>(fetcher: …) => { … }` — `const refresh = async () => { try {…} catch (e) {…} }; const tick = async () => {…};`. `e` for error.
- **Why it matters:** Naming.
- **Suggestion:** `catch (error)`.

---

- **ID:** ⁉️ TASTE-63
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/modals.ts:53,58,65
- **Issue:** `type Listener = (r: ModalRequest | null) => void;` (`r`), then `const set = (r: ModalRequest | null) => …` and `subscribeModal = (fn: Listener)` (`fn`).
- **Why it matters:** Naming.
- **Suggestion:** `r` → `request`, `fn` → `listener`.

---

- **ID:** ⁉️ TASTE-64
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/src/App.tsx:113,117
- **Issue:** `demos.find((d) => d.name.toLowerCase() === lower)`, `demos.find((d) => d.id === id)`.
- **Why it matters:** `d` is a single letter shadowing the `DemoEntry` type. Public callback parameter (since the file is on the App level).
- **Suggestion:** `demos.find((demo) => demo.name.toLowerCase() === lower)`.

---

- **ID:** ⁉️ TASTE-65
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/src/App.tsx:262
- **Issue:** `onClick={(e) => { if (e.metaKey || …)`.
- **Why it matters:** Naming.
- **Suggestion:** `onClick={(event) => …`.

---

- **ID:** ⁉️ TASTE-66
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/Image360Viewer.tsx:101
- **Issue:** `const initialMarkers = this.props.markers ? (this.props.markers as MarkerConfig[]) : [];`
- **Why it matters:** The cast is unnecessary; `MarkerConfig[]` is the same as `ReadonlyArray<Image360ViewerMarker>`. The cast hides a type mismatch (mutable vs readonly).
- **Suggestion:** `const initialMarkers: MarkerConfig[] = this.props.markers ? [...this.props.markers] : [];` — explicit copy that converts readonly to mutable.

---

- **ID:** ✅ TASTE-67
- **Status:** Fixed — `NumberInput::clamp` now uses `Math.max(value, min)` + `Math.min(...)` instead of mutating a local. Pure expression; no `v` shorthand.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/input/numberInput/NumberInput.tsx:27-36
- **Issue:** `clamp` function uses `let v = value; if (...) v = min; ...; return v;` — mutating a local. Could be expressed as `Math.max(min, Math.min(max, value))` or chained `clamp` syntax.
- **Why it matters:** Mutable local for what should be a pure function. `Math.min`/`Math.max` express the same thing as a single expression. Also `v` is single-letter (TASTE-48 family).
- **Suggestion:** 
  ```ts
  const clamp = (value: number, min: number | undefined, max: number | undefined): number => {
      const minBounded = typeof min === "number" ? Math.max(value, min) : value;
      return typeof max === "number" ? Math.min(minBounded, max) : minBounded;
  };
  ```

---

- **ID:** ✅ TASTE-68
- **Status:** Fixed — `generate_token()` uses `token_bytes` instead of `buf`.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/auth.rs:78-83
- **Issue:** `fn generate_token() -> String { use rand::RngCore; let mut buf = [0u8; 32]; rand::rng().fill_bytes(&mut buf); base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf) }` — `buf` is single-letter-family.
- **Why it matters:** Naming.
- **Suggestion:** `buf` → `token_bytes`.

---

- **ID:** ✅ TASTE-69
- **Status:** Fixed — `vms.rs::proxy_websocket_to_unix_socket_with_replay::to_ws` renamed `buf`→`read_buffer`, `n`→`bytes_read`, `r`→`result`.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:632,652
- **Issue:** `let mut buf = vec![0u8; 8192];` — `buf` in both proxy loops.
- **Why it matters:** Naming.
- **Suggestion:** `buf` → `read_buffer`.

---

- **ID:** ✅ TASTE-70
- **Status:** Fixed — `agents.rs::ssh_to_ws` renamed `buf`→`read_buffer`, `n`→`bytes_read`. Same pattern as TASTE-69.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:434
- **Issue:** `let mut buf = vec![0u8; 8192];` — same.
- **Why it matters:** Naming.
- **Suggestion:** Same.

---

- **ID:** ✅ TASTE-71
- **Status:** Fixed — `agents.rs::get_agent_io` site renamed `(a, b)` → `(ws_to_ssh_result, ssh_to_ws_result)` to mirror the joined tasks. (The `vms.rs` site is in the WS proxy `proxy_websocket_to_unix_socket_with_replay` which was already restructured under SECURITY-10 — handled there.)
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:673,452
- **Issue:** `let (a, b) = tokio::join!(to_ws, to_unix); a?; b?;` and same in agents.rs:452.
- **Why it matters:** `a`/`b` are anonymous, but here they correspond to the named tasks `to_ws` and `to_unix`. Two-letter aliases obscure that.
- **Suggestion:**
  ```rust
  let (ws_result, unix_result) = tokio::join!(to_ws, to_unix);
  ws_result?;
  unix_result?;
  ```

---

- **ID:** ✅ TASTE-72
- **Status:** Fixed — All 3 sites in `api/vms.rs` renamed `let mut reg = state.vms.write().await; reg.insert/.remove(...)` → `let mut registry = ...; registry.insert/.remove(...)`. 29 unit + 15 e2e tests still pass.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:298-299, 437
- **Issue:** `let mut reg = state.vms.write().await; reg.insert(id.clone(), child);` — `reg` for registry.
- **Why it matters:** Naming.
- **Suggestion:** `let mut registry = state.vms.write().await; registry.insert(...);`.

---

- **ID:** ⁉️ TASTE-73
- **Status:** Accepted — `pid` is a process-identifier term-of-art (Unix universal), explicitly suggested as fine. No code change.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:294-295
- **Issue:** `let child = spawn_qemu(&invocation).await?; let pid = child.id();` — fine, but `pid` is a Unix abbreviation. Acceptable on the OK list (`id`, `pid`).
- **Why it matters:** Borderline. `pid` is universally understood in systems code; flagging as a Minor since the brief calls for ruthlessness.
- **Suggestion:** Leave `pid` as-is — it's a process identifier-of-art, like `tcp` or `url`.

---

- **ID:** ⁉️ TASTE-74
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/serializeState.ts:17
- **Issue:** `JSON.stringify(state, (_key, value) => {…}, 2)` — `_key` is the leading underscore to indicate "unused." Fine, but the implicit deference to the JSON.stringify replacer signature shows up everywhere; the param is unused but reading `_key` for that takes a beat.
- **Why it matters:** Minor.
- **Suggestion:** No change needed; `_key` is canonical. Flagging only because the brief asked for ruthlessness.

---

- **ID:** ⁉️ TASTE-75
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/videoViewer/frameGrabber.ts:54-57
- **Issue:** `this.cache.find((c) => Math.abs(c.time - time) < 0.4)` — `c` single-letter.
- **Why it matters:** Naming.
- **Suggestion:** `this.cache.find((entry) => Math.abs(entry.time - time) < 0.4)`.

---

- **ID:** ⁉️ TASTE-76
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/actions.ts:60-61
- **Issue:** `const fireRefresh = () => { refreshListeners.forEach((fn) => fn()); };` — `fn` is a banned abbreviation.
- **Why it matters:** Naming.
- **Suggestion:** `refreshListeners.forEach((listener) => listener());`.

---

- **ID:** ⁉️ TASTE-77
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/src/examples/harness/useExampleState.tsx:23-43
- **Issue:** `useExampleState = (state: unknown): void => { const onChange = …; const serialized = … }` — fine, but the second `useMemo` block embeds a comment "// serialize key only — the real serialization for display happens later via serializeState()." Comment is good (WHY), but the call also uses `JSON.stringify` for a fallback that can produce different output on circular refs (silently throws → catch returns `Math.random().toString()`).
- **Why it matters:** See TASTE-12.
- **Suggestion:** Covered by TASTE-12.

---

- **ID:** ⁉️ TASTE-78
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:232-235
- **Issue:** `let cwd_basename = req.cwd.as_deref().and_then(|p| {std::path::Path::new(p).file_name().map(|s| s.to_string_lossy().into_owned())});` — `p` and `s` are single-letter.
- **Why it matters:** Naming.
- **Suggestion:** `|cwd| { std::path::Path::new(cwd).file_name().map(|name| name.to_string_lossy().into_owned()) }`.

---

## Findings — Comments

---

- **ID:** ⁉️ TASTE-79
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/main.ts:1-2
- **Issue:** Migration history note at top of file (covered also in TASTE-27).
- **Why it matters:** History note that has no use to a current reader.
- **Suggestion:** Delete.

---

- **ID:** ⁉️ TASTE-80
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeSnippet/CodeSnippet.md (and similar `.md` files)
- **Issue:** Each component ships a long `.md` file. These are great for the docs harness (CLAUDE.md says "The examples in the `.md` are the same examples that live in `src/examples/...`"), but doc-page narrative duplicates the doc-page TSX. Two sources of truth.
- **Why it matters:** Whichever drifts wins. The CLAUDE.md acknowledges this trade-off ("you can copy the body directly — keep them in sync") but it's a structural issue worth calling out.
- **Suggestion:** Consider generating the `.md` from the doc page TSX at build time (e.g., a Vite plugin that walks `<ExpandableCode>` snippets and writes a `.md`), so the `.md` is downstream of the TSX. Or skip the `.md` entirely and just point CLAUDE.md / IDE-readers at the doc-page TSX file directly.

---

- **ID:** ⁉️ TASTE-81
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileIcon/FileIcon.tsx:7-16
- **Issue:** 10-line block comment explaining what `virtual:mows-file-icons` is and how it works. This belongs in the plugin file itself (and it's already there).
- **Why it matters:** Duplication. The reader of `FileIcon.tsx` only needs to know the import exists; the architectural rationale is in `vite-plugins/fileIconsVirtual.ts`. Now they're in two places, and one will rot.
- **Suggestion:** Replace with a one-liner: `// See vite-plugins/fileIconsVirtual.ts for why this is a virtual module.`

---

- **ID:** ⁉️ TASTE-82
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeViewer/CodeViewer.tsx:6-12
- **Issue:** 6-line WHY comment about preloading the highlighter — fine, WHY content, keep. But the eager `void getShikiHighlighter();` at line 12 is the actual operation, restated by the comment around it. The trailing "By the time `<Editor>` mounts the highlighter is hot…" is the WHY and is good. The first sentence "Kick off the shiki highlighter at module-eval time" restates `void getShikiHighlighter();`.
- **Why it matters:** Mixed restate + WHY.
- **Suggestion:** Trim the first sentence; lead with the WHY:
  ```ts
  // `CodeViewer` is in the eager bundle (every doc page imports it), so kick
  // off the shiki highlighter at module-eval time. The JS regex engine and
  // grammar JSON chunks then download in parallel with the lazy
  // `MonacoCodeEditor` chunk, and by the time the editor mounts the
  // highlighter is hot — first paint is correctly tokenized.
  void getShikiHighlighter();
  ```

---

- **ID:** ⁉️ TASTE-83
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:217
- **Issue:** Doc-comment `/// Prepare per-VM state directory: writes the run.yaml seed and creates a / fresh qcow2 overlay over the cached image. Idempotent.` is good. But function body line 258 `let _ = cfg;` (covered in TASTE-23) implicitly says "unused arg" — the doc-comment promises behavior but the unused arg signals dead code.
- **Why it matters:** Doc-comment vs. code inconsistency.
- **Suggestion:** Per TASTE-23, drop the unused `cfg` parameter. Then the doc-comment matches.

---

- **ID:** ⁉️ TASTE-84
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/users.rs:27-29
- **Issue:** `fn default_role() -> String { "user".into() }` — function body restates the function name. The two-line function plus its `#[serde(default = "default_role")]` site is fine, but this is the kind of micro-function that can be inlined.
- **Why it matters:** Tiny indirection.
- **Suggestion:** Inline `#[serde(default)]` with `Default::default()` if `String` defaults to `""` (which is not "user"), or keep as-is. If kept, no comment is needed — the name is the doc.

---

- **ID:** ⁉️ TASTE-85
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/VideoViewer.tsx:39-51
- **Issue:** `const initialStatus = (): PlayerStatus => ({playing: false, …});` — function name is `initialStatus`; the body is the literal default. The function exists to centralize the "initial PlayerStatus" shape; no comment is needed and there is none. Fine — flagging for completeness.
- **Why it matters:** No comment problem here; just noting the pattern. Reviewer found no offense.
- **Suggestion:** No change.

---

- **ID:** ⁉️ TASTE-86
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/lib/mowsContext/MowsContext.tsx:131-134
- **Issue:** `log.warn("Failed to parse stored code editor settings; reverting to defaults", error); return defaultCodeEditorSettings;` — the `log.warn` message restates the function name (`readCodeEditorSettings`). Mild duplication.
- **Why it matters:** Minor.
- **Suggestion:** Keep — the log message helps debugging in production logs. Even if it duplicates source line context, log messages should be self-contained.

---

- **ID:** ⁉️ TASTE-87
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeViewer/MonacoCodeEditor.tsx:46-67
- **Issue:** 22-line block comment + code about "JS/TS/HTML/CSS language services needlessly run validation that requires `unsafe-eval` and a heavy worker…" — substantial WHY content, keep. Just noting it's a long comment but earns its keep.
- **Why it matters:** No issue.
- **Suggestion:** No change.

---

## Findings — Dependency security (CVEs)

---

- **ID:** ⁉️ TASTE-88
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/package.json (transitive via `monaco-editor@0.55.1`)
- **Issue:** `monaco-editor@0.55.1` pulls in `dompurify@3.2.7` which has 8 moderate-severity advisories (GHSA-v2wj-7wpq-c8vv, GHSA-cjmm-f4jc-qw8r, GHSA-cj63-jhhr-wcxv, GHSA-39q2-94rc-95cp, …). The patched version `dompurify >=3.4.0` is not yet picked up by monaco-editor's release.
- **Why it matters:** These are pre-existing transitive vulns (`monaco-editor@0.55.1` was already in HEAD before this change). The change set does not introduce them, but it surfaces them via `mows-components-react` (every consumer ships dompurify). Worth a pnpm override.
- **Suggestion:** Add a `pnpm.overrides` block in components/react/package.json pinning `dompurify` to `>=3.4.0`. Confirm monaco-editor still functions with the override.

---

- **ID:** ⁉️ TASTE-89
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/package.json (transitive via `jsdom@27.4.0`)
- **Issue:** `jsdom@27.4.0` → `ws@8.20.0` is vulnerable to GHSA-58qx-3vcg-4xpx (uninitialized memory disclosure). Patched in `ws@8.20.1`. Affects test infrastructure only.
- **Why it matters:** Pre-existing — `jsdom` is a devDependency, so production is unaffected. Still worth a pnpm override since `jsdom` won't release fast.
- **Suggestion:** Add `ws: ">=8.20.1"` to `pnpm.overrides`.

---

- **ID:** ⁉️ TASTE-90
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/package.json (transitive via `vite-plugin-dts`, `glob`, `typescript-eslint`)
- **Issue:** `brace-expansion@5.0.5` is vulnerable to GHSA-jxxr-4gwj-5jf2 via multiple paths. Patched in `>=5.0.6`.
- **Why it matters:** Build-time only. Pre-existing.
- **Suggestion:** `pnpm.overrides`: `"brace-expansion": ">=5.0.6"`.

---

- **ID:** ⁉️ TASTE-91
- **Severity:** Minor
- **File:** Workspace Cargo.lock (transitive — no direct change set introduction)
- **Issue:** `cargo audit` reports 22 vulnerabilities, but cross-referencing with the diff shows the change set adds only `petname@3.0.0` directly (clean). All flagged crates (`aws-lc-sys`, `bytes`, `diesel`, `quinn-proto`, `ring`, `rsa`, `rustls-webpki`, `tar`, `time`) are transitive dependencies of pre-existing direct deps (`kube`, `reqwest`, `filez-server`, etc.) — pre-existing in HEAD.
- **Why it matters:** Not introduced by this change set. Flagging here per the brief ("flag any package with known CVE that's introduced by these changes") to clarify that the scan was performed and the findings predate this branch.
- **Suggestion:** No action required for this branch. A separate "dependency hardening" pass to bump `kube`, `reqwest`, `diesel`, and `actix-web` toolchains across the workspace would resolve most of these.

---

## Summary recommendations (top 5 to fix in this PR)

1. **TASTE-1** — Drop the hard-coded `/home/paul/projects/mows` from `build.sh`. Single-line fix. Blocks every other developer.
2. **TASTE-2, TASTE-3, TASTE-4, TASTE-5, TASTE-6** — Remove all raw `<button>` / `<input>` from `lib/components/`. The library is the source of truth; rules can't have exceptions inside the library itself.
3. **TASTE-7, TASTE-8** — Same in supervisor web app (`Sidebar.tsx`, `ModalHost.tsx`).
4. **TASTE-32** — Project-wide `ctx` → `mowsContext` rename. 267 occurrences; scriptable via `pnpm lint:fix` after a codemod.
5. **TASTE-22, TASTE-23** — Drop the two dead `let _ = …;` patterns plus the unused `cfg` parameter. Small, mechanical, signals "we keep the code honest."

Everything else (naming, comments, dead-let patterns) is a long tail. Tackle in a follow-up "naming hygiene" PR scoped per-directory; merging now without these will set a precedent that further entrenches the abbreviations.
