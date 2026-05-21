# syntax=docker/dockerfile:1.7
#
# Reproducible Ubuntu VM image for mows-vm-supervisor.
#
# Layered identically to debian.Dockerfile; the only differences:
#   - `FROM ubuntu:24.04` instead of `FROM debian:trixie-slim`
#   - kernel package `linux-image-generic` instead of `linux-image-amd64`
#   - tag matches `ubuntu-<flavor>-mows-agent-<arch>.qcow2`
#
# Custom packages: add `apt-get install ...` lines below alongside the
# default ones, and rebuild via `bash build.sh --distro ubuntu --flavor X`.

ARG UBUNTU_VERSION=24.04
# Digest of `ubuntu:24.04` at pin time. Re-resolve with
# `docker buildx imagetools inspect ubuntu:24.04 --format '{{json .Manifest.Digest}}'`
# when bumping UBUNTU_VERSION.
ARG UBUNTU_DIGEST=sha256:c4a8d5503dfb2a3eb8ab5f807da5bc69a85730fb49b5cfca2330194ebcc41c7b
ARG ALPINE_DIGEST=sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
ARG SOURCE_DATE_EPOCH=1735689600
ARG TARGETARCH=amd64
ARG FLAVOR=headless

FROM scratch AS mows-bin
COPY dist-guest-bin/mows /mows

FROM ubuntu@${UBUNTU_DIGEST} AS rootfs

ARG SOURCE_DATE_EPOCH
ARG TARGETARCH
ARG FLAVOR

ENV DEBIAN_FRONTEND=noninteractive

# Base + kernel + systemd userland.
# `linux-image-generic` ships the initramfs hooks but Docker's
# pseudo-environment skips the postinst trigger; force initramfs generation
# explicitly so pack.sh can find /boot/initrd.img-* at the end.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl wget \
        systemd systemd-sysv udev \
        linux-image-generic initramfs-tools \
        openssh-server \
        netplan.io \
        iproute2 iputils-ping \
        sudo procps less vim-tiny \
        coreutils findutils \
        git build-essential python3 python3-pip \
        tmux \
    && rm -rf /var/lib/apt/lists/* \
    && systemctl enable ssh systemd-networkd \
    && update-initramfs -c -k all

# Node + pnpm.
ARG PNPM_VERSION=9.15.4
RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm \
    && npm install -g --no-audit --no-fund "pnpm@${PNPM_VERSION}" \
    && rm -rf /var/lib/apt/lists/*

# Rust toolchain — SHA-pinned rustup-init binary, pinned toolchain version.
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

# dockerd.
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io docker-compose \
    && rm -rf /var/lib/apt/lists/* \
    && systemctl enable docker

# Claude Code CLI — pinned for reproducibility.
ARG CLAUDE_CODE_VERSION=2.1.145
RUN npm install -g --no-audit --no-fund "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    && command -v claude >/dev/null \
    && claude --version

COPY --from=mows-bin /mows /usr/local/bin/mows
RUN chmod +x /usr/local/bin/mows && ln -sf mows /usr/local/bin/mpm

RUN mkdir -p /etc/mows-agent/kinds.d
COPY claude.yaml /etc/mows-agent/kinds.d/claude.yaml

COPY common/mows-agent-init.sh /usr/local/sbin/mows-agent-init.sh
COPY common/mows-agent-init.service /etc/systemd/system/mows-agent-init.service
RUN chmod +x /usr/local/sbin/mows-agent-init.sh \
    && systemctl enable mows-agent-init.service

# systemd-networkd config (DHCP on the virtio-net iface).
COPY common/20-mows-agent.network /etc/systemd/network/20-mows-agent.network

# Host keys generated on first boot by mows-agent-init.sh (each VM gets its
# own identity; .qcow2 stays bit-reproducible).
RUN sed -i \
        -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' \
        -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
        -e 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' \
        /etc/ssh/sshd_config

RUN mkdir -p /workspace /creds /mowsinit
COPY common/fstab /etc/fstab

RUN if [ "${FLAVOR}" = "desktop" ]; then \
        apt-get update \
        && apt-get install -y --no-install-recommends \
            xfce4 xfce4-terminal xfce4-goodies \
            dbus-x11 xorg xserver-xorg-video-qxl \
            lightdm lightdm-gtk-greeter \
        && rm -rf /var/lib/apt/lists/* \
        && systemctl enable lightdm ; \
    fi

# Pin file mtimes to SOURCE_DATE_EPOCH on the final rootfs; do NOT swallow
# touch failures (silent reproducibility regression risk per DEVOPS-14).
RUN find / -xdev \
        -not -path '/proc/*' -not -path '/sys/*' \
        -not -path '/dev/*' -not -path '/run/*' \
        -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} +

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
       DISTRO=ubuntu FLAVOR=${FLAVOR} \
       /work/pack.sh /rootfs /out

FROM scratch AS export
COPY --from=packer /out/ /
