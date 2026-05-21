# Technology review (Bash/Docker/SQL) — change set 2026-05-20

**Scope:** all uncommitted shell/docker/sql changes on branch `feat/mows-components-react`
**Reviewer perspective:** Infra Language Expert
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| Major | 6 |
| Minor | 7 |

---

## Findings — Bash idioms

---

**ID:** ✅ TECH-INFRA-1
**Status:** Fixed
**Severity:** Critical
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:43`
**Issue:** `BAKE_ARGS` is used unquoted in `docker buildx bake ${BAKE_ARGS:-default}`, which allows word-splitting and glob expansion of a user-controlled variable.
**Why it matters:** If `BAKE_ARGS` contains spaces or shell metacharacters (e.g. a path with spaces in `--allow=fs.read=...`), the argument list will be silently misinterpreted by the shell, leading to incorrect flags being passed to `docker buildx bake` or a failed build that is hard to diagnose.
**Suggestion:** Quote the expansion: `docker buildx bake "${BAKE_ARGS:-default}"`. Because `BAKE_ARGS` already contains multiple space-separated tokens that must be split, the correct approach is to use an array: `BAKE_ARGS_ARRAY=(${BAKE_ARGS:-default})` and then `docker buildx bake "${BAKE_ARGS_ARRAY[@]}"`.
**Fix applied:** Converted `BAKE_ARGS` to a proper bash array and quoted the expansion: `BAKE_ARGS=("${BAKE_ARGS:-default}" "--allow=fs.read=${REPO_ROOT}" "--set" "*.args.APP_STAGE_IMAGE=alpine")` + `docker buildx bake "${BAKE_ARGS[@]}"`. Same change also resolved TASTE-1.

---

**ID:** TECH-INFRA-2
**Severity:** Critical
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:1`
**Issue:** The shebang is `#!/bin/sh` and `set -eu` is used without `-o pipefail`, but the script pipes through `awk` on lines 64 and 83-89, masking pipeline failures.
**Why it matters:** `sha256sum "${f}" | awk '{print $1}' > "${f}.sha256"` — if `sha256sum` fails (e.g. the file is missing or unreadable), the pipeline exit code is the exit code of `awk`, which will be 0. The `.sha256` file will be silently written as empty, breaking the reproducibility contract without any error being raised.
**Suggestion:** Change the shebang to `#!/bin/bash` and add `set -euo pipefail`. Where `#!/bin/sh` is required for portability reasons, replace the pipeline with: `hash=$(sha256sum "${f}"); echo "${hash%% *}" > "${f}.sha256"`.

---

**ID:** TECH-INFRA-3
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:53-54`
**Issue:** `ls -1 ... | head -1` is used to find the kernel and initramfs files rather than a glob assignment; the result is stored in a plain variable without `read -r`.
**Why it matters:** `ls` output with filenames containing newlines or spaces will be silently truncated or misinterpreted. More concretely, using `KERNEL_FILE=$(ls -1 "${ROOTFS}"/boot/vmlinuz-* 2>/dev/null | head -1 || true)` will store an empty string silently when no file exists (because `|| true` swallows the error), and the explicit emptiness check on line 55 is the only safety net. Using shell globbing is safer and idiomatic.
**Suggestion:** Replace with a glob-based approach:
```sh
KERNEL_FILE=""
for f in "${ROOTFS}"/boot/vmlinuz-*; do
    [ -f "$f" ] && KERNEL_FILE="$f" && break
done
```

---

**ID:** TECH-INFRA-4
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:87-89`
**Issue:** `cat` output in the final `echo` lines is unquoted: `$(cat ${OUT_QCOW}.sha256)`.
**Why it matters:** If the `.sha256` file path contains spaces or special characters, the unquoted `${OUT_QCOW}` will cause word-splitting, resulting in a `cat` invocation on a wrong path and a misleading empty echo line — silently wrong output at the end of the build step.
**Suggestion:** Quote all variable expansions: `echo "qcow2 sha256:    $(cat "${OUT_QCOW}.sha256")"` (and similarly for the other two lines).

---

**ID:** TECH-INFRA-5
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:34`
**Issue:** The argument parser uses `[ ]` (POSIX `test`) inside a `while [ $# -gt 0 ]` loop rather than `[[ ]]`, and the `case` block shifts `$2` without validating that `$2` exists.
**Why it matters:** Invoking `bash build.sh --distro` (with no value following) silently sets `DISTRO=""` (bash evaluates `$2` as empty) and then shifts two, leaving a confusing error from the `case` validation further down rather than an early, clear "missing argument" message.
**Suggestion:** Add a guard before each `--distro) DISTRO="$2"; shift 2` arm:
```sh
--distro)
    [ $# -ge 2 ] || { echo "ERROR: --distro requires a value" >&2; exit 2; }
    DISTRO="$2"; shift 2 ;;
```
And prefer `[[ $# -gt 0 ]]` in the loop condition.

---

**ID:** TECH-INFRA-6
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:80-81`
**Issue:** The existence check `[ ! -x "${MOWS_CLI_DIR}/dist/mows" ]` is done after `cp` on line 84, but the `cp` itself is not guarded: if `SKIP_MOWS_BUILD` is set and the binary is absent, the script will `exit 1` on line 82, but only after the check — there is no check that `MOWS_CLI_DIR` itself is valid or that `dist/mows` is readable (as opposed to just executable in a PATH sense).
**Why it matters:** On a fresh clone with `SKIP_MOWS_BUILD=1`, the error message is helpful (`dist/mows not found`), but the script already did `mkdir -p "$(dirname "${MOWS_BIN_STAGING}")"` unconditionally, polluting the build directory before failing.
**Suggestion:** Move the existence check before the build step and before directory creation, or restructure so side effects only happen when pre-conditions are met:
```sh
if [ -z "${SKIP_MOWS_BUILD:-}" ]; then
    (cd "${MOWS_CLI_DIR}" && TARGETARCH="${TARGETARCH}" PROFILE=release bash build.sh)
fi
[ -x "${MOWS_CLI_DIR}/dist/mows" ] || {
    echo "ERROR: ..." >&2; exit 1
}
mkdir -p "$(dirname "${MOWS_BIN_STAGING}")"
cp "${MOWS_CLI_DIR}/dist/mows" "${MOWS_BIN_STAGING}"
```

---

**ID:** TECH-INFRA-7
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/scripts/codegen.sh:22-27`
**Issue:** `docker run` mounts `./openapi.json` with a relative path (`-v ./openapi.json:/app/openapi.json`) which requires the CWD to be the script's parent directory.
**Why it matters:** `codegen.sh` does `cd "$(dirname "$0")/.."` on line 10, so the CWD is the workspace root, not `scripts/`. The relative `./openapi.json` will resolve correctly from there, but the `./tmp` volume mount depends on this same CWD assumption. If the script is ever `source`d or the `cd` fails silently (it can if the path doesn't exist), the Docker bind-mounts will silently mount wrong host paths, and the generated file will be placed in an unexpected location or not at all.
**Suggestion:** Capture `SCRIPT_DIR` at the top and use absolute paths for all bind mounts:
```sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
docker run --rm \
    -v "${WORKSPACE_DIR}/openapi.json:/app/openapi.json" \
    -v "${WORKSPACE_DIR}/tmp:/app/out" \
    ...
```

---

**ID:** TECH-INFRA-8
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/common/mows-agent-init.sh:1`
**Issue:** The shebang is `#!/bin/sh` and the script uses `set -e` without `pipefail`, and uses bare `awk` in a pipeline on line 24 (`awk -F': *' ... /mowsinit/run.yaml`).
**Why it matters:** If `awk` fails (e.g. malformed `run.yaml`), `set -e` catches the failure in `$()` subshell, but only if the subshell exit code propagates — with POSIX `sh` this is not guaranteed across all implementations. Also `MOWS_AGENT_KIND` will be empty rather than `"claude"` if `awk` returns nothing, and the fallback `${kind:-claude}` on line 25 silently reuses the default, masking a parse failure.
**Suggestion:** Add explicit error handling around the `run.yaml` parse, and document that the `claude` default is intentional:
```sh
kind=$(awk -F': *' '$1=="kind"{print $2; exit}' /mowsinit/run.yaml 2>/dev/null) || kind=""
echo "MOWS_AGENT_KIND=${kind:-claude}" >> /etc/environment
```
Log a warning when `kind` is empty and the default is used, so the operator knows the YAML was unreadable.

---

**ID:** TECH-INFRA-9
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:29-30`
**Issue:** `pnpm install --frozen-lockfile=false` disables lockfile enforcement only when `node_modules` is absent, which is the wrong heuristic: a partial or corrupted `node_modules` passes the `[ ! -d node_modules ]` guard and skips the install entirely.
**Why it matters:** A developer who deletes a single package from `node_modules` but not the directory will silently use a broken install. The check should be `pnpm install` unconditionally (pnpm is idempotent on a warm cache) or at minimum check for a sentinel file like `node_modules/.modules.yaml`.
**Suggestion:** Remove the `[ ! -d node_modules ]` guard and always run `pnpm install --frozen-lockfile`. If the intent is to allow unlocked installs in CI, use `--frozen-lockfile="${FROZEN_LOCKFILE:-true}"`.

---

**ID:** TECH-INFRA-10
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/scripts/codegen.sh:21`
**Issue:** `mkdir -p tmp` creates the temp directory without using `mktemp`, and `rm -rf tmp` at the end is not wrapped in a `trap`.
**Why it matters:** If any step between `mkdir -p tmp` and `rm -rf tmp` fails (e.g. the `docker run` exits non-zero and `set -euo pipefail` kills the script), the `tmp/` directory is left on disk containing a partial or stale generated file. On the next successful run the old file will be overwritten, but if inspected in the meantime it looks like a valid artifact.
**Suggestion:** Use a trap for cleanup:
```sh
TMP_DIR=$(mktemp -d)
trap 'rm -rf "${TMP_DIR}"' EXIT
```
And replace all references to `tmp` with `"${TMP_DIR}"`.

---

## Findings — Dockerfile quality

---

**ID:** TECH-INFRA-11
**Severity:** Critical
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/nixos.Dockerfile:19`
**Issue:** `FROM nixos/nix:latest` uses the `latest` tag, violating the reproducibility contract the file itself describes.
**Why it matters:** `latest` resolves to a different image digest on every pull. Two engineers running `bash build.sh --distro nixos` on different days will pull different `nixos/nix` base images, and the resulting `nix` binary version, store format, and daemon behaviour may differ — invalidating the "run twice and sha256 files MUST match" guarantee stated in `image-builder/build.sh`.
**Suggestion:** Pin to an exact digest or tag, for example: `FROM nixos/nix:2.24.9` (check the current stable tag at `hub.docker.com/r/nixos/nix`). Add a comment documenting how to update it.

---

**ID:** TECH-INFRA-12
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:93-94`
**Issue:** `COPY --from=mows-bin /mows /usr/local/bin/mows` is followed immediately by a separate `RUN chmod +x /usr/local/bin/mows` layer, creating an extra image layer when `COPY --chown` or `COPY --chmod` (available since Dockerfile syntax 1.2) could handle this in one step.
**Why it matters:** The extra `RUN chmod` layer increases the image size (the file is duplicated in the overlay layer), and this pattern is repeated identically in `debian.Dockerfile:86-87` and `ubuntu.Dockerfile:75-76`.
**Suggestion:** Replace with: `COPY --from=mows-bin --chmod=755 /mows /usr/local/bin/mows` and remove the `chmod` from the subsequent `RUN` line (keep only the `ln -sf`). This applies to all three Dockerfiles.

---

**ID:** TECH-INFRA-13
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/debian.Dockerfile:44-57` (and `ubuntu.Dockerfile:33-47`)
**Issue:** `apt-get update` is run in a separate `RUN` instruction from the `apt-get install` that follows it in the Node and Docker layers (lines 60-63, 75-78). The update cache is not preserved across layers and must be re-downloaded each time.
**Why it matters:** Each `RUN apt-get update && apt-get install ...` pair is correct and self-contained, which is the standard practice — but lines 60-63 and 75-78 each start a fresh `apt-get update` followed immediately by install and `rm -rf /var/lib/apt/lists/*`. This is actually correct. However, the first base-layer block (lines 44-57) installs everything in one `RUN`, cleans the list, and that is correct. The real issue is: node+pnpm and docker each add a separate `apt-get update` + `apt-get install` + `rm -rf` triple, tripling the number of metadata downloads in CI where cache is cold. These could be merged into a single layer without sacrificing cache granularity, since they are not independently useful.
**Suggestion:** Merge the Node and Docker `apt-get` layers into the base install layer, or accept the current structure as a deliberate cache-optimization trade-off and document it. If merging, ensure `rm -rf /var/lib/apt/lists/*` appears only at the end.

---

**ID:** TECH-INFRA-14
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:136` (and `debian.Dockerfile:129`, `ubuntu.Dockerfile:109`)
**Issue:** `find / -xdev -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} + 2>/dev/null || true` silently swallows all errors from the mtime-stamping step.
**Why it matters:** The `|| true` means that if `touch` fails on critical files (e.g. due to permissions inside the build container), the build continues and the resulting image has non-reproducible mtimes without any diagnostic output. The `2>/dev/null` suppresses the expected "operation not permitted" errors on virtual filesystems (which is fine), but combined with `|| true` it also hides unexpected errors on real files.
**Suggestion:** Separate the two concerns: redirect stderr to /dev/null to suppress expected VFS errors, but do not use `|| true` which hides real failures:
```sh
find / -xdev -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} + 2>/dev/null
```
(Remove `|| true`.) The `find` exit code will be non-zero only if `touch` fails on a file that was actually found and accessible, which is a real error.

---

**ID:** TECH-INFRA-15
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:68`
**Issue:** `pnpm@9` is pinned to a major version only: `npm install -g --no-audit --no-fund pnpm@9`. The same applies in `debian.Dockerfile:62` and `ubuntu.Dockerfile:52`.
**Why it matters:** `pnpm@9` resolves to the latest `9.x.y` release at build time. Two builds on different days may pull different patch versions, silently breaking the reproducibility contract.
**Suggestion:** Pin to an exact version such as `pnpm@9.15.4` (verify the current latest with `npm view pnpm dist-tags.latest`). Add a comment indicating when to update.

---

**ID:** TECH-INFRA-16
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/nixos.Dockerfile:54` (packer stage)
**Issue:** The NixOS packer `RUN set -eux` inline script uses a `while read path` loop without `read -r`, so backslash sequences in store paths would be incorrectly interpreted.
**Why it matters:** Nix store paths are content-addressed hashes and in practice never contain backslashes, but omitting `-r` is a Bash/sh idiom violation that could bite if the format ever changes. Additionally, the `while read` without `-r` is flagged by `shellcheck`.
**Suggestion:** Change `while read path` to `while IFS= read -r path`.

---

## Findings — SQL migrations

---

**ID:** TECH-INFRA-17
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0002_vm_resources.sql:5-6`
**Issue:** The two new columns (`cpus`, `memory_mb`) are added as nullable with no default value and no `CHECK` constraint, but the comment says "NULL means we didn't record this — render server defaults instead".
**Why it matters:** Without a `CHECK` constraint, nothing prevents storing `cpus = 0` or `memory_mb = -1`, which are logically invalid values. The code that reads these columns must handle both NULL and nonsensical integer values. Also, future `NOT NULL` migrations on these columns will require a `DEFAULT` clause anyway, and adding it now is simpler.
**Suggestion:** Add `CHECK` constraints: `ADD COLUMN cpus INTEGER CHECK (cpus IS NULL OR cpus > 0)` and `ADD COLUMN memory_mb INTEGER CHECK (memory_mb IS NULL OR memory_mb >= 128)`. Document the minimum accepted value in the comment.

---

**ID:** TECH-INFRA-18
**Severity:** Major
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0003_vm_image_display.sql:6-7`
**Issue:** `image` and `display_mode` are added as `NOT NULL` with `DEFAULT` values but without `CHECK` constraints enforcing the documented enum values (`{'alpine','ubuntu','debian','nixos'}` and `{'headless','desktop'}`).
**Why it matters:** Any application code (or a future migration) can write `image = 'windows'` or `display_mode = 'rdp'` and the database will accept it silently. The supervisor's `locate_image()` function and enum parsing will then fail at runtime rather than at the persistence layer. The valid values are already documented in the comment — they should be enforced.
**Suggestion:** Add `CHECK` constraints:
```sql
ALTER TABLE vms ADD COLUMN image TEXT NOT NULL DEFAULT 'alpine'
    CHECK (image IN ('alpine','ubuntu','debian','nixos'));
ALTER TABLE vms ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'headless'
    CHECK (display_mode IN ('headless','desktop'));
```

---

**ID:** TECH-INFRA-19
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0002_vm_resources.sql` and `0003_vm_image_display.sql`
**Issue:** Neither migration has a corresponding down migration (rollback SQL).
**Why it matters:** `ALTER TABLE ... ADD COLUMN` is not directly reversible in SQLite (which lacks `DROP COLUMN` in older versions, though SQLite 3.35+ supports it). Without documented rollback steps, reverting a bad deployment requires manual schema surgery or restoring from a backup. This is especially relevant because the service stores ephemeral state (VM PIDs, SSH ports) that cannot be reconstructed.
**Suggestion:** Add a rollback block as a comment at the bottom of each migration file:
```sql
-- Down migration (SQLite 3.35+):
-- ALTER TABLE vms DROP COLUMN cpus;
-- ALTER TABLE vms DROP COLUMN memory_mb;
```
If the migration runner supports it, add a formal `-- migrate:down` section.

---

**ID:** TECH-INFRA-20
**Severity:** Minor
**File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0002_vm_resources.sql:5-6`
**Issue:** No index is added for the new `cpus` and `memory_mb` columns, and no index exists on `vms(name)` in the base schema (`0001_init.sql`), even though lookups by name are likely in the supervisor's list/detail queries.
**Why it matters:** For the resource columns specifically, if dashboards or API endpoints ever query `WHERE cpus > N` or sort by `memory_mb`, the missing index causes a full table scan. This is a minor concern for a small table but a habit-of-practice issue.
**Suggestion:** Consider `CREATE INDEX IF NOT EXISTS vms_name_idx ON vms(name);` in `0001_init.sql` (or a new migration) for name lookups. For resource columns, indexes are only warranted if range queries are planned; note this in a comment if they are not needed today.
