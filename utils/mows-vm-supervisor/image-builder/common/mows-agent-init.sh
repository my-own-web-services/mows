#!/bin/sh
# Distro-agnostic mows-agent-init body.
#
# Reads /mowsinit/{authorized_keys,run.yaml,profile.sh} (mounted via 9p),
# wires the supervisor-issued SSH key into root, picks the agent kind, and
# marks readiness for the supervisor's SSH-banner probe.
#
# Sourced (with `. /usr/local/sbin/mows-agent-init.sh`) by the per-distro
# init wrapper — OpenRC service on Alpine, systemd unit elsewhere.

set -e

if [ ! -d /mowsinit ]; then
    echo "mows-agent-init: /mowsinit missing — supervisor 9p share absent" >&2
    exit 1
fi

install -d -m 0700 /root/.ssh
if [ -f /mowsinit/authorized_keys ]; then
    install -m 0600 /mowsinit/authorized_keys /root/.ssh/authorized_keys
fi

# Generate per-VM SSH host keys on first boot so each guest has its own
# identity. Baking host keys into the image would (a) make every VM share
# the same identity — a confused-deputy smell — and (b) break the
# reproducibility contract because ssh-keygen output is non-deterministic.
if [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
    ssh-keygen -A >/dev/null 2>&1 || true
fi

if [ -f /mowsinit/run.yaml ]; then
    kind=$(awk -F': *' '$1=="kind"{print $2; exit}' /mowsinit/run.yaml)
    echo "MOWS_AGENT_KIND=${kind:-claude}" >> /etc/environment
fi

if [ -f /mowsinit/profile.sh ]; then
    install -m 0644 /mowsinit/profile.sh /etc/profile.d/mows-agent.sh
fi

mkdir -p /run
touch /run/mows-agent-init.ready
