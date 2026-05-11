# mows-vm-supervisor / image-builder

Builds the reproducible Alpine VM image that hosts AI coding agents
(claude-code today, others later) inside QEMU.

## Build

```sh
bash build.sh                 # amd64 (default)
TARGETARCH=arm64 bash build.sh
```

Outputs to `dist/alpine-mows-agent-${TARGETARCH}.qcow2` plus a `.sha256`.

## Reproducibility

The build pins `SOURCE_DATE_EPOCH=1735689600` and writes deterministic file
mtimes into the rootfs before packing. Two consecutive `bash build.sh`
invocations on the same machine MUST produce identical `.sha256` outputs.
CI runs the same script, so artifacts must match between local and pipeline
builds. Mismatches indicate a non-pinned input has crept in (typically an
unpinned APK index or an `npm install` without `--package-lock-only`).

## What's inside

- Alpine 3.20 base with OpenRC.
- Build tools: gcc, make, python3.
- Runtime: git, openssh, curl, wget, sudo, docker (for in-VM container
  workloads), nodejs + npm + pnpm.
- Rust toolchain (stable, via rustup) for Rust development inside the VM.
- Claude Code CLI (`@anthropic-ai/claude-code`) installed globally.
- `/etc/mows-agent/kinds.d/claude.yaml` plugin manifest.
- `mows-agent-init` OpenRC service that wires up authorised SSH keys and
  selects the agent kind from `/mowsinit/run.yaml` on each boot.
- 9p mountpoints prepared for `workspace`, `creds`, and `mowsinit`.

## Layering / cache hits

The Dockerfile orders RUN steps from least- to most-volatile so layer
caching is preserved when only the agent kinds change. Re-running `build.sh`
after editing `claude.yaml` should hit the cache through the rust toolchain
layer.

## Adding a new agent kind

1. Drop a `<name>.yaml` in this directory matching the
   `mows_vm_supervisor::kinds::AgentKind` schema.
2. Reference it from a new `COPY <name>.yaml /etc/mows-agent/kinds.d/` line
   in the Dockerfile.
3. If the kind needs extra runtime tooling, add it as a dedicated layer so
   existing agents' caches stay warm.
