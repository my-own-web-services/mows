# mows-vm-supervisor

Runs AI coding agents (claude-code today, others later) inside ephemeral
Alpine QEMU VMs. The CLI surface lives at `mows tools agent ...` (see
`utils/mows-cli`); this crate is the daemon that owns the actual VM
lifecycle, user accounts, and (designed-for) WireGuard remote access plus
a mobile-friendly web UI.

See `utils/mows-cli/.plans/agent-vm/PLAN.md` for the full design doc and
the rationale behind every architectural choice.

## Components

```
src/
├── main.rs           — bin entrypoint (clap, tracing, lifecycle)
├── lib.rs            — library entrypoint
├── api/              — axum REST + WS surface (health, auth, agents, users)
├── config.rs         — single-yaml config + _FILE secrets convention
├── db.rs             — sqlx + sqlite pool, migrations
├── error.rs          — thiserror enum, IntoResponse
├── kinds.rs          — agent-kind plugin manifest
├── qemu.rs           — QEMU command builder, port allocator, registry
└── state.rs          — process-wide AppState
```

`migrations/` contains the sqlx migrations applied at startup.

`image-builder/` is a Docker-based, reproducible build of the Alpine
qcow2 used for guest VMs. See its README for details.

`deployment/` is a `mows-cli/mpm` compose project that runs the supervisor
container on a host. The supervisor needs `/dev/kvm`, `/dev/net/tun`, and
`NET_ADMIN` + `SYS_ADMIN` capabilities.

## Local development

```sh
cargo test -p mows-vm-supervisor          # unit tests (no KVM required)
cargo run  -p mows-vm-supervisor -- --print-default-config
```

The full stack (supervisor container + VM image + CLI talking to it) is
exercised via `tests/test-agent` in `utils/mows-cli/tests/`. That test is
gated on `qemu-system-x86_64`, `/dev/kvm`, and a working Docker daemon
being present, and is skipped in CI by default.

## Web UI (planned, not in v1)

A React + tailwind + shadcn SPA living under `web/` will be embedded into
the supervisor binary via `include_dir!` and served from the same axum
listener. Auth is local users + argon2 + session cookies; mobile-friendly
chat UI talks to `/v1/agents/:id/chat` over WebSockets. The app **must**
consume `@mows/react-components` (yalc) per repo policy — see the user's
global memory.

## Reproducible artifacts

- The binary is statically linked (musl) and UPX-compressed in release
  builds. CI and local builds must produce byte-identical artefacts.
- The Alpine guest qcow2 is built from a pinned APK index with
  `SOURCE_DATE_EPOCH`; CI verifies the sha256 matches a recent local build.
