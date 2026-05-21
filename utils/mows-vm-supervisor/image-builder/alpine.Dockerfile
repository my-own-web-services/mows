# syntax=docker/dockerfile:1.7
#
# Reproducible Alpine VM image for mows-vm-supervisor.
#
# Output: /out/alpine-${FLAVOR}-mows-agent-${TARGETARCH}.qcow2 (the path is
# normalised by image-builder/build.sh; this Dockerfile writes the legacy
# `alpine-mows-agent-${TARGETARCH}.qcow2` name into /out).
#
# Build args:
#   FLAVOR={headless,desktop}  — desktop layers in xfce4 + a VNC autologin.
#
# Layers (by purpose, in order so each can be cached independently):
#   1. APK base + busybox + openrc
#   2. agent runtime essentials (git, ssh, build tools, python, curl)
#   3. node + npm + pnpm
#   4. rustup toolchain
#   5. independent dockerd
#   6. claude CLI + plugin manifest
#   7. mows-agent-init service + sshd config
#   8. (desktop only) xfce4 + VNC autostart
#
# Reproducibility caveats:
#  * `apk add` calls run against `dl-cdn.alpinelinux.org` for the major
#    version pinned by `ALPINE_DIGEST` (currently alpine:3.20). Alpine does
#    not run an official dated-snapshot service, so security backports do
#    land in-place and identical builds are guaranteed only within a
#    ~24-48h window of the original build. The base image digest above
#    locks the FROM, not the apk index.
#  * SOURCE_DATE_EPOCH is honoured for tar/qcow2 file mtimes — see the
#    `find / -xdev -exec touch` step at the bottom of stage 1.
#  * pnpm + claude-code + rustup toolchain are version-pinned via ARGs
#    further down (SECURITY-23/24 + DEVOPS-10/11/12).

ARG ALPINE_VERSION=3.20
# Digest of `alpine:3.20` at the time of pinning. Re-resolve with
# `docker buildx imagetools inspect alpine:3.20 --format '{{json .Manifest.Digest}}'`
# and refresh in lock-step with the unpinned tag if you bump ALPINE_VERSION.
ARG ALPINE_DIGEST=sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc
ARG SOURCE_DATE_EPOCH=1735689600
ARG TARGETARCH=amd64
ARG FLAVOR=headless

FROM scratch AS mows-bin
COPY dist-guest-bin/mows /mows

FROM alpine@${ALPINE_DIGEST} AS rootfs

ARG SOURCE_DATE_EPOCH

RUN apk add --no-cache \
        alpine-base \
        openrc \
        bash \
        ca-certificates \
        curl \
        wget \
        git \
        openssh \
        openssh-server \
        build-base \
        python3 \
        py3-pip \
        coreutils \
        findutils \
        sudo \
        e2fsprogs \
        syslinux \
        linux-virt \
        ifupdown-ng \
        iproute2 \
        dhcpcd \
        tmux \
    && rc-update add sshd default \
    && rc-update add networking default \
    && rc-update add devfs sysinit \
    && rc-update add procfs sysinit \
    && rc-update add sysfs sysinit

# Node + pnpm — pinned for reproducibility.
ARG PNPM_VERSION=9.15.4
RUN apk add --no-cache nodejs npm \
    && npm install -g --no-audit --no-fund "pnpm@${PNPM_VERSION}"

# Rust toolchain (rustup, pinned toolchain). The rustup-init binary is
# pulled from the alpine package snapshot (already content-pinned by the
# ALPINE_DIGEST FROM line) and the default toolchain is pinned to an
# exact version so a rebuild months later produces the same rustc.
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
ARG RUST_TOOLCHAIN=1.85.0
RUN apk add --no-cache rustup \
    && rustup-init -y --default-toolchain "${RUST_TOOLCHAIN}" --no-modify-path \
    && rustup component add rustfmt clippy
# Source of truth for the rustup interactive-shell environment lives in
# `common/rust.sh.profile` so the three distro Dockerfiles can't drift
# (DEVOPS-22). chmod fixes the bit since `COPY` strips the +x by default.
COPY common/rust.sh.profile /etc/profile.d/rust.sh
RUN chmod +x /etc/profile.d/rust.sh

# Independent dockerd inside the guest.
RUN apk add --no-cache docker docker-cli docker-compose \
    && rc-update add docker default

# Claude Code CLI — pinned so rebuilds don't silently pick up whatever
# version is `@latest` on the day of the build.
ARG CLAUDE_CODE_VERSION=2.1.145
RUN npm install -g --no-audit --no-fund "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    && command -v claude >/dev/null \
    && claude --version

# mows + mpm — installed natively in the guest so agents can use the same
# tooling the host has. Built statically by image-builder/build.sh.
COPY --from=mows-bin --chmod=755 /mows /usr/local/bin/mows
RUN ln -sf mows /usr/local/bin/mpm

# Plugin manifests.
RUN mkdir -p /etc/mows-agent/kinds.d
COPY claude.yaml /etc/mows-agent/kinds.d/claude.yaml

# mows-agent-init: distro-agnostic shell body in /usr/local/sbin, plus
# the OpenRC wrapper that invokes it. Identical body to Debian/Ubuntu/NixOS.
COPY common/mows-agent-init.sh /usr/local/sbin/mows-agent-init.sh
COPY common/mows-agent-init.openrc /etc/init.d/mows-agent-init
RUN chmod +x /usr/local/sbin/mows-agent-init.sh /etc/init.d/mows-agent-init \
    && rc-update add mows-agent-init default

# sshd: allow root with key auth, no password auth. Host keys are generated
# on first boot by /usr/local/sbin/mows-agent-init.sh so each VM has its own
# identity AND the .qcow2 stays bit-reproducible.
RUN sed -i \
        -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' \
        -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
        -e 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' \
        /etc/ssh/sshd_config

# fstab: mount 9p shares automatically when present.
COPY common/fstab /etc/fstab
# Network interfaces.
RUN mkdir -p /etc/network
COPY common/interfaces /etc/network/interfaces

# /workspace + /creds + /mowsinit dirs as 9p mountpoints.
RUN mkdir -p /workspace /creds /mowsinit

# Optional: desktop environment (xfce4) + tigervnc-bound autostart. The
# supervisor's `-vnc unix:.../display.sock` exposes the guest framebuffer
# either way; the desktop flavor just makes sure something interesting
# renders into that framebuffer.
ARG FLAVOR
RUN if [ "${FLAVOR}" = "desktop" ]; then \
        apk add --no-cache xfce4 xfce4-terminal dbus-x11 xorg-server \
            xinit setxkbmap mesa-dri-gallium \
        && rc-update add dbus default ; \
    fi

# Reproducibility: pin file mtimes to SOURCE_DATE_EPOCH on the final rootfs.
# Explicitly exclude pseudo-FS roots and proxy-cache dirs that legitimately
# need live mtimes. We deliberately do NOT swallow `2>/dev/null || true` —
# a touch failure is the most dangerous "silent reproducibility break"
# class of bug. If a new untouchable path appears, add it to the excludes
# list rather than masking the error.
RUN find / -xdev \
        -not -path '/proc/*' -not -path '/sys/*' \
        -not -path '/dev/*' -not -path '/run/*' \
        -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} +

# Stage 2: pack rootfs into a qcow2 disk image.
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
       DISTRO=alpine FLAVOR=${FLAVOR} \
       /work/pack.sh /rootfs /out

# Final stage: scratch container holding only the artefact.
FROM scratch AS export
COPY --from=packer /out/ /
