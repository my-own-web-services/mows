# syntax=docker/dockerfile:1.7
#
# Reproducible NixOS VM image for mows-vm-supervisor.
#
# Unlike Alpine/Debian/Ubuntu we cannot just apt-get our way to a rootfs —
# NixOS is built from a flake declaration. This Dockerfile drives the flake
# inside a nixos/nix container, then assembles the resulting closure into a
# raw ext4 rootfs in a downstream Alpine packer stage. The supervisor boots
# the artefact the same way it boots every other distro: `-kernel` +
# `-initrd` + `root=/dev/vda rootfstype=ext4`.
#
# Output: /out/nixos-mows-agent-${TARGETARCH}.{qcow2,vmlinuz,initramfs}.
# `image-builder/build.sh` renames to the flavor-keyed path afterwards.

ARG SOURCE_DATE_EPOCH=1735689600
ARG TARGETARCH=amd64
ARG FLAVOR=headless
# Digest of `nixos/nix:latest` at pin time. `latest` mutates whenever a new
# nix release ships; pinning to a digest is the only way to honour the
# reproducibility contract documented in image-builder/README.md. Re-resolve
# with: `docker buildx imagetools inspect nixos/nix:latest --format '{{json .Manifest.Digest}}'`
ARG NIXOS_NIX_DIGEST=sha256:bf1d938835ab96312f098fa6c2e9cab367728e0aad0646ee3e02a787c80d8fb8
ARG ALPINE_DIGEST=sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc

FROM nixos/nix@${NIXOS_NIX_DIGEST} AS builder
ARG FLAVOR
ARG TARGETARCH

# Enable flakes + disable the nix sandbox. Docker containers don't expose the
# cgroup + setuid bits nix's sandbox needs; the container itself is the
# isolation boundary, so nested sandboxing is both impossible and redundant.
RUN echo 'experimental-features = nix-command flakes' >> /etc/nix/nix.conf \
    && echo 'sandbox = false' >> /etc/nix/nix.conf \
    && echo 'filter-syscalls = false' >> /etc/nix/nix.conf

WORKDIR /work
COPY nixos/flake.nix /work/flake.nix

# The flake's `mkBundle` derivation emits kernel + initrd + closure metadata
# WITHOUT calling make-disk-image.nix (which would require /dev/kvm). The
# packer stage below uses mkfs.ext4 -d to build the rootfs from this bundle,
# matching how Alpine/Debian/Ubuntu produce their qcow2s.
RUN nix build --print-build-logs ".#nixos-${FLAVOR}" \
    && ls -la /work/result/

# Stage 2: assemble the NixOS closure into a raw ext4 rootfs and convert to
# qcow2. mkfs.ext4 -d copies an entire directory tree into a fresh ext4 image
# without needing a loopback device or KVM.
FROM alpine@${ALPINE_DIGEST} AS packer
ARG ALPINE_DIGEST
ARG TARGETARCH
ARG FLAVOR
ARG SOURCE_DATE_EPOCH

RUN apk add --no-cache qemu-img e2fsprogs coreutils findutils

WORKDIR /work
COPY --from=builder /work/result/  /bundle/
COPY --from=builder /nix/store     /nix/store

RUN set -eux; \
    PREFIX="nixos-mows-agent-${TARGETARCH}"; \
    mkdir -p /rootfs/nix/store /rootfs/etc /rootfs/nix/var/nix/profiles /rootfs/nix/var/nix/gcroots; \
    # Copy every store path in the system closure into the staging rootfs.
    # cp -a preserves perms/symlinks/timestamps; once everything is in place
    # we'll mtime-stamp the tree to SOURCE_DATE_EPOCH for reproducibility.
    while read path; do \
        cp -a "${path}" /rootfs/nix/store/; \
    done < /bundle/store-paths; \
    # NixOS marker file + nix-path-registration so `nix-store --verify` works
    # on first boot, plus the profile pointer & /init symlink the kernel
    # needs to launch userspace.
    touch /rootfs/etc/NIXOS; \
    cp /bundle/registration /rootfs/nix-path-registration; \
    TOPLEVEL=$(cat /bundle/toplevel-path); \
    ln -s "${TOPLEVEL}"      /rootfs/nix/var/nix/profiles/system; \
    ln -s "${TOPLEVEL}/init" /rootfs/init; \
    # Pin mtimes for reproducibility. Do NOT swallow with `|| true` (DEVOPS-14
    # / TECH-INFRA-14) — a touch failure is exactly the "silent reproducibility
    # break" class of bug. Suppress only the expected stderr from pseudo-FS
    # paths so the exit code surfaces real failures.
    find /rootfs -xdev \
        -not -path '/rootfs/proc/*' -not -path '/rootfs/sys/*' \
        -not -path '/rootfs/dev/*' -not -path '/rootfs/run/*' \
        -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} +; \
    # Size the image at rootfs-size + 1 GiB headroom, rounded up to 64 MiB.
    SIZE_KB=$(du -sk /rootfs | awk '{print $1}'); \
    IMG_BYTES=$(( (SIZE_KB * 1024 + 1024 * 1024 * 1024 + 64 * 1024 * 1024 - 1) / (64 * 1024 * 1024) * (64 * 1024 * 1024) )); \
    truncate -s "${IMG_BYTES}" /work/rootfs.img; \
    # Fixed UUID matches the convention used by pack.sh for the other distros.
    # `-U random` would inject a fresh random superblock UUID on every build and
    # break the .sha256 reproducibility contract.
    mkfs.ext4 -F -L nixos -U "00000000-0000-0000-0000-000000000001" -E "hash_seed=11111111-2222-3333-4444-555555555555" -d /rootfs /work/rootfs.img; \
    mkdir -p /out; \
    qemu-img convert -O qcow2 -c /work/rootfs.img "/out/${PREFIX}.qcow2"; \
    cp /bundle/kernel "/out/${PREFIX}.vmlinuz"; \
    cp /bundle/initrd "/out/${PREFIX}.initramfs"; \
    for f in "/out/${PREFIX}.qcow2" "/out/${PREFIX}.vmlinuz" "/out/${PREFIX}.initramfs"; do \
        touch -hcd "@${SOURCE_DATE_EPOCH}" "${f}"; \
        sha256sum "${f}" | awk '{print $1}' > "${f}.sha256"; \
    done

FROM scratch AS export
COPY --from=packer /out/ /
