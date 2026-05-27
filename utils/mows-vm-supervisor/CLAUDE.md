# mows-vm-supervisor

## Do not run the supervisor backend on the host

The `mows-vm-supervisor` binary MUST NEVER be started outside of the
container it is designed to run in (see `Dockerfile` and
`deployment/`). It expects a container-shaped environment: `/dev/kvm`,
`/dev/net/tun`, `NET_ADMIN` + `SYS_ADMIN`, the bind-mounted state/image
directories, and the unix socket path under `/run`. Running it directly
on the host (e.g. `cargo run --bin mows-vm-supervisor`) will corrupt
host state, fight the real container if one is up, and produce results
that do not match the deployed environment.

For local development:

- Frontend only: `cd web && pnpm run dev` — Vite proxies `/v1` to the
  supervisor running inside its container.
- Backend changes: rebuild and run the container via
  `mows tools agent supervisor start` (or the compose project in
  `deployment/`).
- Unit tests that do not touch QEMU/KVM may still be run with
  `cargo test -p mows-vm-supervisor`.
