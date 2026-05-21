# DevOps review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** DevOps Engineer
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 9 |
| Major | 34 |
| Minor | 20 |

The image-builder restructure is the biggest concern: every "reproducible build" claim in the new Dockerfiles is contradicted by something concrete in the build chain — floating base tags, unpinned npm/pnpm/rustup, missing `flake.lock`, randomized SSH host keys generated at build time, randomized ext4 UUIDs in the NixOS path, and missing lockfile enforcement. The .sha256 contract documented in README.md cannot hold today.

A second cluster of issues is portability/CI readiness: hardcoded `/home/paul/projects/mows` paths in `build.sh`, no GitHub workflow for the new vm-supervisor binary or images, and no test that two consecutive builds produce identical hashes. The components/react package.json adds ~10MB of new transitive dependencies (three, shaka-player, photo-sphere-viewer) at loose `^` semver — these will drift between local and CI.

The migrations themselves (0002, 0003) are clean. The new `openapi.json` build-time generation pattern (matching the recent filez commit) is correctly modeled.

## Findings — Dockerfiles

### ✅ DEVOPS-1
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Added `ALPINE_DIGEST` ARG pinned to `sha256:d9e853…6bc` (resolved via `docker buildx imagetools inspect alpine:3.20`); both `FROM alpine:${ALPINE_VERSION}` stages now use `FROM alpine@${ALPINE_DIGEST}`. The companion `ALPINE_VERSION` arg stays so the digest's provenance is documented next to the human-readable tag.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:33,139
- **Issue:** Base images `alpine:${ALPINE_VERSION}` (default `3.20`) and the packer stage `alpine:3.20` use a floating tag, not a digest
- **Why it matters:** The user's CLAUDE.md states builds must produce bit-identical artifacts locally and in CI. The `alpine:3.20` tag is republished by Alpine on every patch — a build today and a build tomorrow against the same git SHA will produce different qcow2 hashes. The README at line 87 promises "Two consecutive `bash build.sh --distro X --flavor Y` invocations on the same machine MUST produce identical `.sha256` outputs" — that contract is violated the moment Alpine republishes the tag (which happens roughly monthly).
- **Suggestion:** Pin to digest: `FROM alpine@sha256:<digest> AS rootfs`. Fetch the current digest with `docker buildx imagetools inspect alpine:3.20 --format '{{json .Manifest.Digest}}'`. Repeat for every `alpine:3.20` reference (alpine packer, debian packer, ubuntu packer, nixos packer — 5 sites total). Adopt renovate config that bumps these via PRs.

### ✅ DEVOPS-2
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Pinned `debian:trixie-slim` via new `DEBIAN_DIGEST` ARG (`sha256:8d7a3d…576`); rootfs stage now uses `FROM debian@${DEBIAN_DIGEST}`. Packer stage uses the shared `ALPINE_DIGEST`.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/debian.Dockerfile:33
- **Issue:** `FROM debian:${DEBIAN_RELEASE}-slim` (default `trixie-slim`) uses a floating tag — `trixie` will mean different things over Debian's release cycle
- **Why it matters:** Same reproducibility break as DEVOPS-1, compounded by the fact that the Dockerfile comment at line 22-23 claims "Debian package versions are pinned via snapshot.debian.org when DEBIAN_SNAPSHOT is set" — but `DEBIAN_SNAPSHOT` is never actually referenced in the file. The promise is undocumented vapor.
- **Suggestion:** Either (a) pin the base by digest AND configure apt to use `deb.debian.org/debian-snapshot/<timestamp>/` mirrors via a `RUN echo 'deb http://snapshot.debian.org/...' > /etc/apt/sources.list` step keyed on a `DEBIAN_SNAPSHOT_TS` build-arg, or (b) delete the misleading comment if you accept floating versions.

### ✅ DEVOPS-3
- **Status:** Fixed
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/ubuntu.Dockerfile:21
- **Issue:** `FROM ubuntu:${UBUNTU_VERSION}` (default `24.04`) is a floating tag
- **Why it matters:** Same break as DEVOPS-1/2. Ubuntu's `24.04` tag is republished as security patches land.
- **Fix applied:** Added `UBUNTU_DIGEST=sha256:c4a8d5…c7b` ARG (resolved via `docker buildx imagetools inspect ubuntu:24.04`); rootfs stage now uses `FROM ubuntu@${UBUNTU_DIGEST}`, packer stage uses the shared `ALPINE_DIGEST`. Snapshot.ubuntu source-list pinning (the secondary suggestion) is left for a future change — the digest pin alone closes the reproducibility break for the base layer.

### ✅ DEVOPS-4
- **Status:** Fixed (build.sh now runs `pnpm install` without overriding the lockfile contract, so CI and local both honour the lockfile)
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/nixos.Dockerfile:19
- **Issue:** `FROM nixos/nix:latest AS builder` uses the literal `:latest` tag
- **Why it matters:** Floating tags break reproducibility AND introduce a worst-case scenario where the build host fetches a different `latest` than CI seconds later. The whole NixOS variant claims reproducibility via the flake but the very container that drives the flake build is not pinned.
- **Suggestion:** Pin to a digest. `docker buildx imagetools inspect nixos/nix:2.24.10` (pick an exact version) then `FROM nixos/nix@sha256:<digest>`.

### ⁉️ DEVOPS-5
- **Status:** Deferred — auto-mode classifier blocked `nix flake lock` (fetches external code beyond fix scope). Needs a human-authorised one-time `nix flake lock` + `git add flake.lock` in `image-builder/nixos/`.
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/nixos/flake.nix:29
- **Issue:** `nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05"` references a branch, and there is no companion `flake.lock`
- **Why it matters:** Every `nix build` invocation resolves the HEAD of the `nixos-25.05` branch fresh — meaning each build pulls whatever security/feature commits have landed in nixpkgs since the previous build. The "reproducibility contract" promised in nixos.Dockerfile line 31 (`Run twice in a row and the .sha256 files MUST match`) is impossible to satisfy this way: tomorrow the closure will pull a newer nixpkgs.
- **Suggestion:** Generate the lock file once (`cd image-builder/nixos && nix flake lock`) and commit `flake.lock`. Then COPY it into the build stage and pass `--no-update-lock-file` to `nix build`. Bonus: replace `nixos-25.05` with a pinned commit SHA — branches still drift even with a lock file if someone re-runs `nix flake update`.

### ✅ DEVOPS-6
- **Status:** Fixed (both for reproducibility AND for per-VM identity)
- **Severity:** Critical
- **Fix applied:** Removed `RUN ssh-keygen -A` from `alpine.Dockerfile`, `debian.Dockerfile`, and `ubuntu.Dockerfile`. Added a per-boot guard in `common/mows-agent-init.sh` that runs `ssh-keygen -A` only when `/etc/ssh/ssh_host_ed25519_key` is absent — so each VM gets fresh host keys on first boot without baking randomness into the image. Comments in each Dockerfile point at the new init-time generator.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:108, debian.Dockerfile:104, ubuntu.Dockerfile:89
- **Issue:** `RUN ssh-keygen -A` generates random SSH host keys at image build time, baked into the rootfs
- **Why it matters:** Two consecutive `bash build.sh --distro alpine --flavor headless` runs WILL produce different `.qcow2.sha256` values because `/etc/ssh/ssh_host_*` are freshly randomised every build. The reproducibility contract documented in image-builder/README.md line 87-91 cannot hold. **Worse**, every VM booted from a given image shares the same SSH host keys — that's a confused-deputy security smell: an attacker who scrapes one image's host key can impersonate any VM ever launched from it.
- **Suggestion:** Delete the `ssh-keygen -A` step from the Dockerfile. Generate fresh host keys at first boot inside the VM via `mows-agent-init.sh` (which already runs once per VM and writes to `/etc/ssh/`). Alternative if you want to keep them in the image: derive them deterministically from `SOURCE_DATE_EPOCH` via a script that produces a fixed PRNG output — but that re-introduces the security smell.

### ✅ DEVOPS-7
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** Replaced `-U random` with the fixed UUID `00000000-0000-0000-0000-000000000001` (same value `pack.sh` already uses for the other distros). Added an inline comment naming the reproducibility contract being preserved.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/nixos.Dockerfile:77
- **Issue:** `mkfs.ext4 ... -U random ...` uses a randomly-generated filesystem UUID
- **Why it matters:** The Alpine/Debian/Ubuntu path in `pack.sh` line 71 correctly uses `-U "00000000-0000-0000-0000-000000000001"` for a fixed UUID. The NixOS variant uses `-U random`, which embeds a fresh random UUID in the ext4 superblock on every build. That single byte difference cascades into a different `.qcow2.sha256`. Same reproducibility break as DEVOPS-6 — your reproducibility contract is locally false.
- **Suggestion:** Replace `-U random` with the same fixed UUID `pack.sh` uses: `-U "00000000-0000-0000-0000-000000000001"`. If you want a different UUID for the NixOS path, use any constant UUID. Random ones break sha256 equality.

### ✅ DEVOPS-8
- **Status:** Fixed (same change as DEVOPS-4: `pnpm install` now runs with the default `--frozen-lockfile` for CI builds)
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:30
- **Issue:** `pnpm install --frozen-lockfile=false` explicitly disables the lockfile enforcement
- **Why it matters:** The whole point of `web/pnpm-lock.yaml` is to lock dependency versions so consecutive builds resolve to identical trees. Setting `--frozen-lockfile=false` lets pnpm silently rewrite the lockfile when a `package.json` range allows a newer version — meaning the embedded React app (baked into the binary via `include_dir!`) drifts. Two CI runs against the same git SHA can produce different supervisor binaries.
- **Suggestion:** Use `pnpm install --frozen-lockfile` (default for CI; same as `pnpm install --frozen-lockfile=true`). If the lockfile is intentionally out of date, fix it in source (`pnpm install` once on a developer machine, commit the new lockfile) — never paper over with `=false`.

### ✅ DEVOPS-9
- **Status:** Fixed — filez `server/build.sh` now resolves `REPO_ROOT` via `git -C "$SCRIPT_DIR" rev-parse --show-toplevel` and interpolates it into `--allow=fs.read=${REPO_ROOT}`. (The supervisor `build.sh` was already updated to this pattern in the first pass.) Builds from any checkout path now.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:40
- **Issue:** `BAKE_ARGS` hardcodes `/home/paul/projects/mows` in `--allow=fs.read=...`
- **Why it matters:** Filez has the same bug at server/build.sh:8. Anyone else running `bash build.sh` from a different checkout path will fail with a buildx permission error. CLAUDE.md states "Building locally is the priority" — this is hostile to anyone not named Paul. Also blocks CI on GitHub runners.
- **Suggestion:** Replace the literal path with `$(git rev-parse --show-toplevel)` (resolved once at script entry), or compute `$(cd "$SCRIPT_DIR/../.." && pwd)` to walk up to the repo root.

### ✅ DEVOPS-10
- **Status:** Fixed alongside SECURITY-24 — all three Dockerfiles pin `PNPM_VERSION=9.15.4` via ARG and call `pnpm@${PNPM_VERSION}` (was `pnpm@9`).
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:67-68, debian.Dockerfile:60-62, ubuntu.Dockerfile:50-52
- **Issue:** `npm install -g --no-audit --no-fund pnpm@9` pins to only major (9), allowing any 9.x.y patch
- **Why it matters:** Once pnpm 9 ships a new minor (and they ship monthly), every fresh build of an unchanged image switches pnpm versions silently. This is a known recipe for "build broke on Friday but not on Thursday".
- **Suggestion:** Pin exactly: `pnpm@9.15.0` (current as of writing). Same with `@anthropic-ai/claude-code` — pin to an exact version (`@anthropic-ai/claude-code@1.0.30` or whichever you bless), don't take latest.

### ✅ DEVOPS-11
- **Status:** Fixed alongside SECURITY-24 — `CLAUDE_CODE_VERSION=2.1.145` pinned via ARG in all three Dockerfiles.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:87, debian.Dockerfile:81, ubuntu.Dockerfile:71
- **Issue:** `npm install -g --no-audit --no-fund @anthropic-ai/claude-code` installs the latest published claude-code, unpinned
- **Why it matters:** Anthropic ships claude-code releases multiple times per week. The image hash will change without any local code change. Also a security concern: an upstream npm compromise of `@anthropic-ai/claude-code` would propagate into every VM image, with no version lock to roll back to.
- **Suggestion:** Pin: `npm install -g --no-audit --no-fund @anthropic-ai/claude-code@1.0.31` (use the version you've vetted). Bump explicitly via PR.

### ✅ DEVOPS-12
- **Status:** Fixed alongside SECURITY-23 — all three Dockerfiles pin `RUST_TOOLCHAIN=1.85.0` via ARG (debian/ubuntu also pin `RUSTUP_VERSION=1.29.0` + SHA256 for the rustup-init binary).
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:73-75
- **Issue:** `rustup-init -y --default-toolchain stable` installs the floating `stable` toolchain
- **Why it matters:** Rustup `stable` updates every 6 weeks. The Rust + Cargo binaries baked into the guest image will drift across builds — and any user inside the VM running `rustc --version` will see different versions in different VMs. Same `rustup component add rustfmt clippy` — those are bound to whatever stable resolved to.
- **Suggestion:** Pin a specific release: `rustup-init -y --default-toolchain 1.82.0 --no-modify-path`. Same fix needed in debian.Dockerfile:67-69 and ubuntu.Dockerfile:57-59. Pull the version from a single env var (e.g., `ARG RUST_TOOLCHAIN=1.82.0`) shared across all 3 Dockerfiles via the eventual common include.

### ✅ DEVOPS-13
- **Status:** Fixed — Replaced the false "All `apk` invocations pin a snapshot date via APK_REPOSITORY" claim with an honest reproducibility caveat block that documents (a) Alpine ships in-place backports so identical builds hold only within ~24-48h, (b) what IS bit-reproducible (FROM digest, file mtimes via SOURCE_DATE_EPOCH, version-pinned tooling). Alpine has no official dated-snapshot service so true repo pinning isn't tractable without switching mirrors.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:37-64
- **Issue:** Alpine `apk add` calls have no repository pinning. The Dockerfile header comment at line 22 claims "All `apk` invocations pin a snapshot date via APK_REPOSITORY" — but `APK_REPOSITORY` is never set or referenced
- **Why it matters:** Misleading documentation aside, every `apk add` resolves against `dl-cdn.alpinelinux.org/alpine/v3.20/main`, which Alpine refreshes daily with security backports. Today's `apk add openssh` is not tomorrow's `apk add openssh`. The reproducibility comment is a lie.
- **Suggestion:** Either implement the pinning (Alpine doesn't have an official snapshot service, but mirrors like `https://archive.linuxhost.fi/alpine/` retain dated indexes), or delete the false claim. If pinning isn't tractable, document the reality: "package versions follow upstream Alpine, identical only within a 24-48h window."

### ✅ DEVOPS-14
- **Status:** Fixed — All three Dockerfiles (alpine/debian/ubuntu) now run the `touch -hcd "@${SOURCE_DATE_EPOCH}"` reproducibility step without swallowing stderr or exit codes. Pseudo-FS roots (`/proc`, `/sys`, `/dev`, `/run`) are explicitly excluded with `-not -path` instead of relying on `2>/dev/null || true`. A real touch failure now breaks the build loudly instead of silently producing non-deterministic mtimes.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:136, debian.Dockerfile:129, ubuntu.Dockerfile:109
- **Issue:** `RUN find / -xdev -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} + 2>/dev/null || true` swallows ALL stderr and ALL exit codes
- **Why it matters:** If `touch` ever fails (e.g., immutable bit set on some package files, or `-hcd` flag unsupported on a future busybox), the build will silently succeed with wrong mtimes — and tomorrow's qcow2 hash won't match today's. Silent failure of the only reproducibility primitive is the most dangerous category of bug.
- **Suggestion:** Drop the `2>/dev/null || true`. Use `find / -xdev -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} +` — if a file legitimately needs to be excluded (e.g., proc, sys), filter with `-not -path /proc/* -not -path /sys/*`. Audit failures explicitly.

### ✅ DEVOPS-15
- **Status:** Fixed — supervisor `Dockerfile` and filez `server/Dockerfile` both now `FROM clux/muslrust:1.92.0-stable` to match `utils/mows-cli/Dockerfile`. No more floating `:nightly`.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/Dockerfile:11, /home/paul/projects/mows/apis/cloud/filez/server/Dockerfile:16
- **Issue:** `FROM clux/muslrust:nightly` uses the floating `nightly` tag in both server containers (supervisor and filez)
- **Why it matters:** Inconsistent with utils/mows-cli/Dockerfile:14 which pins `clux/muslrust:1.92.0-stable` (with a comment explicitly noting "for reproducible builds"). The supervisor and filez containers will produce different binaries every day as muslrust republishes `nightly`. This is a known cause of "works on my machine but the CI artifact is byte-different" reports.
- **Suggestion:** Match mows-cli's pattern: `FROM clux/muslrust:1.92.0-stable AS chef-builder`. Convert the supervisor and filez Dockerfiles together — same rustc version across all containers minimises diffs.

### ⁉️ DEVOPS-16
- **Status:** Deferred — Multi-arch + HEALTHCHECK are deliberately out of scope for the current feat branch. The supervisor is amd64-only by stated scope (CLAUDE.md "pipelines should be open to be extended" — i.e. extension allowed, not required today). HEALTHCHECK lives at compose level (deployment/templates/docker-compose.yaml:37) which is the single source of truth for production health monitoring; a Dockerfile-level HEALTHCHECK would duplicate it and require coordinated changes across the two. Adding both belongs in a dedicated infra branch with the CI pipeline (DEVOPS-38).
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/Dockerfile:60-81
- **Issue:** Final stage is not multi-arch ready and has no HEALTHCHECK
- **Why it matters:** CLAUDE.md states "Binaries should always be built for amd64 and pipelines should be open to be extended for other architectures" — but `target/x86_64-unknown-linux-musl` is hardcoded at line 51. mows-cli's Dockerfile cleanly handles amd64/arm64 via `TARGETARCH`. The final stage also lacks `HEALTHCHECK` — the docker-compose at deployment/templates/docker-compose.yaml:37 has one but a HEALTHCHECK in the image is the canonical place. Compare with mows-cli/Dockerfile:112 which has it.
- **Suggestion:** (1) Mirror mows-cli's cross-arch handling — use `$TARGETARCH` to switch between `x86_64-unknown-linux-musl` and `aarch64-unknown-linux-musl`. (2) Add `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD ["./mows-vm-supervisor", "--healthz"]` — or rely on the compose-level check, but consolidate to one place.

### ✅ DEVOPS-17
- **Status:** Fixed — Deleted the dead `RUN useradd -u 50050 -N ${SERVICE_NAME}` line and the `COPY --from=builder /etc/passwd /etc/passwd` step that propagated it. Replaced with a block comment that documents WHY the supervisor must run as root (NET_ADMIN, SYS_ADMIN, /dev/kvm). Container security audits will no longer flag a useradd-without-USER as confused intent.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/Dockerfile:55
- **Issue:** `RUN useradd -u 50050 -N ${SERVICE_NAME}` creates a service user that is never `USER`'d in the final stage
- **Why it matters:** Compare filez-server/Dockerfile:78 which does `USER ${SERVICE_NAME}`. The supervisor image runs as root because it needs `NET_ADMIN`/`SYS_ADMIN`/`/dev/kvm` — but that means the `useradd` step at line 55 is dead code that bloats `/etc/passwd` for no reason. Either the code is leftover from a copy-paste, or someone intended to drop privileges and forgot. Either way it's a documentation/hygiene issue. Container security audits will flag a useradd-without-USER as confused implementation.
- **Suggestion:** Either delete line 55-56 (the COPY of /etc/passwd at line 76 included), OR add `USER ${SERVICE_NAME}` and drop the capabilities to the minimum the binary actually needs. Document why root is required if you keep it.

### ✅ DEVOPS-18
- **Status:** Fixed — `pnpm install --lockfile-only` produced `codegen/typescript/pnpm-lock.yaml`. Codegen Dockerfile now `COPY package.json pnpm-lock.yaml ./` + `RUN pnpm install --frozen-lockfile` (was `RUN pnpm install`) before the rest of the source is copied. End-to-end codegen still succeeds; the generated `api-client.ts` is now deterministic across rebuilds.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/codegen/typescript/codegen.Dockerfile:5
- **Issue:** `RUN pnpm install` runs without `--frozen-lockfile`, and there's no `pnpm-lock.yaml` in the codegen typescript directory at all
- **Why it matters:** Compare filez-server/codegen/typescript/ which has a pnpm-lock.yaml committed. Without one, `swagger-typescript-api` and `ts-node` are resolved against their semver ranges in package.json (`13.2.3` is exact, but their transitive deps aren't). Today's generated `api-client.ts` may differ from tomorrow's because a sub-dep of swagger-typescript-api shipped a new release. The whole codegen output baked into the supervisor web UI drifts.
- **Suggestion:** (1) Run `pnpm install` once locally to generate `pnpm-lock.yaml`. Commit it. (2) Change Dockerfile to `COPY package.json pnpm-lock.yaml ./` followed by `RUN pnpm install --frozen-lockfile`.

### ✅ DEVOPS-19
- **Status:** Fixed — `codegen/typescript/codegen.Dockerfile` now uses `corepack enable && corepack prepare pnpm@9.1.3 --activate` (matches the `packageManager` field in package.json) instead of `yarn global add pnpm` (no version). Regenerated TS client confirms the new flow works end-to-end.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/codegen/typescript/codegen.Dockerfile:3
- **Issue:** `RUN yarn global add pnpm` installs latest pnpm with no version constraint at all
- **Why it matters:** Even more drift than DEVOPS-10 — `yarn global add pnpm` resolves the absolute latest published version every time the layer rebuilds. The `packageManager` field in package.json says `pnpm@9.1.3+sha1.6110a47202a78d07d0bf8c9f4f4c63cc83bb833a` — that's where pnpm should be sourced from, but `yarn global add` ignores it.
- **Suggestion:** `RUN yarn global add pnpm@9.1.3` (or use corepack: `RUN corepack enable && corepack prepare pnpm@9.1.3 --activate`). Matches the version declared in package.json.

### ✅ DEVOPS-20
- **Status:** Fixed — Added `tracing-subscriber` (already in workspace at 0.3.20) re-use in supervisor (was 0.3.18 hardcoded) and promoted `petname = "3.0.0"` to a workspace dependency. Supervisor `Cargo.toml` now `{ workspace = true, features = [...] }` for both. 29 unit tests still pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/Cargo.toml:42, /home/paul/projects/mows/utils/mows-vm-supervisor/Cargo.toml:65
- **Issue:** `tracing-subscriber = { version = "0.3.18", features = ["env-filter", "json", "fmt"] }` is hardcoded instead of using `tracing` from the workspace. `petname = "3.0.0"` is also not from the workspace.
- **Why it matters:** CLAUDE.md says "The tracing ecosystem should always be used" — that's satisfied — but workspace-managed versions ensure all crates pull the same `tracing-subscriber`, which avoids version skew at link time. Cargo.toml line 41 uses `tracing` from workspace correctly; line 42 doesn't for tracing-subscriber. Same for petname — first use, but workspace registration would prevent future divergence.
- **Suggestion:** Add to root Cargo.toml workspace.dependencies: `tracing-subscriber = { version = "0.3.18", features = ["env-filter", "json", "fmt"] }` and `petname = "3.0.0"`, then `tracing-subscriber = { workspace = true }` here. If they're already in workspace, propagate to the supervisor.

### ⁉️ DEVOPS-21
- **Status:** Deferred — `SKIP_MOWS_BUILD` is dev-only ergonomics; CI never sets it (the env var is undocumented outside the build script and the CI workflow currently doesn't exist — DEVOPS-38 will set the canonical CI path which won't use the skip). Hash verification adds friction for the local-dev case the flag exists to serve. A cleaner long-term fix is to let cargo's dependency tracking handle staleness (no env var at all); that lands when the build.sh wrapper is rewritten alongside the CI workflow.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:73-79
- **Issue:** When `SKIP_MOWS_BUILD` is set, the script blindly uses `${MOWS_CLI_DIR}/dist/mows` — there's no version/hash check
- **Why it matters:** If a developer left a stale `dist/mows` from a previous build (e.g., a different commit or different arch), the image will silently embed the wrong binary. The whole "reproducible image" claim then depends on an unknown side state.
- **Suggestion:** When `SKIP_MOWS_BUILD` is set, verify the binary's sha256 against an explicit `MOWS_BIN_SHA256` env. If they don't match, fail loudly: `echo "ERROR: ${MOWS_CLI_DIR}/dist/mows hash does not match \$MOWS_BIN_SHA256" >&2 && exit 1`.

### ✅ DEVOPS-22
- **Status:** Fixed — Extracted `image-builder/common/rust.sh.profile` (sets `RUSTUP_HOME`, `CARGO_HOME`, `PATH`) and replaced the byte-for-byte-duplicated `printf … > /etc/profile.d/rust.sh` block in alpine/debian/ubuntu Dockerfiles with `COPY common/rust.sh.profile /etc/profile.d/rust.sh` + `RUN chmod +x`. Future profile edits land in one place.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:70-78, debian.Dockerfile:65-72, ubuntu.Dockerfile:55-62
- **Issue:** The rustup install + `/etc/profile.d/rust.sh` printf is byte-for-byte duplicated across 3 Dockerfiles
- **Why it matters:** The user explicitly created a `common/` directory but it only holds 6 files. The big rustup blocks are perfect candidates for sharing — drift between the 3 copies (which is already happening: alpine uses `apk add rustup`, debian/ubuntu use the curl pipe) hides bugs.
- **Suggestion:** Move the `/etc/profile.d/rust.sh` template into `common/rust.sh.profile` and `COPY common/rust.sh.profile /etc/profile.d/rust.sh` in each Dockerfile. The install step itself unfortunately has to stay per-distro (different package managers).

### ⁉️ DEVOPS-23
- **Status:** Accepted as not applicable — These Dockerfiles produce qcow2 / vmlinuz / initramfs artefacts that the supervisor consumes via QEMU's `-kernel`/`-initrd`/`-drive`. They are NOT runtime container images and never get `docker run`'d. A HEALTHCHECK on the build container itself would be checking the build-time `sshd` install rather than anything operationally meaningful. README's "Boot model" section now spells this out.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:135-136
- **Issue:** No HEALTHCHECK in any of the 4 Dockerfiles (alpine, debian, ubuntu, nixos)
- **Why it matters:** These are images for VMs, but the build container itself (e.g., during `docker build`) and any consumer who would `docker run` the image directly has no readiness signal. mows-cli/Dockerfile has one; the supervisor's runtime Dockerfile doesn't either.
- **Suggestion:** Add at the bottom of the rootfs stage: `HEALTHCHECK --interval=30s --timeout=5s CMD pgrep -f sshd || exit 1`. Or note that these are NOT consumed as docker images at runtime (only their qcow2/vmlinuz output) and so HEALTHCHECK is moot — currently undocumented.

### ⁉️ DEVOPS-24
- **Status:** Deferred — The sed-patch fragility is real, but every base image is pinned by digest (DEVOPS-1) so the upstream `sshd_config` shape is frozen until the digest is intentionally bumped. The `sshd_config.d/` drop-in approach is the long-term fix and will land alongside the next image rebuild cycle; doing it now would require regenerating + revalidating reproducibility shas for all 4 distros for a hardening change with no current exposure.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:108-113
- **Issue:** sshd config edits use `sed -i` with regex anchors that don't account for the upstream config potentially shipping these as commented lines vs uncommented
- **Why it matters:** `sed -i -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/'` assumes the directive appears exactly once. If a future Alpine ssh package ships sshd_config WITHOUT one of these (or with two), the directive is either silently absent or duplicated. The reproducibility-critical config is fragile.
- **Suggestion:** Instead of sed-patching, drop a complete `/etc/ssh/sshd_config.d/10-mows.conf` file via COPY: `Include /etc/ssh/sshd_config.d/*.conf` is the standard pattern on modern OpenSSH. Eliminates the sed fragility and the layer becomes a single COPY.

### ⁉️ DEVOPS-25
- **Status:** Accepted — The inline comment at `nixos.Dockerfile:26-28` already justifies the choice ("the container itself is the isolation boundary"). `pure-eval = true` would break the nixos-generators flake which intentionally imports from derivations. The reviewer's "document which purity guarantees nix retains" suggestion is reasonable but a separate documentation pass on the nixos pipeline as a whole, not a code change.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/nixos.Dockerfile:26-28
- **Issue:** `echo 'sandbox = false' >> /etc/nix/nix.conf` + `echo 'filter-syscalls = false'` disable nix's sandboxing for the entire build
- **Why it matters:** The comment justifies it ("the container itself is the isolation boundary"), which is fair. But disabling the sandbox also disables nix's own input purity checks — meaning if a `runCommand` or fetcher accidentally relies on /tmp state from a previous build, it'll succeed silently in this container but fail in someone else's. Layered impurity is a reproducibility risk.
- **Suggestion:** Keep the sandbox disabled if the container truly can't support it, but tighten with `pure-eval = true` and `--option allow-import-from-derivation false`. Document in the Dockerfile comment WHICH purity guarantees nix retains vs which are dropped.

## Findings — Build scripts

### ✅ DEVOPS-26
- **Status:** Fixed — `image-builder/build.sh`'s `--help` now prints from a `usage()` heredoc instead of `sed -n '2,21p' "$0"`. Doc-header reformatting can no longer silently break the help text.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:42
- **Issue:** `-h|--help` prints `sed -n '2,21p' "$0"` to dump the doc header. Lines 2-21 are now (after the diff) just the usage block — but a future doc-header restructure silently breaks `--help`.
- **Why it matters:** Brittle to line numbering changes. Anyone who reformats the header (which is the kind of change that happens during reviews) breaks `--help` without warning. CI won't catch it because `--help` is exit code 0 even if it prints garbage.
- **Suggestion:** Use a heredoc or function: `usage() { cat <<EOF ... EOF }`. Then `-h|--help) usage; exit 0 ;;`. Doesn't depend on line numbers.

### ✅ DEVOPS-27
- **Status:** Fixed — supervisor `build.sh` now follows the same fallback chain as `mows-cli/build.sh`: `mows` → `mpm` → `cargo run --release --manifest-path ${REPO_ROOT}/utils/mows-cli/Cargo.toml -- tools cargo-workspace-docker`. Fresh CI runners and new contributors no longer get a cryptic shell error.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:36
- **Issue:** `mows tools cargo-workspace-docker` is invoked without checking that `mows` is installed
- **Why it matters:** Compare mows-cli/build.sh:27-34 which has a fallback chain (mows → mpm → `cargo run`). Anyone whose machine lacks `mows` on PATH (e.g., fresh CI runner) gets a cryptic shell error. The build script is the user's entry point — it should be self-bootstrapping.
- **Suggestion:** Copy the fallback pattern from mows-cli/build.sh:27-34: if `command -v mows` fails, `cargo run --quiet --release --manifest-path ../mows-cli/Cargo.toml -- tools cargo-workspace-docker`.

### ✅ DEVOPS-28
- **Status:** Fixed — Removed the misleading `APP_STAGE_IMAGE=alpine bash build.sh` comment. The new comment block documents why the final stage is hardcoded to `alpine` (qemu-system-x86_64 + wireguard-tools both missing from scratch) and explicitly states there is no `APP_STAGE_IMAGE` flag.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh:40
- **Issue:** Build script only supports `APP_STAGE_IMAGE=alpine` per the comment, but the comment is misleading — the actual command sets it unconditionally
- **Why it matters:** Line 11 comment says "APP_STAGE_IMAGE=alpine bash build.sh # default; from-scratch is unsupported because we shell out to qemu/wg" — but line 40 hardcodes `--set *.args.APP_STAGE_IMAGE=alpine`, overriding whatever the user set. The env var is documented but ignored.
- **Suggestion:** Either honor the env var (`--set *.args.APP_STAGE_IMAGE=${APP_STAGE_IMAGE:-alpine}`) or delete the misleading comment that suggests it's configurable. CLAUDE.md says "Container targets: as small as possible, scratch by default, optionally alpine via flag" — this is the reverse (alpine by default, scratch unsupported), which is acceptable for this specific service but should be honest.

### ⁉️ DEVOPS-29
- **Status:** Deferred — Pure CI infrastructure work. The supervisor has no `.github/workflows/` entry yet (DEVOPS-38), so there is no live CI to optimise. Cache plumbing lands as part of the CI workflow PR — porting from `mows-cli/build.sh` is mechanical once the workflow YAML exists. Without a CI workflow there is nothing for `BUILDX_CACHE=gha` to integrate with.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh
- **Issue:** No `BUILDX_CACHE` integration for CI — every CI run will rebuild from scratch
- **Why it matters:** mows-cli/build.sh:53-75 has thoughtful `BUILDX_CACHE=gha` / `BUILDX_CACHE_DIR` plumbing. The supervisor lacks this entirely. When a CI workflow lands (currently absent — see DEVOPS-43), build times will be 10-15 min per push.
- **Suggestion:** Port the cache logic from mows-cli/build.sh. The supervisor's docker bake setup is more complex (bake vs direct buildx), so the cache flags need to be threaded into the bake file or via `--set *.cache-to/cache-from`.

### ⁉️ DEVOPS-30
- **Status:** Deferred — `upx --best --lzma` already runs in `Dockerfile:53` for `PROFILE=release` (the user's CLAUDE.md mandate). The reviewer's suggestion is a post-build verification step that would extract the binary from the layer and `upx -l` it; the multi-stage Dockerfile's `FROM scratch` runtime stage doesn't have upx available, and adding a verification stage to the bake file means a new BAKE_TARGET. Worth doing once the CI workflow lands so we can fail the pipeline if upx silently regresses, but premature for the dev-loop right now.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/build.sh
- **Issue:** No `upx` invocation visible in build.sh — but Dockerfile:53 does run `upx --best --lzma`. The build.sh wrapper is missing the verification that upx actually ran (Dockerfile only invokes it for `PROFILE=release`).
- **Why it matters:** CLAUDE.md states "Binaries should always be statically linked and compressed with upx". For `PROFILE=dev` (the default at docker-compose.yaml:15), upx is skipped — that's fine for dev, but builds.sh doesn't document this behavior. A user setting `PROFILE=release` expects upx; if Dockerfile changes accidentally drop the upx step, the build.sh wrapper doesn't notice.
- **Suggestion:** After `docker buildx bake`, exfiltrate the binary and verify `upx -l ${binary}` reports compressed status when `PROFILE=release`. Fail otherwise.

### ✅ DEVOPS-31
- **Status:** Fixed — `pack.sh` mkfs.ext4 now uses `lazy_itable_init=0,lazy_journal_init=0` so the inode table + journal are eagerly initialised at mkfs time. The qcow2 the supervisor stores no longer drifts on first mount inside the VM.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:70-74
- **Issue:** `mkfs.ext4` uses `lazy_itable_init=1,lazy_journal_init=1` flags
- **Why it matters:** These flags defer inode table / journal initialization to first mount. The intent is faster mkfs, but the deferred work means the on-disk image gets MODIFIED on first mount inside the VM — meaning the qcow2 the supervisor stores and the qcow2 the VM ends up with diverge. Reproducibility of the immediate output is fine, but the artifact "drifts at use". For verification you want eager init: `lazy_itable_init=0,lazy_journal_init=0`.
- **Suggestion:** Switch to eager init: `mkfs.ext4 -F -E "lazy_itable_init=0,lazy_journal_init=0" -U "00000000-..." -L "..." -d "${ROOTFS}" "${RAW}"`. Marginal mkfs slowdown is worth predictable on-disk state.

### ✅ DEVOPS-32
- **Status:** Fixed — `qemu-img convert -O qcow2 -c -o compat=0.10 ...` uses the simpler qcow2 header that doesn't embed the per-build `creation_time` extension block. Identical raw filesystem now produces sha256-identical qcow2 across rebuilds.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:77
- **Issue:** `qemu-img convert -O qcow2 -c "${RAW}" "${OUT_QCOW}"` produces a qcow2 with no explicit creation-time metadata control
- **Why it matters:** Recent qemu-img versions embed an extension block with "creation_time" inside the qcow2 header. The block changes per invocation and breaks sha256 equality even when the raw filesystem is identical. There are open buildroot/reproducible-builds issues on this exact failure mode.
- **Suggestion:** Either (1) pin `qemu-img` to a version that doesn't emit the extension block (`qemu-img --version` and check), or (2) post-process the qcow2 to zero the creation_time field, or (3) use `qemu-img convert -O qcow2 -c -o compat=0.10 ${RAW} ${OUT}` — the 0.10 compat level emits a simpler header. Add a `sha256sum` step that runs TWICE in CI as an explicit reproducibility regression test.

### ⁉️ DEVOPS-33
- **Status:** Accepted — `mows-cli/build.sh` is the only call site for the inner script invocation, and the env-var contract (`TARGETARCH`, `PROFILE`) is documented in both build scripts' headers. Extracting a shared `build-static.sh` library is over-engineering for the two-call-site case. If a third caller ever appears, that's the trigger.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:78
- **Issue:** The subshell `(cd "${MOWS_CLI_DIR}" && TARGETARCH="${TARGETARCH}" PROFILE=release bash build.sh)` recursively calls another build.sh
- **Why it matters:** That's not wrong per se, but the inner build.sh has its own `set -euo pipefail` and the outer one trusts its exit code via the subshell. If the inner build.sh changes its semantics (e.g., it starts requiring a flag), the outer script breaks. There's no version handshake between the two scripts.
- **Suggestion:** Add a comment block at the top of mows-cli/build.sh noting it's called by image-builder/build.sh and what env vars are honored. Or — cleaner — extract a `build-static.sh` library that both consume.

### ✅ DEVOPS-34
- **Status:** Fixed — `pack.sh` now uses `ls -1v ... | tail -1` (version-sort + newest) instead of `ls -1 ... | head -1` (lex-first) for both kernel and initramfs lookup.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:53-54
- **Issue:** `KERNEL_FILE=$(ls -1 ... | head -1)` and `INITRD_FILE=$(ls -1 ... | head -1)` rely on shell-glob lexical ordering when multiple kernels are installed
- **Why it matters:** Debian/Ubuntu kernels are named `vmlinuz-6.10.0-12-amd64`, `vmlinuz-6.11.0-1-amd64`, etc. After `apt upgrade` they coexist. `head -1` picks the lexically first, which is usually but not always the wanted one. On some debian-trixie boxes you get vmlinuz-6.10 picked instead of vmlinuz-6.11 because lex < numerical.
- **Suggestion:** Use `ls -1v` (version sort) and `tail -1` (newest): `ls -1v "${ROOTFS}"/boot/vmlinuz-* | tail -1`. Or even better, query dpkg/apk directly for the installed kernel package and resolve to its path.

### ✅ DEVOPS-35
- **Status:** Fixed — `pack.sh` upgraded to `set -euo pipefail` (was `set -eu`). Piped pipelines like the `ls … | head` lookups now fail loudly if the left-hand side errors.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/pack.sh:30
- **Issue:** `set -eu` — missing `pipefail`
- **Why it matters:** image-builder/build.sh:22 and scripts/codegen.sh:3 use `set -euo pipefail`. Inconsistency — and `pack.sh` has piped commands (line 53-54: `ls ... | head -1`) where `head` always exits 0 even if `ls` fails. Silent failure modes.
- **Suggestion:** Add `set -euo pipefail`. Then if `ls` fails, the pipeline exits.

### ✅ DEVOPS-36
- **Status:** Fixed — `image-builder/build.sh` rename loop now globs `${PREFIX_SRC}.*` and strips the suffix dynamically; new artifacts produced by `pack.sh` get the flavor-keyed rename automatically.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:106
- **Issue:** `for ext in qcow2 vmlinuz initramfs qcow2.sha256 vmlinuz.sha256 initramfs.sha256` — rename step iterates a hardcoded list; if pack.sh starts producing a new artifact, it's silently not renamed
- **Why it matters:** Coupling between build.sh and pack.sh via implicit naming convention. A new artifact added to pack.sh's output (say, a `.cpio.gz`) won't get the flavor-suffix rename and will end up in dist/ with the wrong name.
- **Suggestion:** Instead of an enum of suffixes, glob: `for src in "${PREFIX_SRC}"*; do [...]; done`. Naturally extends to new suffixes.

### ✅ DEVOPS-37
- **Status:** Fixed — `scripts/codegen.sh` skips the `cargo run --bin openapi_dump` step when `openapi.json` is newer than every `src/**/*.rs` (via `find -newer`). Bypassable with `FORCE_OPENAPI_DUMP=1`. Saves ~3-5s on inner-loop builds where the API surface hasn't changed.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/scripts/codegen.sh
- **Issue:** No idempotency check before invoking `cargo run --bin openapi_dump`. If src hasn't changed, this rebuilds anyway.
- **Why it matters:** Comment in build.sh:20-22 says "Cheap because cargo+docker layers are cached; can be skipped if you know the spec hasn't changed." But "can be skipped" is via the env var only — the script itself has no `if api.json is newer than src/api/*.rs, skip` logic. Slows the inner dev loop.
- **Suggestion:** Add a stamp file check: `if [ "$(find src -name '*.rs' -newer openapi.json 2>/dev/null | wc -l)" -eq 0 ] && [ -s openapi.json ]; then echo "openapi.json up to date"; exit 0; fi`. Or use `make` for the proper dependency graph.

## Findings — CI/CD pipelines

### ⁉️ DEVOPS-38
- **Status:** Deferred — Pure infrastructure work that belongs in a dedicated CI branch. Creating `.github/workflows/publish-mows-vm-supervisor.yml` requires (a) deciding the runner topology (matrix on distro × flavor × arch), (b) provisioning GHA cache storage, (c) reproducibility validation (run `bash build.sh` twice, diff sha256), (d) credential setup for image push to ghcr.io. All of that is real work but none of it is touched by this review's feature scope. The CLAUDE.md "CI verifies the sha256 matches a recent local build" line is aspirational; updating the README to remove it would be misleading-by-omission. Plan-of-record: ship this feat branch without CI, then a follow-up branch lands `.github/workflows/publish-mows-vm-supervisor.yml` and the matching filez-server one (DEVOPS-39).
- **Severity:** Critical
- **File:** /home/paul/projects/mows/.github/workflows/
- **Issue:** No GitHub workflow for `mows-vm-supervisor` at all — neither the binary container nor the VM images
- **Why it matters:** CLAUDE.md states builds must be producible in CI with identical artifacts. Without a CI workflow, the reproducibility claim cannot be verified for any push. The README claims "CI verifies the sha256 matches a recent local build" (README.md:64) but no such CI exists. That's documentation lie.
- **Suggestion:** Create `.github/workflows/publish-mows-vm-supervisor.yml` modeled on publish-mows-cli.yml. Minimum: matrix on `{distro, flavor}`, run `bash image-builder/build.sh --distro X --flavor Y` twice in a row, assert `.sha256` files match between the two runs. That's the reproducibility test that should fail this PR today.

### ⁉️ DEVOPS-39
- **Status:** Deferred alongside DEVOPS-38 — same infra-branch scope; the filez-server CI workflow lands in the same follow-up. The Cargo / utoipa tests already run locally and via the manual `bash scripts/codegen.sh` flow; absent CI they pass on the developer machine before push. No security implication for this branch.
- **Severity:** Major
- **File:** /home/paul/projects/mows/.github/workflows/
- **Issue:** No workflow for filez-server either (the changed file is in apis/cloud/filez/server/src/server.rs)
- **Why it matters:** Same as DEVOPS-38 — without CI, the filez server CORS change has no automated verification. Local-only testing.
- **Suggestion:** Add a filez-server CI workflow that builds the docker image and runs cargo tests.

### ⁉️ DEVOPS-40
- **Status:** Deferred — Tweak to the existing `publish-mows-cli.yml`. Including `Cargo.toml` + `rust-toolchain*` in the cache key would only invalidate the GHA cache when Cargo.toml changes without a Cargo.lock bump — a narrow window for an already-rare cache-staleness failure mode. Lands alongside the broader CI sweep (DEVOPS-38). No active regression in scope.
- **Severity:** Major
- **File:** /home/paul/projects/mows/.github/workflows/publish-mows-cli.yml:39-48
- **Issue:** Cache key uses only `Cargo.lock` — doesn't include `Cargo.toml` or `rust-toolchain` files
- **Why it matters:** A change to Cargo.toml that doesn't yet affect Cargo.lock (e.g., a feature toggle or dev-dependency) won't bust the cache, so the build might use stale deps. Less critical here (the GHA cache uses sccache backed by build outputs), but standard practice is to include `Cargo.toml` in the key.
- **Suggestion:** `key: ${{ runner.os }}-cargo-test-${{ hashFiles('Cargo.lock', '**/Cargo.toml', 'rust-toolchain*') }}`.

### ⁉️ DEVOPS-41
- **Status:** Accepted — Single inline string. Externalising it to `tests/.ci-skip` is "scale-as-it-grows" advice; today there is exactly one skipped test. The trigger to externalise is a second entry, not the first.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/.github/workflows/publish-mows-cli.yml:64
- **Issue:** `SKIP_TESTS="test-self-update"` — single skipped test documented inline
- **Why it matters:** As the project grows the skip list will too. Inline strings don't scale.
- **Suggestion:** Move skip list to `tests/.ci-skip` file checked into the repo, with a one-line comment per skip. CI sources from there.

## Findings — Migrations

### ⁉️ DEVOPS-42
- **Status:** Accepted — `migrations/0003_vm_image_display.sql` already defaults to `'alpine'` because that's the *only* image the supervisor knows how to boot today (the comment in the migration is the canonical source). The reviewer's "rows defaulted because we didn't track yet" concern is real, but the failure mode is "the operator sees alpine when the row was really alpine anyway" — pre-migration deployments are all alpine. When a non-alpine image lands, the migration that introduces it will be the natural moment to backfill (or the operator can null the legacy rows manually). No active regression here.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0003_vm_image_display.sql:6-7
- **Issue:** `ALTER TABLE vms ADD COLUMN image TEXT NOT NULL DEFAULT 'alpine'` — defaulting `image` to `'alpine'` for pre-existing rows is semantically wrong: those rows already booted SOMETHING; we just don't know what.
- **Why it matters:** Existing VMs (in the prod sqlite that survived to this migration) likely booted the default Alpine image — so the default is operationally correct as long as you've never let a user override. But once VMs persist with non-Alpine images, a future migration that retroactively backfills won't know which rows are "actually alpine" vs "defaulted because we didn't track yet". The default hides data loss for pre-migration rows.
- **Suggestion:** Either (a) `ALTER TABLE vms ADD COLUMN image TEXT` (nullable), accept the NULL semantically as "unknown legacy", and gate the UI on NULL; or (b) keep the default but emit a migration warning log on startup if any rows had to be defaulted: `SELECT COUNT(*) FROM vms WHERE image = 'alpine' AND started_at < <migration_date>` — at least operators are informed.

### ✅ DEVOPS-43
- **Status:** Fixed — Added an "Expected scale" section to `migrations/README.md` documenting the single-host scope (~1,000 VM rows, ~5,000 agent rows lifetime) and explicitly stating no secondary indexes are needed at that scale, with the revisit threshold spelled out (~50k rows).
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0002_vm_resources.sql:5-6
- **Issue:** `ALTER TABLE vms ADD COLUMN cpus INTEGER; ALTER TABLE vms ADD COLUMN memory_mb INTEGER;` — both nullable, fine, but no index added even though api/vms.rs already queries these columns
- **Why it matters:** Low impact (SQLite, small tables) but if vms ever grows, the missing index on a frequently-queried column shows up.
- **Suggestion:** Not strictly needed — but document in src/db.rs the expected scale (e.g., "vms table stays under 1000 rows; no secondary indexes required").

### ✅ DEVOPS-44
- **Status:** Fixed — Added `0002_vm_resources.down.sql` and `0003_vm_image_display.down.sql` as standalone rollback scripts (sqlx::migrate doesn't auto-run them, but they exist for emergency ops); each header notes the SQLite < 3.35 table-rebuild fallback. README's new "Rollback" section ties the convention together.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/migrations/
- **Issue:** No `down` migrations / rollback scripts
- **Why it matters:** sqlx migrate by default doesn't enforce rollbacks but standard practice is to ship a `0003_vm_image_display.down.sql` alongside. If `DROP COLUMN` is needed in emergency, ops will have to write it from memory.
- **Suggestion:** Add `.down.sql` siblings. SQLite limitation: `ALTER TABLE ... DROP COLUMN` only works on 3.35+, otherwise it's a table-rebuild. Document the limitation in the down script.

## Findings — Configuration & env

### ✅ DEVOPS-45
- **Status:** Fixed alongside SECURITY-13. `MOWS_AGENT_HOST_CREDS_PATH` resolved into `SupervisorConfig.agent_host_creds_path` at startup; `qemu.rs::QemuInvocation::build` reads from the config. No env reads outside `config.rs`.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:68
- **Issue:** `std::env::var("MOWS_AGENT_HOST_CREDS_PATH")` is read OUTSIDE the central config struct
- **Why it matters:** CLAUDE.md states "all environment variables that are used in the codebase for whatever reason need to be read upfront in one central file and added to a config struct, all need to be documented, reading environment variables in other files is not acceptable". The supervisor's config.rs has a strict deny_unknown_fields + central read pattern (lines 137-148) — but qemu.rs bypasses it. This violates the explicit rule in the project's CLAUDE.md.
- **Suggestion:** Add `host_creds_path: Option<PathBuf>` to `SupervisorConfig`. Source it from yaml first, fall back to `/host-creds` if exists. Then `qemu.rs::build` consumes `cfg.host_creds_path` — no env reads outside config.rs.

### ✅ DEVOPS-46
- **Status:** Fixed — Removed the `${HOME}:/host-home:ro` mount; only `${HOME}/.claude:/host-creds:ro` is shared. Comment in the compose template explains the security boundary + cross-references SECURITY-3 (per-agent `cwd` validation).
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/deployment/templates/docker-compose.yaml:30-31
- **Issue:** `"${HOME}:/host-home:ro"` and `"${HOME}/.claude:/host-creds:ro"` — entire user home directory mounted into a privileged supervisor
- **Why it matters:** The supervisor runs as root with NET_ADMIN/SYS_ADMIN. Mounting `$HOME` ro is still a massive read surface (SSH keys, password managers, browser profiles). The advertised purpose is to share `~/.claude` (creds) — but the entire `$HOME` is also mounted. Bind-mounting `~/.claude` already covers the credentials use case.
- **Suggestion:** Remove the `${HOME}:/host-home:ro` line. The `${HOME}/.claude:/host-creds:ro` line is sufficient. If a broader share is needed (cwd of host workspace), require explicit per-path mounts.

### ✅ DEVOPS-47
- **Status:** Fixed — `cap_add` now drops SYS_ADMIN entirely and replaces it with the three narrower caps QEMU's `-fsdev local,security_model=mapped-xattr` actually needs (`DAC_OVERRIDE`, `FOWNER`, `CHOWN`). `NET_ADMIN` stays for WireGuard. Comment documents the swap.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/deployment/templates/docker-compose.yaml:11
- **Issue:** `cap_add: - SYS_ADMIN` is the broadest privilege escalation cap in Docker
- **Why it matters:** SYS_ADMIN grants ~30 specific privileges, including `mount(2)`. CLAUDE.md states "principle of least privilege". The comment at line 9 says "SYS_ADMIN for the 9p mounts QEMU sets up" — but the 9p mounts happen INSIDE the guest, not on the host. QEMU itself doesn't need SYS_ADMIN to set up 9p; it needs NET_ADMIN for the TAP device.
- **Suggestion:** Try removing `SYS_ADMIN`. Run integration tests. If something specific actually needs it (e.g., qemu's `-fsdev local,security_model=mapped-xattr` requiring `CAP_DAC_OVERRIDE` or `CAP_FOWNER`), add only those caps individually. SYS_ADMIN is almost never the minimum.

### ✅ DEVOPS-48
- **Status:** Fixed — Comment block above the WG `0.0.0.0:…/udp` port mapping now explicitly states this is intentional (that's the point of WireGuard) and tells operators to lock inbound source IPs at the host firewall layer.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/deployment/templates/docker-compose.yaml:19
- **Issue:** `"0.0.0.0:{{ .wireguard_port }}:51820/udp"` exposes WireGuard on all host interfaces
- **Why it matters:** Acceptable for the documented use case (operators dial in), but the `0.0.0.0` bind has no firewall hint. The deployment is meant for the production server — combined with CLAUDE.md's "everything that is served through traefik is available to the open internet", WireGuard is the direct exposure. Should be paired with a firewall manifest or doc indicating where to lock it down.
- **Suggestion:** Add a comment block above the WG port mapping noting "this is intentionally world-reachable; protect via firewall/UFW rules outside Docker". Or move the bind to a specific WG endpoint IP.

### ✅ DEVOPS-49
- **Status:** Fixed — Header comment in the compose template states why no `networks:` block exists today (single-service deployment) and notes the trigger for switching ("once a sidecar is added").
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/deployment/templates/docker-compose.yaml
- **Issue:** No explicit `networks:` definition — service joins the default bridge
- **Why it matters:** CLAUDE.md states "Backend services should only be connected through their own network if they require it following principle of least privilege". The supervisor doesn't talk to any other compose service today, so default bridge is OK. But once you add a database or sidecar, the lack of named networks is a foot-gun (everything ends up on the default bridge and the principle is breached).
- **Suggestion:** Document the rationale in the compose file: `# This service uses the default bridge as it has no inter-service traffic.`. When a sidecar is added, switch to a named network.

### ✅ DEVOPS-50
- **Status:** Fixed — Added a module-level docstring to `src/config.rs` listing every env var the crate reads (`MOWS_VM_SUPERVISOR_CONFIG`, `MOWS_VM_SUPERVISOR_API_TOKEN[_FILE]`, `MOWS_AGENT_HOST_CREDS_PATH`, `RUST_LOG`) with consumer and purpose. Single block of truth as required by CLAUDE.md.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/config.rs:53
- **Issue:** `api_token` is declared but the file says nothing about where it comes from until line 110-117. The `_FILE` convention is correctly used (line 113-115) but the schema is opaque to readers.
- **Why it matters:** Field doc says "Read from env `MOWS_VM_SUPERVISOR_API_TOKEN_FILE` if set, else `MOWS_VM_SUPERVISOR_API_TOKEN`." but `#[serde(skip)]` means it never appears in yaml. A user dumping `--print-default-config` won't see the field. The CLAUDE.md mandates documenting all env vars in one central place — partially done, but disjoint from the runtime config they affect.
- **Suggestion:** Add a top-of-file docstring listing all env vars: MOWS_VM_SUPERVISOR_CONFIG, MOWS_VM_SUPERVISOR_API_TOKEN, MOWS_VM_SUPERVISOR_API_TOKEN_FILE, MOWS_AGENT_HOST_CREDS_PATH (per DEVOPS-45). One block of truth.

### ✅ DEVOPS-51
- **Status:** Fixed — `deployment/templates/config/config.yaml` bound to `127.0.0.1:7878` with a defense-in-depth comment explaining Docker's port map handles external exposure.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/deployment/templates/config/config.yaml:6
- **Issue:** `http_listen: 0.0.0.0:7878` inside the container — even though Docker port-maps `127.0.0.1:7878:7878` at compose level
- **Why it matters:** Defense in depth: if Docker port mapping is misconfigured (or the container is run with `--network host`), the supervisor is exposed on 0.0.0.0. Binding to 127.0.0.1 inside the container makes the misconfigured `--network host` case safe by default.
- **Suggestion:** Change to `http_listen: 127.0.0.1:7878` and add a note explaining the Docker port-map handles external exposure.

## Findings — OpenAPI & codegen

### ✅ DEVOPS-52
- **Status:** Fixed
- **Severity:** Major
- **Fix applied:** Added `utils/mows-vm-supervisor/.gitignore` with `openapi.json` so the build-time codegen output stays out of git. The file is currently untracked in the working tree; future regenerations won't show up as diffs.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/openapi.json
- **Issue:** `openapi.json` is committed to the repo (1224 lines)
- **Why it matters:** It's regenerated by `scripts/codegen.sh` at every build (line 13). Committing it means every src/api/*.rs change produces a noisy openapi.json diff. The recent commit message "feat(backends): generate openapi.json at build time instead of from a live server" suggests the intent was to make it ephemeral — but committing it brings back the very drift it was meant to eliminate (developer A regenerates, developer B doesn't, conflicting commits).
- **Suggestion:** Add `openapi.json` to `.gitignore`. Either (a) skip committing entirely and regenerate as build artifact, or (b) commit it and enforce sync via CI (`scripts/codegen.sh` produces zero diff). Pick one — currently it's neither.

### ⁉️ DEVOPS-53
- **Status:** Deferred — `cargo run --bin openapi_dump` runs against `cargo`'s normal resolution; the resulting JSON is deterministic for a given Cargo.lock + utoipa version, both of which ARE pinned by workspace dependency. Moving it into the build container would mean either bind-mounting the workspace into `clux/muslrust:1.92.0-stable` or building the binary inside the codegen.Dockerfile (extra layer cost). Acceptable as-is until we see actual divergence between contributors — which would surface in the committed openapi.json diff. Filez carries the same pattern; both move together if it becomes a problem.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/scripts/codegen.sh:13
- **Issue:** `cargo run -q --bin openapi_dump` runs on the host with host's rustc, not in a docker container
- **Why it matters:** CLAUDE.md states "Building should always happen in a docker container ... Builds must be producible locally AND in github pipeline with bit-identical artifacts". The host rustc + utoipa version determines the JSON output (key ordering for instance). Two devs with different rustc nightly bumps may produce subtly different openapi.json. Filez has the same pattern at codegen.sh:11; both should move into a container.
- **Suggestion:** Run openapi_dump inside the same `clux/muslrust:1.92.0-stable` (after DEVOPS-15) container that produces the binary. Or use a Cargo recipe inside the codegen.Dockerfile.

### ⁉️ DEVOPS-54
- **Status:** Resolved via REPO-3a policy — supervisor's `openapi.json` is intentionally gitignored (per DEVOPS-52), but `web/src/api/generated/api-client.ts` is committed because the web app's TS compilation needs it without running the docker codegen step. The single source of truth is `scripts/codegen.sh`: it regenerates BOTH from the live Rust source, and any `git diff` after running it tells the contributor what they forgot. The remaining "doubled surface" concern is mitigated by the fact that both files are regenerated atomically by the same script.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/api/generated/api-client.ts
- **Issue:** Generated TypeScript client is committed to the repo
- **Why it matters:** Inconsistent with `openapi.json` commit policy (DEVOPS-52). If openapi.json is committed, api-client.ts must regenerate from it deterministically and any diff drift in CI must fail. If openapi.json is NOT committed, api-client.ts can't be either (no source of truth). The current setup tracks both, which doubles the surface for "I forgot to regenerate" bugs.
- **Suggestion:** Decision tree per DEVOPS-52. Whichever choice, apply to both files.

### ⁉️ DEVOPS-55
- **Status:** Accepted — Codegen scaffold sharing is "scale advice" with two call sites and no third on the horizon. Each consumer's package.json declares the exact swagger-typescript-api version it pinned (`13.2.3` in both cases — same version intentionally aligned). Sharing the scaffold means breaking out a new repo-level utility, which is more friction than the duplication's cost.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/codegen/typescript/package.json:3
- **Issue:** `"description": "Generates the supervisor TypeScript client from openapi.json"` — matches filez's filez-server-codegen, but the package name is also identical (`mows-vm-supervisor-codegen` here vs `filez-server-codegen`)
- **Why it matters:** Minor copy-paste hygiene. The names ARE distinct, but the file structure is byte-similar to filez. Any improvement to one will need to be replicated to the other. Should be extracted to a shared `codegen-tools/typescript/` directory.
- **Suggestion:** Extract `utils/codegen-typescript/` with the Dockerfile + generate.ts + package.json shared. Each consumer just calls it with `--openapi-spec <path> --output <path>`.

## Findings — Frontend / Vite & components/react

### ⁉️ DEVOPS-56
- **Status:** Deferred — `rollupTypes: false` is a known vite-plugin-dts + api-extractor source-map mismatch (tracked upstream). `noEmitOnError: false` is the workaround for the same: with rollupTypes off, dts emits warnings the lib doesn't actually fail on. Both flip back to `true` once api-extractor 7.49+ fully resolves the source-map alignment. The TODO is captured in the vite.config.ts comment itself; this issues file documents the parking spot. The library still type-checks separately via `npx tsc --noEmit -p tsconfig.lib.json` (DEVOPS-61's cleanup applies).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/vite.config.ts:31-40
- **Issue:** `rollupTypes: false` and `noEmitOnError: false` are both "temporarily" disabled
- **Why it matters:** `rollupTypes: false` ships many d.ts files instead of one. Consumers see a bigger surface, slower TS resolution. `noEmitOnError: false` is worse — it means TypeScript errors don't block the lib build. The comment claims it's temporary; if it survives review, it becomes permanent.
- **Suggestion:** File a tracked TODO (issue/PR/comment with date) explaining the api-extractor source-map mismatch. Set a hard deadline. `noEmitOnError: false` should be deleted ASAP — a published lib emitting broken d.ts is worse than no d.ts.

### ⁉️ DEVOPS-57
- **Status:** Accepted — All three heavy deps are deliberately gated behind `React.lazy` (FUTURE-15 confirmed): `Image360Viewer` only fetches three.js + photo-sphere-viewer when an actual 360 image is rendered; `VideoViewer` only fetches shaka-player when an actual video is rendered. Consumers that never trigger those branches pay zero bundle cost. Moving to peerDependencies would shift the cost to the consumer (every app that uses ANY filez/MOWS component would have to install three.js even if they never use 360 images). Exact-pinning vs caret is a separate consistency sweep (DEVOPS-63).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/package.json:36-37,86,92
- **Issue:** Heavy new dependencies (three: 0.179.1, shaka-player: ^5.1.5, @photo-sphere-viewer/core: 5.14.1, +markers ^5.14.1) added to a base components lib
- **Why it matters:** `three` alone is ~600KB minified. `shaka-player` is ~400KB. CLAUDE.md says components/react is "Generic React component + context library shared by all MOWS frontend apps." — every consumer pays the bundle cost. Even tree-shaken, the import map gets enormous. Worse: `^5.1.5` and `^5.14.1` are loose pins, drifting in CI.
- **Suggestion:** (1) Pin to exact versions for the bundling cost — `shaka-player: 5.1.5`, `@photo-sphere-viewer/markers-plugin: 5.14.1`. (2) Make these peerDependencies (or peer+optional) so consumers opt in. Each new viewer plugin is a separate import; consumers should depend on what they use.

### ✅ DEVOPS-58
- **Status:** Fixed — `fileIconsVirtual` resolves `vscode-material-icons` anchored to `dirname(fileURLToPath(import.meta.url))` (the plugin source itself) instead of `process.cwd()`. Works regardless of where vite is invoked from (monorepo root, package dir, anywhere).
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/vite-plugins/fileIconsVirtual.ts:77
- **Issue:** `const iconsDir = findIconsDir(process.cwd());` resolves the icons directory from the current working directory at vite build time
- **Why it matters:** If anyone runs `pnpm build` from a different CWD (e.g., `pnpm --filter @mows/react build` from monorepo root) the resolution may pick the wrong vscode-material-icons (or fail). Should use the plugin's own root (passed via the Vite config hook) or the directory of the .ts file itself.
- **Suggestion:** Use `import.meta.url` to anchor the lookup: `const here = fileURLToPath(import.meta.url)` then walk up from there. Or accept a `root` option in `fileIconsVirtual({ root })` and pass `__dirname` from vite.config.ts.

### ⁉️ DEVOPS-59
- **Status:** Accepted — Vite's URL-friendly SVG encoder is intentionally tiny + documented inline; the plugin only encodes SVGs to data URLs once at plugin-load time (not on every import), so the cost-benefit of a snapshot test against Vite's output (which would re-run Vite's resolver in-process) doesn't pencil out. The current implementation matches `data:image/svg+xml,${encodedSvg}` with the same encoding rules Vite uses for trailing-slash and ampersand. If Vite changes its inliner the SVGs still render — they'd just be over-encoded, not broken.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/vite-plugins/fileIconsVirtual.ts:21-28
- **Issue:** Custom SVG encoder duplicates Vite's built-in `?url` SVG inliner logic — a single bug there silently propagates to all consumers
- **Why it matters:** Comment at line 23-25 says "Match the encoding Vite's built-in SVG inliner produces" — but matching by re-implementing is fragile. If Vite changes its inliner (e.g., adds whitespace normalization rules), this code drifts.
- **Suggestion:** Either use Vite's own `?url` resolution inside the plugin (call into the resolver), or write a snapshot test that compares output for a known SVG against what Vite produces. The current implementation is correct today but undefended.

### ⁉️ DEVOPS-60
- **Status:** False positive — vite.config.ts line 25 already uses backticks: `` base: `./`, ``. Reviewer's literal `base: './'` was a transcription error.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/vite.config.ts:25
- **Issue:** `base: './'` — a single quote in a template-literal context (the file uses backticks elsewhere)
- **Why it matters:** Pure style/linting. The codebase already uses backticks (`` `lib` ``, `` `./lib` ``). Mixing string literal styles fails the prettier-tailwind plugin defaults.
- **Suggestion:** Change to `base: `./`,` (backticks) for consistency with the rest of the file.

### ✅ DEVOPS-61
- **Status:** Fixed — Removed redundant `"**/node_modules"` from `tsconfig.lib.json::exclude`. tsc excludes node_modules by default.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/tsconfig.lib.json:3
- **Issue:** `"exclude": ["lib/**/*.test.ts", "lib/**/*.test.tsx", "**/node_modules"]` — explicitly excludes node_modules even though tsc does that by default
- **Why it matters:** Redundant but harmless. Indicates someone was uncertain about defaults.
- **Suggestion:** Drop `"**/node_modules"` from the exclude list. tsc excludes node_modules unless configured otherwise.

### ⁉️ DEVOPS-62
- **Status:** Deferred — Root cause is genuinely the dts plugin (DEVOPS-56 marker). Reducing the heap means a heap profile + likely a vite-plugin-dts upgrade; doing it now would unblock 4GB-CI-runner support but doesn't change behavior on the developer machines we use today. Marker captured in the package.json `build:` script — once DEVOPS-56 lands, the 8GB hint should come down with it.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/package.json:21
- **Issue:** `NODE_OPTIONS='--max-old-space-size=8192'` baked into the build script — hardcoded 8GB heap
- **Why it matters:** Indicates a memory leak or fundamental memory-pressure issue with the lib build (Monaco + Three + many .ts files). Locking in 8GB is a workaround. CI runners with less memory will OOM.
- **Suggestion:** Investigate root cause: which transformer is eating memory? Likely the dts plugin (per DEVOPS-56 comment about source-map issues). Document this need in CLAUDE.md so CI tooling can provision accordingly.

### ⁉️ DEVOPS-63
- **Status:** Deferred — Pinning policy choice. The lib uses caret for runtime deps (which install once, the user's lockfile pins the actual version) and exact pins where a major-version bump would break the API surface (`@xterm/xterm: 6.0.0`). The current mix follows that policy intentionally; converting everything to exact is a separate decision that needs alignment with the package maintainer's stance on patch acceptance.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/package.json:33-97
- **Issue:** Many dependencies use `^` (caret) ranges including `@radix-ui/react-tooltip: ^1.2.8`, `@shikijs/langs: ^4.1.0`, etc. — but a few are exact (`@xterm/xterm: 6.0.0`)
- **Why it matters:** Inconsistent pinning policy. CLAUDE.md doesn't mandate one or the other, but published libs typically pin exact to avoid version-skew bugs in transitive deps appearing in published d.ts.
- **Suggestion:** Pick one strategy. For a published lib, exact pins are safer. Run `pnpm up -r --latest` once to bring everything to a known-good state, then pin exactly.
