# mows-vm-supervisor / image-builder

Builds the reproducible VM images that host AI coding agents (claude-code
today, others later) inside QEMU. The pipeline is **Dockerfile-per-distro
+ shared rootfs-to-qcow2 packer**, so adding custom packages or extra
configuration is just a `RUN apt-get install …` line in the corresponding
Dockerfile.

## Build

```sh
# alpine + headless (default)
bash build.sh

# any (distro, flavor) combination
bash build.sh --distro debian  --flavor headless
bash build.sh --distro ubuntu  --flavor desktop
bash build.sh --distro nixos   --flavor headless
bash build.sh --distro alpine  --flavor desktop

# cross-arch (only amd64 wired today)
TARGETARCH=arm64 bash build.sh --distro debian --flavor headless
```

Each invocation writes three files to `dist/`:

```
<distro>-<flavor>-mows-agent-<arch>.qcow2     # rootfs as a compressed qcow2
<distro>-<flavor>-mows-agent-<arch>.vmlinuz   # extracted kernel
<distro>-<flavor>-mows-agent-<arch>.initramfs # extracted initramfs / initrd
```

…plus a `.sha256` sibling for each. The supervisor's
`mows_vm_supervisor::qemu::locate_image(distro, flavor)` looks them up by
this exact name in `config.image_dir` and boots QEMU with
`-kernel`/`-initrd`/`-drive`.

## Supported variants

End-to-end CI verification (build script + `pack.sh` + reproducibility sha)
is gated on **alpine** today; the other distros build but the supervisor
runtime path has not been smoke-tested with their boot artefacts yet
(DOC-27 — kept in sync with the `migrations/0003_vm_image_display.sql`
header comment).

| Distro | Headless | Desktop | Notes |
|--------|----------|---------|-------|
| alpine | ✅ | ✅ | OpenRC + xfce4 — verified end-to-end. |
| debian | 🚧 | 🚧 | systemd + xfce4 + lightdm. Image builds, but supervisor boot smoke-test pending. |
| ubuntu | 🚧 | 🚧 | systemd + xfce4 + lightdm. Same status as debian. |
| nixos  | 🚧 | 🚧 | flake-driven via `nixos-generators`, dispatch in `nixos.Dockerfile`. Same status. |

Adding a new distro = drop `<name>.Dockerfile` in this dir, mirror the
layering of the closest sibling, set `DISTRO=<name>` on the pack.sh call.

## What's inside every variant

Regardless of base distro, every image ships:

- sshd configured for key-only root login (key is dropped at boot from
  `/mowsinit/authorized_keys`, mounted as a 9p share by the supervisor)
- An init-time hook (`mows-agent-init.service` on systemd distros,
  `mows-agent-init` OpenRC service on Alpine) that wires the SSH key, reads
  `/mowsinit/run.yaml` to pick the agent kind, and stamps
  `/run/mows-agent-init.ready`
- The host-static `mows` CLI at `/usr/local/bin/mows`
- Node + pnpm, Rust (rustup stable + rustfmt + clippy), python3
- `@anthropic-ai/claude-code` installed globally as `claude`
- An independent dockerd (the supervisor port-forwards it on the host)
- 9p mount points: `/workspace`, `/creds`, `/mowsinit`

## Shared assets

Files under `common/` are copied into every distro image — changes here
affect all four variants, so rebuild every variant and re-check the `.sha256`
outputs before committing:

- `common/mows-agent-init.service` — systemd unit (Debian/Ubuntu/NixOS).
- `common/mows-agent-init.openrc` — OpenRC service (Alpine).
- `common/mows-agent-init.sh` — shared init script invoked by both.
- `common/20-mows-agent.network` — systemd-networkd config.
- `common/fstab`, `common/interfaces` — guest mount + network defaults.

## Customising

To add packages to a specific (distro, flavor) image:

```dockerfile
# inside debian.Dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        your-package-1 your-package-2 \
    && rm -rf /var/lib/apt/lists/*
```

Then `bash build.sh --distro debian --flavor headless` rebuilds with the
Docker layer cache intact — only the new layer runs.

For NixOS, add to `environment.systemPackages = with pkgs; [ … ];` in
`nixos/flake.nix`.

## Reproducibility

The build pins `SOURCE_DATE_EPOCH=1735689600` and stamps every file in the
final rootfs with that mtime before packing. Two consecutive
`bash build.sh --distro X --flavor Y` invocations on the same machine MUST
produce identical `.sha256` outputs. Mismatches indicate a non-pinned input
has crept in (typically an unpinned package index or an `npm install`
without `--package-lock-only`).

## Boot model

`pack.sh` extracts `/boot/vmlinuz*` + `/boot/initramfs*` (or `initrd.img*`
on Debian/Ubuntu) from the rootfs and writes them alongside the qcow2. The
supervisor passes them to QEMU as `-kernel` / `-initrd` so the qcow2 only
needs to carry the root filesystem — no bootloader, no ESP, no GRUB. Kernel
cmdline is fixed at the supervisor: `root=/dev/vda rw rootfstype=ext4
console=ttyS0,115200 ip=dhcp`.

## Adding a new agent kind

1. Drop a `<name>.yaml` in this directory matching the
   `mows_vm_supervisor::kinds::AgentKind` schema.
2. Reference it from a new `COPY <name>.yaml /etc/mows-agent/kinds.d/` line
   in each Dockerfile (and equivalent in the NixOS flake).
3. If the kind needs extra runtime tooling, add it as a dedicated layer so
   existing agents' caches stay warm.
