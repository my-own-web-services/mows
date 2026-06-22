# Code-Review: Uncommittete React-Änderungen (`components/react`)

> Multi-Perspektiven-Adversarial-Review (47 Agents: 8 Lenses → Skeptiker pro Finding → Synthese) der 73
> uncommitteten Working-Tree-Änderungen (50 modifiziert + 23 neu). 37/38 Findings bestätigt, 1 verworfen.
> Status: ❌ offen · ✅ behoben · ⁉️ kein echtes Issue. **Diese Änderungen gehören dir (WIP) — der Review ist
> die Bewertung, das Beheben ist deine Entscheidung.**

## Verdict

Funktional weit gediehen, aber **noch nicht commit-reif**. **11 eindeutige MAJOR-Root-Causes** (13 Einträge),
davon drei färben Tooling/CI sofort rot und blockieren/gefährden den `yalc push` an die 7 Konsumenten:

- **TS-1** (`coreActions.ts`): `tsc -p tsconfig.lib.json --noEmit` → 2× `TS2345` (verifiziert). `pnpm build` läuft
  durch (`noEmitOnError:false`), aber das typecheck-Gate ist rot.
- **SLOP-1** (`behaviourEntryIntegrity.test.ts`): committeter Harness-Test rot — 30 Failures, davon 7 Map + 12
  EmojiPicker aus diesem Changeset (verifiziert).
- **CONV-1** (`iconBadge/Patterns.tsx`): `pnpm lint` rot (verbotene `text-stone-800`).

Zwei echte Laufzeit-/Korrektheitsdefekte: **SLOP-2** (Suche im HistoryPanel für alle übersetzten Actions kaputt),
**SLOP-3** (Undo-Stack-Korruption bei Teilgruppen-Undo → State-Korruption). Dazu A11y-/i18n-Lücken in neuen, an
7 Apps ausgelieferten Komponenten (A11Y-1/-2/-4/-5), Test-Lücken (QA-1/-2/-3) und eine Drag-Perf-Regression (PERF-1).
Keine CRITICAL. Vor dem Commit sollten mindestens alle MAJOR (v. a. die Tooling-Roten) behoben sein.

| Severity | Anzahl |
|----------|--------|
| Critical | 0 |
| Major | 11 |
| Minor | 18 |

---

## Major

### ❌ [TS-1] — lib/lib/mowsContext/coreActions.ts:364,374,386,392
`REPLACE_SETTINGS_BLOB` ruft `parseBlobPayload(payload, "...")` ohne Typargument; `P` → `{}` → an
`replaceBlob(next: SettingsBlob)`. `tsc --noEmit` → `TS2345` (374,66)/(392,66). **Fix:** `import type { SettingsBlob }`
+ `parseBlobPayload<SettingsBlob>(...)`; mit `tsc -p tsconfig.lib.json --noEmit` verifizieren.

### ❌ [SLOP-1] — src/examples/map/MapDocPage.tsx:101-107 + src/examples/emojiPicker/EmojiPickerDocPage.tsx:119-130
`Map.test.tsx`/`EmojiPicker.test.tsx` geändert, aber `<BehaviourList>`-`testLine`-Felder nicht nachgezogen →
`behaviourEntryIntegrity.test.ts` rot. **Fix:** testLine neu ableiten — Map `215→264,220→269,227→276,239→288,254→303,272→321,294→343`;
EmojiPicker alle 12 um +6. (Die 11 `sidebar`-Failures sind pre-existing Drift, nicht dieses Changeset.)

### ❌ [CONV-1] — src/examples/iconBadge/Patterns.tsx:45-46
2× `text-stone-800` (verbotene Neutral-Palette) → `eslint` rot. **Fix:** Farb-Klasse entfernen, einmalig per
Inline-Style (`color:'#1c1917'`) auf dem Wrapper-Div (Lucide erbt `currentColor`); **nicht** `text-foreground`.

### ❌ [SLOP-2] — lib/components/appShell/historyPanel/HistoryPanel.tsx:150-157 vs 226-231
Suchfilter matched Roh-`actionId`, angezeigt wird übersetztes `formatActionLabel(...)` → Suche nach sichtbarem Text
findet für alle realen Core-Actions nichts. **Fix:** aufgelöstes Label einmal berechnen, für Suche+Render nutzen;
Regressionstest mit echtem Übersetzungsschlüssel.

### ❌ [SLOP-3] — lib/lib/mowsContext/ActionManager.tsx:813-866 (`runInverts`)
Bei Undo einer Transaktionsgruppe: trifft ein Entry ohne registrierten Handler → früher `return`, aber bereits
invertierte Entries werden NICHT vom Stack gepoppt → Undo-Stack inkonsistent → nächstes Ctrl+Z invertiert erneut →
**Dokument-State-Korruption**. **Fix:** Gruppen-Inversion stackseitig atomar machen (invertierte sammeln, vor jedem
frühen `return` poppen + auf Redo schieben); Regressionstests.

### ❌ [A11Y-1] — lib/components/map/weatherExpandable/WeatherExpandable.tsx:212-217
`role="region" aria-label` liegt INNERHALB des `<CollapsibleTrigger>`-Buttons → ungültiges ARIA, Screenreader prunen
den einzigen accessible Name. **Fix:** role/aria-label vom Header-Div weg; `regionLabel?`-Passthrough zu
`ExpandableSection`, auf dem äußeren Collapsible-Div setzen.

### ❌ [A11Y-2] — lib/components/chat/Chat/Composer.tsx:145-178,270,391-392
Voice/Attachment geben AT keine Rückmeldung: Fehlerzeile (270) ohne `role="alert"`, Recording-Toggle ohne
`aria-live`. WCAG 4.1.3. **Fix:** `role="alert" aria-live="assertive"` auf die Fehlerzeile; `role="status"`-Live-Region
für Recording-State; Strings in beide Locales.

### ❌ [A11Y-4] — lib/components/map/Map.tsx:487,539-694
Neuer 3D-Buildings-Toggle + gesamter Control-Stack + `Map failed to load` sind hartkodiertes Englisch; `Map` liest
`context.t` nicht. **Fix:** Übersetzungen via `MowsContext.t` durchreichen (`map`-Sektion in beide Locales);
mindestens die zwei neuen 3D-Labels.

### ❌ [A11Y-5] — lib/components/dateTime/scheduler/TimeGridView.tsx:157-220,359-392
Drag-to-Reschedule ist pointer-only — kein Tastatur-Pfad, keine `aria-live`-Ansage. **Fix:** `onKeyDown`
(Arrow nudgt um ±slotMinutes / ±1 Tag, ruft `onItemMove`), Live-Region für neue Zeit; Tests.

### ❌ [QA-1] — lib/components/chat/Chat/Composer.tsx:357-383 (Chat.media.test.tsx fehlt)
`enableEmojiPicker` komplett ungetestet (Caret-Insert, `maxBodyLength`-Guard, Focus-Restore). **Fix:** Tests im
`Chat — composer opt-ins`-Block.

### ❌ [QA-2] — lib/components/chat/Chat/Chat.tsx:205-294,462-475 (Chat.test.tsx)
Die 3 jüngsten Scroll/Paging-Bugfixes haben keine Regressionstests (`handleScroll`→`maybeLoadOlder`, `stickyBottom`,
`pendingNewCount`-Pill, `scrollToBottom`-Handle). **Fix:** Tests gegen den realen Outer-Node (AutoSizer gemockt).

### ❌ [QA-3] — lib/components/settings/settingsPanel/SettingsPanel.tsx:435-455 (SettingsPanel.test.tsx)
Neue Temperatureinheit-Select treibt `setTemperatureUnit` — kein Test rendert die Zeile/asserted den Aufruf.
**Fix:** Select öffnen+wählen, `setTemperatureUnit`-Aufruf asserten; `WeatherExpandable` Context-Fallback testen.

### ❌ [PERF-1] — lib/components/dateTime/scheduler/TimeGridView.tsx:176-220,320-456
Drag rendert die ganze View pro `pointermove` (~60-120Hz): `layoutDayEvents` für alle 7 Spalten + `new
Intl.DateTimeFormat` pro Event pro Frame. **Fix:** Formatter `useMemo([locale])`, `dayLayouts` memoisieren,
`onMove` per rAF-Latch throtteln.

---

## Minor
- **[REACT-1]** Chat.tsx:176-203 — `setMeasured` re-ankert rein positional → async Media-Höhen reißen Nutzer nach unten. Gesten-Latch.
- **[REACT-2]** MowsContext.tsx:597-614 — `setLanguage`/`setTheme` `setState` nach `await` ohne Unmount-Guard.
- **[REACT-3/SLOP-4]** useScheduler.ts:45-67 — `useCallback`-Deps auf Inline-`opts`-Objekt → tote Memoisierung.
- **[REACT-4]** TimeGridView.tsx:176-220 — Pointer-Drag-Effekt re-attached Window-Listener pro Frame.
- **[REACT-5]** Chat.tsx:243 — Auto-Scroll-`requestAnimationFrame` ohne Cleanup/cancel.
- **[REACT-6]** Composer.tsx:100-109 — `useImperativeHandle` ohne Dep-Array.
- **[TS-2]** MowsContext.tsx:73-85 — `adapterToAuthContext` Doppel-Cast `as unknown as AuthContextProps` (5/17 Member) → besiegte Typgarantie. Surface verengen.
- **[TS-3]** EmojiPicker.tsx:120-126 — `readJson<T> as T` ohne Runtime-Check; korrupte `recents` (Nicht-Array) → `.map`-Crash. Validieren.
- **[A11Y-3]** coreActions.ts UNDO/REDO — hartkodiertes `Nothing to undo/redo` (+LOGIN/LOGOUT) im Tooltip.
- **[A11Y-6]** Composer.tsx:286-291 — gestagtes `<video>`/`<audio>` ohne aria-label/Dateiname.
- **[A11Y-7]** WeatherExpandable.tsx:326 — Forecast-Strip ohne `tabIndex`/fokussierbare Kinder → kein Keyboard-Scroll.
- **[A11Y-8]** CoordinateLinks.tsx:98,126 — `Open in`/`default map app` hartkodiertes Englisch im einzigen accessible Name.
- **[QA-4]** ActionManager.tsx:697-725 — Audit-Log-Quota-Eviction-Pfad ungetestet.
- **[QA-5]** scheduler/eventLayout.ts — reine Geometrie (Packing/Clipping/Snap) ohne `eventLayout.test.ts`.
- **[QA-6]** openingHours/OpeningHours.tsx:237-246 — `locale`-aus-Context-Fallback ungetestet.
- **[QA-7]** weatherExpandable/icons.tsx:34-65 — `resolveWeatherLucideIcon` nur 1/12 Mappings getestet (Emoji hat Parity-Test).
- **[PERF-2..7]** Diverse: Intl-Formatter in Render-Loops (calendarMath/Views), O(days×events)-Filter ohne Bucketing/`React.memo`, `MessageRow` nicht memoisiert + inline `itemKey`, `searchEmojis` allokiert Heuhaufen pro Keystroke, `getRecentCommands` sortiert in-place beim Read, `OpeningHours` `week`-useMemo rebaut pro Minute.

## Geprüft & verworfen
- **SEC-1** (CoordinateLinks `buildUrl`): kein Sicherheitsproblem — App-Code im eigenen Trust-Boundary, lat/lng streng validiert, `_blank`+`rel=noopener` neutralisiert `javascript:`. Severity none.
- **SEC-2** (Attachment-URLs in media.tsx/MessageRow): out-of-scope — unverändert ggü. HEAD (bereits in 2c643d07 committet); uncommittete Chat-Änderungen sind XSS-sicher (escaped React-Text).
