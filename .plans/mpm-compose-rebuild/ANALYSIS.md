# Root-Cause-Analyse: `mpm compose up` baut Container trotz geänderter Dateien oft nicht neu

> Status: ✅ Analyse abgeschlossen & Code-Aussagen unabhängig verifiziert (Direkt-Reads von `up.rs`, `docker.rs`, `watch.rs`, `cli.rs`, plus crate-weiter Grep). Datum: 2026-06-22.
> Erstellt via Multi-Agent-Workflow (8 Investigatoren → Hypothesen → adversariale Verifikation 2 Linsen/Hypothese → Synthese) + manueller Nachprüfung.

## Wichtigste Korrektur am Ausgangsbild

Es gibt **kein mpm-internes Caching-/State-System**, das Builds überspringt. Grep über das gesamte
`src/package_manager/compose/`-Modul nach `sha|hash|digest|checksum|build-state|fingerprint`
(ohne `HashMap`/`HashSet`/Kommentare/Tests) liefert **null Treffer**. `docker compose build` läuft
**immer**. Der einzige Cache im Spiel ist **Dockers eigener Layer-Cache** — und genau den umgeht
`mpm compose up` im Normalpfad nie. Die Beschwerde ist also nicht „mpm überspringt den Build", sondern
„mpm baut **immer mit Cache** und erzwingt **nie** ein Container-Recreate".

## Executive Summary

Der normale (Nicht-Watch-)Aufruf `mpm compose up` ruft `run_deploy_cycle(&base_dir, client.as_ref(), false)`
mit dem Flag `build_context_changed` **hart auf `false`** (`up.rs:69`). Dieses eine Boolean ist die
**einzige** Stelle, die steuert, ob `docker compose build` mit `--no-cache` läuft
(`up.rs:316` → `docker.rs:303-307`). Die komplette Change-Detection (`is_build_context_change`,
mtime-Snapshots) lebt ausschließlich im Watch-Loop (`watch.rs`) und ist aus einem normalen
`mpm compose up` **strukturell unerreichbar** (nur `watch.rs:428` übergibt je einen berechneten Wert).
Zusätzlich läuft `docker compose up -d` **ohne `--force-recreate`** und **ohne `--pull`** (`docker.rs:258-268`).

Zwei bestätigte Hauptursachen: **RC-1** (Nicht-Watch-Pfad kann nie `--no-cache` setzen) und der
robustheitskritische Teil von **RC-2** (kein `--force-recreate`, kein Image-ID-Vergleich im Post-Deploy-Check).
RC-3/RC-4 sind reale, aber nur-im-Watch-Modus relevante Nebenbefunde. H5 (falscher Build-Context) ist
widerlegt; H6 (`MPM_MOCK_DOCKER`) ist nur ein Umgebungs-Footgun, kein Logikbug.

## Tatsächlicher Kontrollfluss (verifiziert)

1. `main.rs:139` — `ComposeCommands::Up { watch, debounce_ms } => compose_up(watch, debounce_ms)`.
   `watch` Default `false` (`cli.rs:159-167`). Nacktes `mpm compose up` ⇒ `watch == false`.
2. `compose_up` (`up.rs:49`): Manifest-Dir ermitteln, `default_client()` (`up.rs:55`).
3. Verzweigung (`up.rs:57-70`):
   - **Nicht-Watch:** `up.rs:69` → `run_deploy_cycle(&base_dir, client.as_ref(), false)` — Literal `false`.
   - **Watch:** initialer Deploy `up.rs:60` ebenfalls `false`, danach `run_watch_loop` (`watch.rs`).
4. `run_deploy_cycle(.., build_context_changed)` (`up.rs:83`): render → secrets → pre-checks → mounts →
   `run_docker_compose_up(client, &context, build_context_changed)` (`up.rs:106`) → post-checks.
5. `run_docker_compose_up` (`up.rs:268`):
   - **immer** `ComposeBuildOptions { .., no_cache: build_context_changed }` (`up.rs:310-316`) → `compose_build`.
   - **immer** `ComposeUpOptions { build: false, detach: true, remove_orphans: true }` (`up.rs:320-329`) →
     `compose_up`. **Kein** `force_recreate`-Feld.
6. CLI-Kommandos:
   - `compose_build` (`docker.rs:287-324`): `docker compose -p <proj> --project-directory .results -f <compose> build`;
     `--no-cache` **nur** bei `options.no_cache` (`docker.rs:303-307`).
   - `compose_up` (`docker.rs:242-285`): `docker compose … up`; `--build` nur bei `options.build` (=`false`),
     `-d`, `--remove-orphans`. **Niemals** `--force-recreate`, **niemals** `--pull`.
7. Nur `watch.rs:428` liefert je `build_context_changed=true`.

Selbst-Dokumentation des Codes (`up.rs:259-267`, `304-309`) räumt ein, dass `up --build` „may not always
invalidate the layer cache correctly" — der eigentliche Fix (`--no-cache`) ist aber nur an den Watch-Loop verdrahtet.

## Bestätigte Root Causes

### RC-1 — Nicht-Watch `mpm compose up` kann nie `--no-cache` setzen (Likelihood: hoch)
`build_context_changed` ist im Normalpfad Literal `false`; Change-Detection ist Watch-exklusiv. Folge:
Normaler `mpm compose up` baut **immer mit Layer-Cache**; ob eine geänderte Quelldatei ein neues Image erzeugt,
entscheidet allein Docker/BuildKit.

Lücken-Klassen, bei denen Dockers Cache eine echte Änderung NICHT sieht (Docker-Doku, high confidence):
- `RUN`-Schritte sind nur auf den **Befehlsstring** gekeyt: `RUN git clone`/`curl`/`apt-get update`/`cargo fetch`
  holen geänderten Upstream NICHT neu (https://docs.docker.com/build/cache/invalidation/).
- COPY/ADD ignorieren **mtime** im Checksum.
- Per `.dockerignore` ausgeschlossene oder gar nicht via COPY ins Image gezogene Dateien busten den Cache nicht.

Präzisierung: Für eine Datei, die tatsächlich via COPY ins Image wandert und sich inhaltlich ändert,
**bustet BuildKit den Layer auch ohne `--no-cache`** — der häufige Fall „edit `src/foo.rs`, wird kopiert" wird
also auch heute oft korrekt gebaut. Die Lücke betrifft die obigen Klassen. Passt zu „**oft** nicht neu gebaut".

Evidenz: `up.rs:60/69` (`false`), `up.rs:106`, `up.rs:310-318`, `docker.rs:303-307`,
`watch.rs:315-319` (leere Kontexte ⇒ `false`), `watch.rs:416-428` (einziger `true`-Producer),
`cli.rs:159-167` (kein `--no-cache`/`--rebuild`-Flag).

### RC-2 — Kein `--force-recreate`, kein Image-ID-Vergleich (Code-Tatsachen bestätigt; Schaden bedingt)
- `ComposeUpOptions` hat kein `force_recreate`-Feld (`docker.rs:53-71`); `compose_up` emittiert nie
  `--force-recreate`/`--pull` (`docker.rs:258-268`); crate-weiter Grep: null Nicht-Test-Treffer.
- Render berechnet **keinen** content-basierten/eindeutigen Image-Tag (`render.rs:375-434`) ⇒ Tag konstant über Läufe.
- Post-Deploy-Check (`up.rs:186-246`, `health.rs`) pollt nur Status/Health, vergleicht **nie** die laufende
  Image-ID mit dem frisch gebauten Image ⇒ mpm meldet Erfolg auch bei stale Container.

Bedingung: Ist ein Build voll aus dem Cache (RC-1), bleibt die Image-ID gleich ⇒ Compose-Default-Konvergenz
(`com.docker.compose.config-hash`, in den der Image-Digest einfließt) erkennt korrekt „keine Änderung" und
rekreiert by-design nicht (Container ist byte-identisch). Schaden entsteht (a) gekoppelt mit RC-1, wenn ein Rebuild
hätte passieren sollen, der Cache ihn aber verhindert, und (b) bei dokumentierten Compose-Recreate-Regressionen
(docker/compose#9259, #9450 — versionsabhängig, extern nicht aus dem Repo verifizierbar), gegen die mpm mangels
`--force-recreate` keinen Fallback hat. Eigenständig stärkste Lücke: fehlender Image-ID-Vergleich im Post-Deploy-Check.

### RC-3 — Change-Detection (nur Watch) ist mtime-Gleichheit, nicht Content-Hash (eng)
`mtimes_changed` (`watch.rs:245-259`) vergleicht Dateianzahl + exakte `SystemTime`-Gleichheit; kein Content-Hash
existiert. Bei Gleichheit wird das Event verworfen (`watch.rs:396-402`). Korrektur: die „git checkout"-Story
widerlegt sich selbst (git setzt mtime auf Wall-Clock-Checkout-Zeit ⇒ Änderung wird erkannt). Realer Blind Spot eng:
mtime-erhaltende Tools (`git-restore-mtime`, `cp -p`, `rsync -t`, `tar`) oder zwei Writes in derselben groben Sekunde.
**Nur Watch-Modus** betroffen.

### RC-4 — `extract_build_contexts` lässt Kontexte still fallen (eng, nur Watch)
Leere/partielle Liste bei: nicht lesbarer/parsebarer `.results`-Compose (`watch.rs:48-62`, nur `debug!`),
`build:`-Block mit nur `dockerfile:` ohne `context:` (`watch.rs:80-89`), Kontext außerhalb Git-Root
(`watch.rs:96-104`), Nicht-Verzeichnis (`watch.rs:106-113`). Leere Liste ⇒ `is_build_context_change == false`.
`--no-cache` ist zudem **global** über alle Services (alles-oder-nichts). **Nur Watch-Modus** relevant.

## Verworfene / unwahrscheinliche Hypothesen
- **H5 (falscher Build-Context via `../../<service>`):** Widerlegt. `../../` ist für das init-Layout korrekt
  (`mod.rs:37` `.results`, `init.rs:103-112`, Test `init.rs:477`). Docker und Change-Detector lösen `build.context`
  gegen dasselbe `.results` auf. Falscher Kontext würde laut fehlschlagen, nicht still alten Cache liefern.
- **H6 (`MPM_MOCK_DOCKER=1`):** Mechanismus existiert (`docker.rs:429-436,481-493`), aber kein Logikbug — nur relevant,
  falls die Variable in eine echte Shell leakt. Druckt sichtbar `mock: compose_build …` nach stdout.
  Diagnose: `env | grep MPM_MOCK_DOCKER`.

## Cache behalten UND Rebuild garantieren
Zwei orthogonale Hebel: (1) **Image-Rebuild** via `docker compose build` (Cache) bzw. `--no-cache`;
(2) **Container-Recreate** via Compose-Konvergenz (`config-hash`, Image-Digest) bzw. `--force-recreate`.
mtime ist die falsche Basis (BuildKit ignoriert mtime für COPY/ADD; mtime-erhaltende Tools verschlucken Änderungen).
Robuste Größe: **Content-Hash** (SHA-256 über alle Dateien des aufgelösten Build-Contexts **unter `.dockerignore`** +
Dockerfile + relevante gerenderte Compose-Felder), persistent gespeichert und pro Deploy verglichen.
- Hash gleich ⇒ normaler `docker compose build` mit Cache, `up -d` ohne erzwungenes Recreate (schnell).
- Hash unterschiedlich ⇒ `--no-cache` (garantierter Rebuild) **und** `--force-recreate` (garantierter Roll).
Anti-Footgun: Den Build-Schritt **nie** anhand eines unvollständigen internen Hashes überspringen — `compose build`
läuft weiter (BuildKit fängt Fälle ab, die ein grober Hash verpasst); der interne Hash steuert nur `--no-cache`/`--force-recreate`.

## Konkrete Fixes (gerankt)

> ⚠️ **Korrektur (2026-06-22):** Der ursprüngliche Fix 1 („Content-Hash gated `--no-cache`") wurde verworfen —
> `--no-cache` bei jeder Änderung verwirft den gesamten Layer-Cache und widerspricht „inklusive Caching",
> und ein selbst berechneter Content-Hash riskiert, von BuildKits Cache-Keying zu divergieren. Das
> autoritative, korrigierte Design (Cached Build + Image-ID-Vergleich als Ground Truth) steht in
> **[PLAN.md](./PLAN.md)**. Die folgenden Stellen-Referenzen bleiben gültig; nur der Mechanismus von Fix 1/2
> ist dort neu gefasst.

### Fix 1 (kritisch) — Content-Hash-gesteuertes `--no-cache` auch im Nicht-Watch-Pfad
Ort: `up.rs:69` (+`up.rs:60`), Logik geteilt aus `watch.rs:41-118`.
- `extract_build_contexts` in gemeinsames Modul (`compose/build_context.rs`) verschieben.
- `compute_build_context_hash(base_dir) -> Hash`: SHA-256 über jeden aufgelösten Kontext (wie Docker ihn gegen
  `.results` auflöst) unter `.dockerignore` + Dockerfile + gerenderte `.results/docker-compose.yaml`.
- Persistierten Hash (`.results/.build-state.json` oder `config.rs`) laden; `build_context_changed = stored != current`
  und diesen Wert statt `false` übergeben.
- Interim/minimal: explizites `--no-cache`/`--rebuild`-Flag an `Up` (`cli.rs:159-167`, `main.rs:139`, `compose_up`-Signatur).

### Fix 2 (kritisch) — `--force-recreate` bei echter Änderung + Image-ID-Verifikation
Ort: `docker.rs:53-71` (Struct), `docker.rs:258-268` (Args), `up.rs:320-331` (Aufruf), `up.rs:186-246`/`health.rs` (Check).
- `force_recreate: bool` zu `ComposeUpOptions`; in `compose_up` `if options.force_recreate { cmd.arg("--force-recreate"); }`.
- `force_recreate: build_context_changed` setzen (Recreate nur bei echter Änderung).
- Post-Deploy-Check härten: laufende Image-ID via `inspect` (vgl. `preflight.rs:585`) mit frisch gebautem Image
  vergleichen, bei Divergenz laut fehlschlagen. → Aufhänger für Regressionstest.

### Fix 3 (mittel, nur Watch) — `extract_build_contexts` robuster + lauter
Fehlendes `context:` auf Dockerfile-Dir defaulten; Parse-Fehler ⇒ Deploy fehlschlagen statt `Vec::new()`;
fallengelassene Kontexte auf `warn!` statt `debug!`.

### Fix 4 (mittel, nur Watch) — mtime-Gate durch Content-Hash ersetzen
`mtimes_changed`-Gate (`watch.rs:245-259`, `396-402`) durch denselben Content-Hash aus Fix 1 ersetzen.

### Fix 5 (niedrig) — Mock-Footgun entschärfen
Sichtbares `warn!`/Banner bei aktivem Mock auf jedem Aufruf; optional hinter Build-Profil-Gate.

## Minimale Reproduktion
```bash
# 0) Mock-Check
env | grep MPM_MOCK_DOCKER   # darf nichts ausgeben

# 1) Service mit RUN-fetch (klassischer Cache-Treffer-Fall)
#    Dockerfile: RUN echo "marker $(date +%s)" > /marker.txt ; COPY data.txt /data.txt
echo v1 > app/data.txt
mpm compose up        # data: v1

# 2) Quelle aendern, erneut normal deployen
echo v2 > app/data.txt
mpm compose up
# COPY-Datei wird gebustet -> v2. Aendert man stattdessen NUR eine RUN-gefetchte /
# .dockerignore-ausgeschlossene / nicht-kopierte Quelle, bleibt das Image gleich
# -> v1 bleibt, Container wird NICHT rekreiert (Symptom).

# 3) Gegenprobe
docker compose -p <proj> -f deployment/.results/docker-compose.yaml \
  --project-directory deployment/.results build --no-cache
docker compose -p <proj> ... up -d --force-recreate   # jetzt v2
```

## Verifikationsstatus der zentralen Aussagen (manuell nachgeprüft)
- ✅ `up.rs:60` und `up.rs:69` übergeben hart `false`; nur `watch.rs:428` übergibt berechneten Wert.
- ✅ `up.rs:316` `no_cache: build_context_changed`; `ComposeUpOptions { build:false, … }`, kein `force_recreate`.
- ✅ `docker.rs` `compose_up` emittiert nur `up`/`-d`/`--remove-orphans` (`--build` nur bei `build:true`); kein `--force-recreate`/`--pull`.
- ✅ `docker.rs` `compose_build` hängt `--no-cache` nur bei `options.no_cache` an.
- ✅ `cli.rs:159-167` `Up` exponiert nur `watch` + `debounce_ms`.
- ✅ `mtimes_changed` nutzt exakte `SystemTime`-Gleichheit; `is_build_context_change` ⇒ `false` bei leeren Kontexten.
- ✅ Kein Content-Hash / persistenter Build-State im gesamten `compose/`-Modul (Grep: 0 Treffer).
- ⚠️ Extern/unsicher: Compose-Recreate-Regressionen #9259/#9450 (versionsabhängig); `MPM_MOCK_DOCKER`-Leak (Umgebung).
