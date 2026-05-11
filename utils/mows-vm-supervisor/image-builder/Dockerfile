# syntax=docker/dockerfile:1.7
#
# Reproducible Alpine VM image for mows-vm-supervisor.
#
# Output: /out/alpine-mows-agent-${TARGETARCH}.qcow2
#
# Layers (by purpose, in order so each can be cached independently):
#   1. APK base + busybox + openrc
#   2. agent runtime essentials (git, ssh, build tools, python, curl)
#   3. node + npm + pnpm
#   4. rustup toolchain
#   5. independent dockerd
#   6. claude CLI + plugin manifest
#   7. mows-agent-init service + sshd config
#
# All `apk` invocations pin a snapshot date via APK_REPOSITORY to keep the
# image bit-reproducible. SOURCE_DATE_EPOCH is honoured for tar/qcow2 ts.

ARG ALPINE_VERSION=3.20
ARG SOURCE_DATE_EPOCH=1735689600
ARG TARGETARCH=amd64

FROM scratch AS mows-bin
COPY dist-guest-bin/mows /mows

FROM alpine:${ALPINE_VERSION} AS rootfs

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

# Node + pnpm.
RUN apk add --no-cache nodejs npm \
    && npm install -g --no-audit --no-fund pnpm@9

# Rust toolchain (rustup, default stable). Bake PATH into /etc/profile.d so
# all login shells inside the guest pick it up automatically.
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN apk add --no-cache rustup \
    && rustup-init -y --default-toolchain stable --no-modify-path \
    && rustup component add rustfmt clippy \
    && printf 'export RUSTUP_HOME=/usr/local/rustup\nexport CARGO_HOME=/usr/local/cargo\nexport PATH="/usr/local/cargo/bin:$PATH"\n' \
        > /etc/profile.d/rust.sh \
    && chmod +x /etc/profile.d/rust.sh

# Independent dockerd inside the guest.
RUN apk add --no-cache docker docker-cli docker-compose \
    && rc-update add docker default

# Claude Code CLI.
# Anthropic publishes claude-code via npm. npm installs the binary symlink
# automatically; we just verify it landed on PATH.
RUN npm install -g --no-audit --no-fund @anthropic-ai/claude-code \
    && command -v claude >/dev/null \
    && claude --version

# mows + mpm — installed natively in the guest so agents can use the same
# tooling the host has. Built statically by image-builder/build.sh.
COPY --from=mows-bin /mows /usr/local/bin/mows
RUN chmod +x /usr/local/bin/mows && ln -sf mows /usr/local/bin/mpm

# Plugin manifests.
RUN mkdir -p /etc/mows-agent/kinds.d
COPY claude.yaml /etc/mows-agent/kinds.d/claude.yaml

# mows-agent-init OpenRC service: mounts 9p shares, drops authorized_keys,
# launches the agent binary as the login shell.
COPY mows-agent-init /etc/init.d/mows-agent-init
RUN chmod +x /etc/init.d/mows-agent-init \
    && rc-update add mows-agent-init default

# sshd: accept new host key, allow root with key auth, no password auth.
RUN ssh-keygen -A \
    && sed -i \
        -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' \
        -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
        -e 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/' \
        /etc/ssh/sshd_config

# fstab: mount 9p shares automatically when present.
COPY fstab /etc/fstab
# Network interfaces.
RUN mkdir -p /etc/network
COPY interfaces /etc/network/interfaces

# /workspace + /creds + /mowsinit dirs as 9p mountpoints.
RUN mkdir -p /workspace /creds /mowsinit

# Reproducibility: pin file mtimes to SOURCE_DATE_EPOCH on the final rootfs.
RUN find / -xdev -exec touch -hcd "@${SOURCE_DATE_EPOCH}" {} + 2>/dev/null || true

# Stage 2: pack rootfs into a qcow2 disk image.
FROM alpine:${ALPINE_VERSION} AS packer
ARG SOURCE_DATE_EPOCH
ARG TARGETARCH
RUN apk add --no-cache qemu-img e2fsprogs util-linux tar coreutils
WORKDIR /work
COPY --from=rootfs / /rootfs/
COPY pack.sh /work/pack.sh
RUN chmod +x /work/pack.sh \
    && SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH} TARGETARCH=${TARGETARCH} /work/pack.sh /rootfs /out

# Final stage: scratch container holding only the artefact.
FROM scratch AS export
COPY --from=packer /out/ /
