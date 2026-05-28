#!/bin/sh
# Bootstrap script for the `claude` agent kind. Runs inside the per-agent
# qcow2 overlay each time an agent is spawned. Embedded into the
# supervisor binary via `include_str!` so the source of truth is this
# file, not a string literal in `kinds.rs`.
#
# Steps (each idempotent — cheap on warm runs):
#   1. Create the `agent` user if missing (claude refuses several
#      permission modes as root).
#   2. Stage credentials from the read-only `/creds` mount into a
#      writable per-VM copy in `/home/agent/.claude`. If `.claude.json`
#      is missing or zero-byte, restore from the most recent backup.
#   3. Stage plugins from `/creds/plugins` if present.
#   4. Patch `.claude.json` to: bypass the onboarding + trust dialogs,
#      disable the auto-updater, and inject the chrome-devtools MCP
#      server entry.
#   5. Hand workspace ownership to `agent`.
#   6. Drop privileges with `su` and exec claude with the right
#      `CLAUDE_CONFIG_DIR` + `HOME`.
#
# The MCP server table is materialised by the supervisor and injected
# via the `MOWS_CLAUDE_MCP_SERVERS` env var as a JSON object so this
# script stays kind-agnostic and the supervisor side can grow new
# servers without re-editing shell code.
#
# `--dangerously-skip-permissions`: the per-agent qcow2 overlay
# sandboxes filesystem mutations to the ephemeral guest disk, so the
# cost of a wrong tool invocation is bounded to one VM. The user has
# already pre-accepted the bypass mode in `.claude.json`
# (`bypassPermissionsModeAccepted`) so claude launches without a
# confirmation prompt on top.
#
# Errors:
#  - We deliberately do NOT mask every failure with `2>/dev/null || true`.
#    The previous behaviour swallowed real failures (missing `/creds`
#    mount, ENOSPC, permission errors) and left agents booting with
#    incomplete or absent credentials. Where a step is *expected* to
#    fail under known benign conditions (e.g. a fresh image without a
#    `/creds` mount), guard it explicitly with `[ -e ]` rather than
#    silencing all errors.
#
# Symlink safety: the staging copies use `cp -a --no-dereference`
# (BusyBox supports the long form) so attacker-placed symlinks in
# `/creds/plugins` cannot dereference paths outside the read-only mount
# during the copy.

set -e

id agent >/dev/null 2>&1 || adduser -D -s /bin/sh agent

install -d -o agent -g agent /home/agent/.claude /home/agent/.claude/backups

if [ -d /creds ]; then
    # Selective credential staging — see kinds.rs `builtin_claude` for
    # the rationale on why we don't bulk-copy /creds. Each file is
    # optional; the agent still boots without it.
    if [ -s /creds/.claude.json ]; then
        cp /creds/.claude.json /home/agent/.claude/.claude.json
    fi
    if [ -f /creds/.credentials.json ]; then
        cp /creds/.credentials.json /home/agent/.claude/.credentials.json
    fi
    if [ -f /creds/settings.json ]; then
        cp /creds/settings.json /home/agent/.claude/
    fi
    if [ -f /creds/settings.local.json ]; then
        cp /creds/settings.local.json /home/agent/.claude/
    fi

    if [ -d /creds/backups ]; then
        # Non-zero-length backups only; claude leaves zero-byte
        # backup files behind when it crashes mid-write.
        for backup_file in /creds/backups/.claude.json.backup.*; do
            if [ -s "$backup_file" ]; then
                cp "$backup_file" /home/agent/.claude/backups/
            fi
        done
    fi

    if [ -d /creds/plugins ]; then
        # Plugin staging is mandatory once /creds/plugins exists —
        # silent failure here was the CRIT-4 finding (agents boot
        # plugin-less, operator never finds out). Validate the source
        # is a real directory (not a symlink, not a special file)
        # before copying, and let `cp` errors propagate via `set -e`.
        if [ -L /creds/plugins ]; then
            echo "mows-vm-supervisor: /creds/plugins is a symlink — refusing to follow" >&2
            exit 1
        fi
        # `--no-dereference` keeps symlinks inside the tree as symlinks
        # rather than following them to host paths outside /creds. The
        # nested loop avoids the "first cp creates the dir, second cp
        # nests under it" bug `cp -a SRC DST` has when DST already
        # exists.
        rm -rf /home/agent/.claude/plugins
        cp -a --no-dereference /creds/plugins /home/agent/.claude/plugins
    fi

    if [ ! -s /home/agent/.claude/.claude.json ]; then
        latest_backup=""
        for backup_file in $(ls -1t /home/agent/.claude/backups/.claude.json.backup.* 2>/dev/null); do
            if [ -s "$backup_file" ]; then
                latest_backup="$backup_file"
                break
            fi
        done
        if [ -n "$latest_backup" ]; then
            cp "$latest_backup" /home/agent/.claude/.claude.json
        fi
    fi

    # Patch `.claude.json` to pre-accept onboarding, disable the
    # in-place auto-updater, and inject the MCP server table the
    # supervisor passed in via $MOWS_CLAUDE_MCP_SERVERS. Letting the
    # supervisor own the MCP table means adding a new server (e.g.
    # docs lookup, db explorer) is a Rust-side data change — no
    # shell editing required. `python3 -c` is preferable to `jq` here
    # because the alpine base ships python3 unconditionally and we
    # already use it elsewhere.
    python3 -c "
import json
import os
import pathlib

config_path = pathlib.Path('/home/agent/.claude/.claude.json')
config_src = config_path.read_text() if config_path.exists() else '{}'
loaded = json.loads(config_src) if config_src.strip() else {}
config = loaded if isinstance(loaded, dict) else {}

config.setdefault('hasCompletedOnboarding', True)
config.setdefault('bypassPermissionsModeAccepted', True)
config['autoUpdaterStatus'] = 'disabled'
config['autoUpdates'] = False

mcp_table = config.setdefault('mcpServers', {})
mcp_payload = os.environ.get('MOWS_CLAUDE_MCP_SERVERS', '')
if mcp_payload:
    parsed_mcp = json.loads(mcp_payload)
    if isinstance(parsed_mcp, dict):
        for name, spec in parsed_mcp.items():
            mcp_table[name] = spec

projects = config.setdefault('projects', {})
for workspace_path in ('/workspace', '/home/agent', '/'):
    existing = projects.get(workspace_path)
    project_entry = existing if isinstance(existing, dict) else {}
    project_entry['hasTrustDialogAccepted'] = True
    project_entry['hasCompletedProjectOnboarding'] = True
    projects[workspace_path] = project_entry

config_path.parent.mkdir(parents=True, exist_ok=True)
config_path.write_text(json.dumps(config, indent=2))
"

    chown -R agent:agent /home/agent/.claude
fi

if [ -d /workspace ]; then
    chown agent:agent /workspace || true
fi

# Drop privileges and exec claude. The `su` discards the parent env, so
# every variable the agent needs is re-exported inside the inner shell.
exec su -s /bin/sh agent -c \
    'cd /workspace 2>/dev/null || cd; \
     export HOME=/home/agent CLAUDE_CONFIG_DIR=/home/agent/.claude DISABLE_AUTOUPDATER=1 \
            PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser; \
     exec /usr/local/bin/claude --dangerously-skip-permissions'
