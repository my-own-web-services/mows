# PLAN — `mpm compose up`: Rebuild nur wenn nötig, aber immer wenn nötig, inklusive Caching

> Ziel (Nutzer): Rebuild **nur** wenn nötig, aber **auf jeden Fall** wenn nötig — und der **Layer-Cache bleibt erhalten**.
> Diagnose: [ANALYSIS.md](./ANALYSIS.md). Design adversarial reviewed + **empirisch verifiziert** (Docker 29.5.3 / Compose 5.1.4, echte Wegwerf-Images).
> Status-Legende: ❌ offen · 🔄 in Arbeit · ✅ erledigt+verifiziert

---

## Designentscheidung (Kern) — empirisch bestätigt

### ❌ Verworfen: „bei Änderung `--no-cache`"  ·  ❌ Verworfen: selbst berechneter Content-Hash als Build-Gate
`--no-cache` verwirft den **gesamten** Layer-Cache (Dependencies neu) → widerspricht „inklusive Caching". Ein eigener
Hash müsste BuildKits Cache-Keying exakt nachbilden (`.dockerignore`, `COPY`-Ziele, Build-Args, Basis-Image, Dockerfile)
und divergiert sonst (RC-3). Build **nie** anhand eines unvollständigen Hashes überspringen (Anti-Footgun).

### ✅ Gewählt: Cached Build + Image-ID-Vergleich als Ground Truth
Zwei datengetriebene Schichten aus Dockers eigenem Zustand:

1. **Rebuild — immer `docker compose build` MIT Cache (Default).** BuildKit baut nur die Layer neu, deren Eingaben
   sich änderten; Rest aus Cache. `--no-cache`/`--pull` nur als explizites CLI-Flag.
2. **Recreate — nur wenn die Image-ID sich tatsächlich änderte.** Pro Build-Service: vergleiche die **frisch gebaute
   Tag-Image-ID** mit der Image-ID des **laufenden Containers**. Gleich → kein Recreate. Ungleich → Recreate erzwingen.

**Empirisch bestätigt (Messung):**
- ✅ Geänderte `COPY`-Quelle → cached Build erzeugt **neue** Tag-Image-ID, Dependency-Layer bleiben gecached (Q3: `46ec…`→`491cc…`).
- ✅ Keine Änderung → cached Build erzeugt **byte-identische** Tag-Image-ID (Q4) → das Gate löst korrekt KEIN Recreate aus.
- ✅ `up -d --force-recreate --no-deps <svc>` ist chirurgisch — recreated genau den Service, rührt Dependency/Dependent nicht an (Q6).
- ✅ `RUN`-gefetchte Remote-Inputs werden auf den Instruktionstext gekeyt, nicht den Output → lokal nicht erkennbar (Q7) → bewusst Flag-Sache.

> ⚠️ **Wichtige Messüberraschung (Q5):** In Compose 5.1.4 recreated bereits ein **plain `up -d`** (ohne `--force-recreate`)
> genau den Service mit geänderter Image-ID und lässt den Rest `Running`. Die Regressionen #9259/#9450 reproduzieren hier
> nicht. ⇒ Unser Verify-then-repair ist ein **bewusstes Sicherheitsnetz** gegen Versions-/Edge-Regressionen, **nicht** strikt
> notwendig in dieser Version (CLAUDE.md: deliberate, not lazy). Es MUSS aber die korrekten Felder/Quellen lesen, sonst feuert
> es bei jedem Deploy (siehe Schritt 5).

### Bewusst außerhalb des Automatikpfads (nur explizite Flags)
- `RUN`-Remote-Inputs (`git clone`/`curl`/`apt`/`cargo fetch`) → `--no-cache`/`--rebuild`. Basis-Image-Update bei gleichem Tag → `--pull`.
- „**immer wenn nötig**" gilt für jede **lokal sichtbare** Änderung (was BuildKits Cache-Key sieht); Remote-`RUN`-Inputs und
  Same-Tag-Basis-Updates erfordern bewusst die obigen Flags (physisch nicht anders lösbar, Q7).

---

## Umsetzungsstatus (2026-06-22)

✅ **Implementiert & verifiziert.** `cargo build -p mows-cli` warnungsfrei; `cargo test -p mows-cli` → 399 passed, 0 failed
(17 neue Tests). E2E (mock Docker, isoliert grün): `test-compose-up` 20/20, `test-compose-watch` 6/6, `test-compose-secrets` 16/16. Geänderte Dateien: `cli.rs`, `main.rs`, `compose/docker.rs`, `compose/up.rs`, `compose/watch.rs`,
`tests/test-compose-watch.sh`. Zwei bewusste Vereinfachungen ggü. dem Entwurf:
- **`image_id` statt `compose_images`** (M2): die „built"-Referenz kommt aus `docker image inspect <tag> --format '{{.Id}}'`
  (volle sha256), nicht aus `docker compose images` (das den laufenden Container meldet). Implementiert als neue Trait-Methode
  `image_id` in allen 4 DockerClient-Impls.
- **Kein Modul-Move (S1 entfällt):** das Verify nutzt neue Helfer `build_services`/`image_ref_for_service` (Service-Namen +
  Image-Ref aus dem gerenderten Compose), NICHT `extract_build_contexts` (Kontext-Dirs). Letzteres bleibt unverändert in
  `watch.rs` für den Watch-Scope. `is_build_context_change` wurde als nun toter Code entfernt (inkl. seiner 6 Tests).

## Bei der Verifikation entdeckte & behobene Vorbestands-Bugs (nicht vom Feature verursacht)

Commit `951cbde9` ("rename output directory from results/ to .results/") war **unvollständig** — es ließ
mehrere Stellen auf dem alten `results/`-Pfad zurück, die seitdem still defekt waren:

1. **Produktions-Bug `secrets.rs:488`** ✅ behoben: `compose secrets regenerate` suchte `results/generated-secrets.env`
   (ohne Punkt), während `compose up` nach `.results/` rendert → der Befehl war seit `951cbde9` **komplett kaputt**
   („No generated-secrets.env found"). Fix: `base_dir.join(super::RESULTS_DIR_NAME).join("generated-secrets.env")`.
   Abgedeckt durch `tests/test-compose-secrets.sh` (16/16 grün nach Fix).
2. **E2E-Test-Pfad-Drift** ✅ behoben in `test-compose-{watch,up,secrets}.sh`: prüften `results/` statt `.results/`
   → 4 watch-, 1 up- und mehrere secrets-Subtests schlugen seit `951cbde9` fehl. Alle auf `.results/` korrigiert.
3. **Watch-E2E-Robustheit** ✅: fixe `sleep 3/4` durch Polling (`wait_for_watch_ready`/`wait_for_content`, bis
   „waiting for changes" bzw. der gerenderte Inhalt erscheint) ersetzt — eliminiert Flakiness unter paralleler Last.

## Implementierungsschritte

### Schritt 1 — CLI-Flags ✅
`cli.rs` `Up { … }` (~159-167) + `main.rs:139` durchreichen:
- `--no-cache` (Alias `--rebuild`) → `docker compose build --no-cache`.
- `--pull` → `docker compose build --pull` (+ ggf. `up --pull always`).
- Gelten für Watch- **und** Nicht-Watch-Pfad.

### Schritt 2 — `build_context_changed` durch `BuildPolicy` ersetzen + ALLE Call-Sites migrieren ✅
- `run_deploy_cycle(.., bc: bool)` → `run_deploy_cycle(.., policy: &BuildPolicy)` mit `BuildPolicy { no_cache: bool, pull: bool }`.
- `up.rs:316` `no_cache: build_context_changed` → `no_cache: policy.no_cache`; `pull` analog.
- **Alle Call-Sites migrieren (sonst Compile-Fehler):** Produktion `up.rs:60`, `up.rs:69`, `watch.rs:428`;
  Tests `up.rs:393, 415, 432, 451, 511, 520, 610` (7 Stellen / 6 Funktionen).
- `watch.rs`: `is_build_context_change`→`--no-cache`-Kopplung entfernen (Build-Gate weg; `extract_build_contexts` bleibt für Watch-Scope, s. Schritt 7).

### Schritt 3 — `docker.rs`: Optionen + neue Trait-Methode (alle 4 Impls!) ✅
- `ComposeUpOptions`: Felder `force_recreate: bool`, `no_deps: bool`, `services: Vec<&str>` (leer = alle), `pull: Option<&str>`;
  in `compose_up` (docker.rs:242-285) `--force-recreate`/`--no-deps`/Service-Args/`--pull <policy>` emittieren. (Flags via `--help` bestätigt.)
- `ComposeBuildOptions`: `pull: bool` → `--pull`.
- **Neue Trait-Methode** `image_id(&self, image_ref: &str) -> Result<Option<String>>` → volle `sha256:`-ID eines Tags
  (bollard `inspect_image`; `None` falls Tag nicht existiert). **KEIN** Default-Body (würde das Gate lautlos neutralisieren).
- **In ALLEN 4 Impls implementieren** (Trait ohne Defaults, docker.rs:113-137 → fehlt = E0046):
  `BollardDockerClient` (docker.rs:200), `MockDockerClient` (docker.rs:458), `ConfigurableMockClient` (docker.rs:590),
  `TrackingMock` (up.rs:479-507).
- `ConfigurableMockClient`: Feld `pub image_id: MockResponse` (docker.rs:578) **und** das einzige Voll-Literal ohne
  `..Default::default()` bei docker.rs:778-787 (`test_all_operations_fail_when_daemon_down`) ergänzen + Assertion.
- Neue Felder an allen 3 `ComposeUp/BuildOptions`-Voll-Literalen setzen: up.rs:310-317, up.rs:320-329, docker.rs:803-812 (kein `Default`).

> **Hinweis:** `docker compose images` wird **nicht** verwendet (Messung Q5: meldet das Image des laufenden Containers, nicht
> den frisch gebauten Tag → wäre tautologisch). Stattdessen Tag-Auflösung via `image_id` (s. Schritt 5/M5).

### Schritt 4 — Build-Services + Image-Referenz aus dem GERENDERTEN Compose ableiten ✅
mpm rendert bereits nach `.results/docker-compose.yaml` und parst es (`get_compose_content`, up.rs:242). Das wiederverwenden:
- `services_with_build(compose) -> Vec<String>`: Services mit `build`-Key.
- `image_ref_for(svc, compose, project) -> String`: explizites `services.<svc>.image` falls vorhanden, **sonst**
  synthetisierter Default-Tag `<project>-<svc>:latest` (Messung: `Repository=<project>-<svc>`, `Tag=latest`).
- `find_git_root_from` (watch.rs:21-29) + `extract_build_contexts` (watch.rs:41-118) **gemeinsam** nach `compose/build_context.rs`
  verschieben (`pub(super)`), die 8 Tests watch.rs:610-772 mitnehmen.
- Profile: MOWS nutzt sie aktuell nicht; profiled-out Services fängt die None/None-Regel (Schritt 5) ab. Optionale Härtung: Service-Liste aus `docker compose config --services`.

### Schritt 5 — Verify-then-repair (Herzstück, KORRIGIERT) ✅
Ablauf rund um `run_docker_compose_up` (up.rs:268-335) — Verify **nach** dem Readiness-Wait:
1. `compose_build` (Cache; `--no-cache`/`--pull` nur bei Flag).
2. Je Build-Service `built[svc]` = **`image_id(image_ref_for(svc))`** → volle `sha256:`-ID des **frisch gebauten Tags**.
   *(NICHT `docker compose images` — Q5: das meldet den laufenden Container.)*
3. `compose_up` normal: `up -d --remove-orphans` (Stack hoch, Netzwerke, fehlende Services; recreated in 5.1.4 bereits den Changed-Service, Q5).
4. **Readiness abwarten** (bestehender Pfad `run_post_deployment_checks`, up.rs:106-109/196-234) — erst danach verifizieren.
5. **Verify:** je Build-Service via `list_containers` mit Labels `com.docker.compose.project=<proj>`+`com.docker.compose.service=<svc>`,
   `all=true` (docker.rs:392), je Container `now = .ImageID` (**volle sha256 — NICHT `.Image`**, das ist Repo:Tag, Q2).
   - **Kein Container (None) → akzeptieren**, nie Mismatch (erster Deploy / profiled-out / Replikas=0).
   - Container existiert (running ODER exited) und `now != built[svc]` → Service als **stale** markieren. Bei Replikas: **alle N** `.ImageID` müssen matchen.
6. **Repair (Sicherheitsnetz, S6):** je stale Service `up -d --force-recreate --no-deps <svc>` (chirurgisch, Q6).
7. **Re-Verify (Hard-Gate):** danach erneut prüfen; bei verbleibendem Mismatch **harter Fehler** (`MowsError::Docker`).
   „Image stimmt, Container läuft nicht" ist Sache des Readiness/Health-Passes, **kein** Image-Mismatch.

> Beide Vergleichsseiten sind volle `sha256:` (Q1/Q2) → **keine** Short/Full-Normalisierung nötig; nur ein billiger
> `starts_with("sha256:")`-Sanity-Guard.

### Schritt 6 — Projektname validieren/normalisieren (Tag-Korrektheit) ✅
Messung: Compose 5.1.4 **normalisiert Projektnamen nicht — es lehnt sie ab** (`-p MyProj.V2` → „invalid project name").
`manifest.project_name()` (manifest.rs:86-88) gibt den Namen byte-für-byte zurück.
→ Projektnamen zur **Manifest-Ladezeit** gegen Compose-Regeln validieren/normalisieren (lowercase alnum `-` `_`; keine Dots/Uppercase/Unicode)
→ früher klarer mpm-Fehler statt roher `docker compose`-Ablehnung. Schützt auch den bestehenden `-p`-Pfad (docker.rs:248/293)
und macht den synthetisierten Default-Tag `<project>-<svc>:latest` (Schritt 4) korrekt.

### Schritt 7 — Watch-Modus: Build-Gate weg, mtime-Rauschfilter BEHALTEN ✅
- Watch ruft denselben `run_deploy_cycle` mit derselben `BuildPolicy`.
- ⚠️ **mtime-Gleichheits-Gate NICHT entfernen** (Korrektur ggü. früherem Entwurf): Messung Q4 zeigt, ein No-Op-Cached-Rebuild ist
  **kein** echter No-Op — BuildKit löst den Graph neu auf + voller `render`+secrets+mount+`up -d`+bis 30s Readiness-Poll liefe pro
  spurious FS-Event. Das Image-ID-Gate läuft **downstream** und kann diese Upstream-Kosten nicht unterdrücken. Daher
  `mtimes_changed`-Pre-Filter (watch.rs:245-259/396-402) als **billigen Rauschfilter behalten**; nur die Downstream-Semantik
  (no_cache-Herleitung, Image-ID-Recreate) ändern.
- `extract_build_contexts` bleibt für den Watch-Scope; fallengelassene Kontexte auf `warn!` (RC-4, nicht mehr gate-kritisch).

### Schritt 8 — Tests (NEU + bestehende umschreiben; Pflicht lt. CLAUDE.md) ✅
**Neu (Mock-getrieben; greppbare Mock-Log-Zeile für Recreate ergänzen, z. B. `mock: recreate service=<svc>`):**
- `ComposeUpOptions` mit `force_recreate`/`no_deps`/`services`/`pull` → korrektes argv.
- `compose_build` mit `no_cache`/`pull` → korrektes argv.
- Image-ID **Mismatch** (`built != now`) → genau ein `--force-recreate --no-deps <svc>`.
- Image-ID **Match** → **kein** Recreate (deckt „nur wenn nötig" ab). ← Kernzusicherung.
- **None/None** (kein Container) → kein Mismatch, kein Hard-Fail.
- Nach Repair weiterhin Mismatch → harter Fehler.
- JSON-Feld: Test schreibt `ImageID` (nicht `Image`) als Quelle fest.
- mtime identisch → `run_deploy_cycle`/`compose_build` wird NICHT aufgerufen (analog watch.rs:924-981).
**Bestehende umschreiben (prüfen aktuell ENTFERNTES Verhalten — brechen sonst CI):**
- `tests/test-compose-watch.sh:287-300` (läuft in CI, publish-mows-cli.yml:63-68, `MPM_MOCK_DOCKER=1`): grep'te `"Build context changed"`
  + `compose_build … no_cache=true` → umstellen auf `no_cache=false` (cached) + Recreate-Assert über die neue Mock-Log-Zeile.
- `up.rs:460-524` (`test_run_docker_compose_up_always_builds`) → neuer Vertrag (no_cache=false bei Routine; Recreate nur bei Image-ID-Differenz; `pull`-Assert).
- `watch.rs:419`-Message bewusst entscheiden (entfernen oder „… (cache preserved)") + E2E-Grep anpassen.

---

## Geprüft & verworfen (im Review widerlegt)
- **`docker compose images` als built-Quelle / Short-vs-Full-Normalisierung** — widerlegt (Q1/Q5): beide Seiten volle sha256;
  `compose images` trackt den laufenden Container. Echte Fixes: `.ImageID` + `image_id(tag)`.
- **CI6** (Projektname-Normalisierung für Label-Filter): kein Code rekonstruiert Labels; `compose -p <raw> ps` normalisiert beidseitig identisch.
- **EC1/EC5** (profiled/first-deploy „poisons verify"): von der None/None-Regel + `services_with_build` abgedeckt.
- **GC2-Variante** („verify umgehbar"): Verify liegt im einzigen Chokepoint `run_docker_compose_up`.

## Offene Verifikationspunkte (während Implementierung)
- [ ] `bollard inspect_image` liefert `.Id` als volle `sha256:` (für `image_id`). 
- [ ] `list_containers`-Labelfilter + `all=true` liefert exited Container inkl. `.ImageID`.
- [ ] Synthetischer Default-Tag `<project>-<svc>:latest` deckt sich mit Compose-Tagging (Messung: ja für konforme Projektnamen).

## Scope-Grenzen (bewusst)
- Keine Auto-Erkennung von Remote-`RUN`-Änderungen (→ `--no-cache`). Kein Auto-`--pull`. Kein Hash-basiertes Build-Skip.
