# Code-Review: `mpm compose up` — bedarfsgesteuerter Rebuild/Recreate

> Adversarialer Multi-Angle-Review der neuen Änderungen (33 Agents: 7 Lenses → Skeptiker pro Finding → Synthese).
> Empirisch gegen Docker 29.5.3 / Compose 5.1.4 verifiziert. 21/25 Findings bestätigt, 4 widerlegt.
> Status: ❌ offen · ✅ behoben · ⁉️ kein echtes Issue
>
> **UPDATE: Alle 15 bestätigten Issues behoben** (mit Regressionstests; `cargo test` 404 passed).
> Kern-Fix: `running_image_ids` → `live_service_image_ids` (nur `State==running`, nicht-one-off) behebt
> STALE-EXITED + ONEOFF; `collect_stale_services` schlägt bei unauflösbarem Built-Image hart fehl (NONE-LENIENT),
> warnt nur bei `${}`-Interpolation (INTERP-IMAGE); `--`-Separator + stderr-Differenzierung; built-IDs einmal
> aufgelöst (TOCTOU); env/parse-Dedup; neue Unit- + E2E-Tests (MPM_MOCK_STALE).

## Verdikt

Cache-/Rebuild-Strategie (Routine-Build immer cached, `--no-cache`/`--pull` nur per Flag) ist **solide**.
Die **Recreate-/Verify-Logik ist NICHT sound**: `running_image_ids` listet via `list_containers` mit `.all(true)`
**alle** Container (auch `exited`/one-off) und vergleicht deren `ImageID` → gesunder Deploy kann fälschlich als
stale gewertet werden → `--force-recreate` fasst den fremden Container nicht an → Re-Verifikation lässt
`mpm compose up` **hart fehlschlagen**. Plus `Ok(None)`-Leniency, die das Sicherheitsnetz still aushebelt.

| Schweregrad | Anzahl |
|---|---|
| Critical | 0 |
| Major | 3 |
| Minor | 12 |

---

## Major

### ✅ [STALE-EXITED] — up.rs:443-462,496 + docker.rs:447-450  (CORRECT-1, RACE-1, REGRESS-2, QA-1)
`running_image_ids` nutzt `.all(true)` und vergleicht die `ImageID` **jedes** Containers, auch `exited`. Ein
zurückgebliebener exited-Container (Crash, One-Shot, Pre-Rename-Orphan) trägt die alte ID → Service fälschlich stale →
`up -d --force-recreate --no-deps` (mit `remove_orphans:false`) entfernt ihn nicht → Re-Verify sieht weiter alte ID →
**Hard-Fail bei gesundem Deploy**. Empirisch reproduziert. Trifft auch Watch.
**Fix:** in `running_image_ids` nur `State=="running"` vergleichen (JSON-Loop-Filter, da bollard `State` lowercase
serialisiert); Doc-Kommentar/Name korrigieren. Regressionstest exited+running.

### ✅ [ONEOFF] — up.rs:435-462→496→572-578  (DOCKER-1)
One-Off-Container (`com.docker.compose.oneoff=True` aus `docker compose run <svc>`) tragen dieselben project+service-
Labels, werden aber von `up --force-recreate` nicht angefasst → dauerhaft stale → Hard-Fail. Empirisch reproduziert.
**Fix:** in `running_image_ids` Einträge mit Label `com.docker.compose.oneoff=="True"` verwerfen (fehlendes Label =
echter Container). Regressionstest.
> STALE-EXITED + ONEOFF teilen den `running_image_ids`-Fix-Punkt: kombinierter Filter „`State==running` UND nicht oneoff".

### ✅ [NONE-LENIENT] — up.rs:485-494  (SLOP-1, SLOP-2, QA-4)
Bei laufenden Containern aber `image_id(image_ref)==Ok(None)` wird der Service still als nicht-stale behandelt
(`debug!`+Skip) — hebelt auch den finalen Hard-Fail-Guard aus. Nach erfolgreichem `compose build` MUSS das Image
lokal existieren → `Ok(None)` ist Anomalie. Verbotenes „Fallback versteckt Bug"-Muster.
**Fix:** im `None`-Zweig (Container laufen) hart fehlschlagen. Regressionstest.

---

## Minor

### ✅ [NULL-BUILD] — up.rs:407  (CORRECT-2)
`svc.get("build").is_some()` klassifiziert `build:`/`build: null` (image-only) fälschlich als Build-Service.
**Fix:** `svc.get("build").map(|b| !b.is_null()).unwrap_or(false)`. Test erweitern.

### ✅ [PROJECT-NORM] — up.rs:430 vs 440  (CORRECT-3)
Default-Tag nutzt `project_name.to_lowercase()`, Label-Filter den rohen Namen → latente Divergenz (nur durch
`validate_project_name` maskiert).
**Fix:** Projektnamen einmal `.to_lowercase()` ableiten und beiden Seiten geben.

### ✅ [SVC-ARGINJ] — docker.rs:127-129  (SEC-2)
Service-Namen als nackte Positionals ohne `--`-Separator → Service `--build`/`-d` wird als Flag geparst (empirisch:
löst Build aus). **Fix:** `--`-Separator vor den Services emittieren; Service-Namen mit führendem `-` ablehnen. Test anpassen.

### ✅ [IMG-ARGINJ] — docker.rs:470  (SEC-1)
`docker image inspect … <image_ref>` ohne `--`-Separator → `image: "--format"` wird als Flag geparst. Image-Werte
aus Templates / `compose install`. **Fix:** `--`-Separator vor `image_ref`; Image mit führendem `-` ablehnen.

### ✅ [IMG-ID-ERR] — docker.rs:483-486  (SLOP-3)
`image_id` mappt JEDEN Nicht-Null-Exit auf `Ok(None)` → „absent" ununterscheidbar von „daemon down/permission/invalid".
**Fix:** stderr prüfen; nur „no such image/object" → `Ok(None)`, sonst `Err`.

### ✅ [VERIFY-PARSE-SWALLOW] — up.rs:279-281,517-520  (SLOP-5)
`verify_and_repair_images` lädt Compose via `get_compose_content`, das Lese-/Parsefehler auf `None`→`Ok(())` kollabiert
→ Verify still übersprungen. **Fix:** in `verify_and_repair_images` „kein File"(→Ok) von „unlesbar/unparsebar"(→Err) trennen.

### ✅ [ENV-FILE-DUP] — up.rs:318-330 vs 537-547  (SLOP-6)
env-file-Sammelblock byte-für-byte dupliziert (Build/Up vs Repair) → Drift-Risiko. **Fix:** `deploy_env_files()`-Helper.

### ✅ [PULL-DOC] — cli.rs:176-178 + up.rs:362  (SLOP-4)
`--pull`-Doku erwähnt nur `build --pull`, setzt aber auch `up --pull always` (Magic-String). **Fix:** Doku erweitern;
geteilte Konstante `UP_PULL_ALWAYS`.

### ✅ [INTERP-IMAGE] — up.rs:422-431,485-494  (DOCKER-2)
Explizites `image: ${REGISTRY}/app:${TAG}` überlebt verbatim im gerenderten Compose (gtmpl ≠ Compose-Interpolation) →
`image_id` → `Ok(None)` → Verify still übersprungen. **Fix (minimal):** `warn!` bei `image_ref.contains("${")`.
**Fix (vollständig):** `image` aus `docker compose --env-file … config --format json` lesen.

### ✅ [TOCTOU-RETAG] — up.rs:526-578  (RACE-4)
`image_id(tag)` wird pro Verify-Pass neu aufgelöst; nebenläufiges Retag von `<project>-<svc>:latest` → spuriöser
Recreate/Hard-Fail. Headline-Trigger (Watch-Overlap) widerlegt (Watch ist seriell). **Fix:** gebaute Image-ID einmal
direkt nach `compose_build` capturen und durchreichen.

### ✅ [TEST-GAP-RECREATE] — test-compose-up.sh + docker.rs:576-583  (QA-3, QA-5)
Recreate-Pfad hat null E2E-Coverage (Mock `list_containers`→`[]`, force_recreate-`println` ist toter Code); kein
`replicas>1`-Test. **Fix:** Mock-`list_containers` env-gaten für Recreate-E2E; Unit-Test `collect_stale_services` mit 2 Replicas.

### ✅ [WATCH-MARKER] — test-compose-watch.sh:296-308  (REGRESS-1)
build-context-Test wartet auf Zwischenmarker „Re-deploying" statt auf das Endartefakt (2. Build-Zeile); ~2 ms-Fenster
(85 Läufe: 0 Fehler). **Fix:** `wait_for_count`-Helper, vor `CACHED_BUILDS`-Auswertung auf 2 Build-Zeilen pollen.

---

## Geprüft & verworfen
- **RACE-2** (Verify nach Readiness-Timeout prüft „unsettled set"): widerlegt — Vergleich ist Image-Digest, nicht Prozesszustand; `up -d` kehrt erst zurück, wenn Container aus dem frischen Image erzeugt sind.
- **RACE-3** (force_recreate bricht Rolling-Update): widerlegt — kein Rolling-Behaviour (kein Swarm/`update_config`).
- **REGRESS-3** (langsamer Build → kurz alter Container → False-Stale): widerlegt — Re-Verify läuft nach synchroner `compose_up`-Rückkehr; Hard-Fail keyt auf Image-Identität.
- **QA-2** (Default-Tag lowercased Service-Namen-Mismatch): widerlegt — Compose lowercased Service-Namen nicht; gemischt-case scheitert vorher hart.
