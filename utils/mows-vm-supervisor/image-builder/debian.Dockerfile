# syntax=docker/dockerfile:1.7
#
# Reproducible Debian VM image for mows-vm-supervisor.
#
# Output: written to /out as `debian-mows-agent-${TARGETARCH}.{qcow2,vmlinuz,initramfs}`.
# `image-builder/build.sh` renames to `debian-${FLAVOR}-mows-agent-...` afterwards.
#
# Build args:
#   FLAVOR={headless,desktop}  — desktop adds xfce4 + a VNC autostart.
#
# Layers (cached independently):
#   1. apt base + kernel (linux-image-amd64) + systemd userland
#   2. agent runtime essentials (git, ssh, build-essential, python3, curl)
#   3. node + npm + pnpm
#   4. rustup toolchain
#   5. dockerd
#   6. claude CLI + plugin manifest
#   7. mows binary + mows-agent-init systemd service + sshd config
#   8. (desktop only) xfce4 + autostart
#
# Reproducibility: SOURCE_DATE_EPOCH stamps every file in the final rootfs.
# Debian package versions are pinned via snapshot.debian.org when
# DEBIAN_SNAPSHOT is set (defaults to a fixed snapshot for repeatable builds).

ARG DEBIAN_RELEASE=trixie
# Digest of `debian:trixie-slim` at pin time. Re-resolve with
# `docker buildx imagetools inspect debian:trixie-slim --format '{{json .Manifest.Digest}}'`
# when bumping DEBIAN_RELEASE.
ARG DEBIAN_DIGEST=sha256:8d7a3dca57e62717b0f10897aca189da5d7acde3cc1ced657bdfd06ef5379576
ARG ALPINE_DIGEST=sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
ARG SOURCE_DATE_EPOCH=1735689600
ARG TARGETARCH=amd64
ARG FLAVOR=headless

FROM scratch AS mows-bin
COPY dist-guest-bin/mows /mows

FROM debian@${DEBIAN_DIGEST} AS rootfs

ARG SOURCE_DATE_EPOCH
ARG TARGETARCH
ARG FLAVOR

# Avoid interactive prompts; clean apt cache aggressively to keep the
# rootfs lean (we'll mtime-stamp everything at the end anyway).
ENV DEBIAN_FRONTEND=noninteractive

# Base + kernel + systemd userland.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget \
        systemd systemd-sysv udev \
        linux-image-amd64 initramfs-tools \
        openssh-server \
        ifupdown isc-dhcp-client iproute2 iputils-ping \
        sudo procps less vim-tiny \
        coreutils findutils \
        git build-essential python3 python3-pip \
        tmux \
    && rm -rf /var/lib/apt/lists/* \
    && systemctl enable ssh systemd-networkd \
    && update-initramfs -c -k all

# Node + pnpm. pnpm is pinned to an exact version so a rebuild months
# later produces the same binary.
ARG PNPM_VERSION=9.15.4
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && npm install -g --no-audit --no-fund "pnpm@${PNPM_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

# Rust toolchain. We download the rustup-init binary from a versioned URL
# under static.rust-lang.org and verify its SHA256 before executing, so
# the build is reproducible even if `https://sh.rustup.rs` rotates to a
# newer rustup release.
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
ARG RUSTUP_VERSION=1.29.0
ARG RUSTUP_INIT_SHA256_AMD64=4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10
ARG RUST_TOOLCHAIN=1.85.0
RUN set -eux; \
    curl --proto '=https' --tlsv1.2 -fsSL \
        "https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/x86_64-unknown-linux-gnu/rustup-init" \
        -o /tmp/rustup-init; \
    echo "${RUSTUP_INIT_SHA256_AMD64}  /tmp/rustup-init" | sha256sum -c -; \
    chmod +x /tmp/rustup-init; \
    /tmp/rustup-init -y --default-toolchain "${RUST_TOOLCHAIN}" --no-modify-path; \
    rm /tmp/rustup-init; \
    rustup component add rustfmt clippy
# Shared profile script — keep this in sync via `common/rust.sh.profile`
# rather than re-templating per-distro (DEVOPS-22).
COPY common/rust.sh.profile /etc/profile.d/rust.sh
RUN chmod +x /etc/profile.d/rust.sh

# Independent dockerd inside the guest.
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io docker-compose \
    && rm -rf /var/lib/apt/lists/* \
    && systemctl enable docker

# Claude Code CLI — pinned so a rebuild months later doesn't silently
# pull whatever Anthropic publishes as @latest that day.
ARG CLAUDE_CODE_VERSION=2.1.145
RUN npm install -g --no-audit --no-fund "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    && command -v claude >/dev/null \
    && claude --version

# Static mows binary (built by image-builder/build.sh).
COPY --from=mows-bin /mows /usr/local/bin/mows
RUN chmod +x /usr/local/bin/mows && ln -sf mows /usr/local/bin/mpm

# Plugin manifests.
RUN mkdir -p /etc/mows-agent/kinds.d
COPY claude.yaml /etc/mows-agent/kinds.d/claude.yaml

# mows-agent-init: distro-agnostic body in /usr/local/sbin + systemd unit.
COPY common/mows-agent-init.sh /usr/local/sbin/mows-agent-init.sh
COPY common/mows-agent-init.service /etc/systemd/system/mows-agent-init.service
RUN chmod +x /usr/local/sbin/mows-agent-init.sh \
    && systemctl enable mows-agent-init.service

# systemd-networkd: DHCP on QEMU's virtio-net interface so sshd is reachable
# from the host port forward.
COPY common/20-mows-agent.network /etc/systemd/network/20-mows-agent.network

# sshd: key-only root login, no password auth. Host keys are generated on
# first boot by /usr/local/sbin/mows-agent-init.sh so each VM has its own
# identity AND the .qcow2 stays bit-reproducible.
RUN sed -i \
        -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' \
        -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
        -e 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' \
        /etc/ssh/sshd_config

# 9p mount points.
RUN mkdir -p /workspace /creds /mowsinit
COPY common/fstab /etc/fstab

# Optional: XFCE desktop environment + dbus. Same VNC framebuffer story as
# Alpine — the supervisor exposes the QEMU framebuffer; this layer makes
# sure something interesting renders into it.
RUN if [ "${FLAVOR}" = "desktop" ]; then \
        apt-get update \
        && apt-get install -y --no-install-recommends \
            xfce4 xfce4-terminal xfce4-goodies \
            dbus-x11 xorg xserver-xorg-video-qxl \
            xinit lightdm lightdm-gtk-greeter \
        && rm -rf /var/lib/apt/lists/* \
        && systemctl enable lightdm ; \
    fi

# Reproducibility: pin file mtimes to SOURCE_DATE_EPOCH.
# Pin file mtimes to SOURCE_DATE_EPOCH on the final rootfs; do NOT swallow
# touch failures (silent reproducibility regression risk per DEVOPS-14).
RUN find / -xdev \
        -not -path '/proc/*' -not -path '/sys/*' \
        -not -path '/dev/*' -not -path '/run/*' \
        -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} +

# Stage 2: pack rootfs into a qcow2 disk image. Re-use the Alpine packer image
# since `mkfs.ext4 -d` works the same regardless of the guest distro.
FROM alpine@${ALPINE_DIGEST} AS packer
ARG ALPINE_DIGEST
ARG SOURCE_DATE_EPOCH
ARG TARGETARCH
ARG FLAVOR
RUN apk add --no-cache qemu-img e2fsprogs util-linux tar coreutils
WORKDIR /work
COPY --from=rootfs / /rootfs/
COPY pack.sh /work/pack.sh
RUN chmod +x /work/pack.sh \
    && SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH} TARGETARCH=${TARGETARCH} \
       DISTRO=debian FLAVOR=${FLAVOR} \
       /work/pack.sh /rootfs /out

FROM scratch AS export
COPY --from=packer /out/ /
