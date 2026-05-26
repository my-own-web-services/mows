//! Agent-kind plugin manifest.
//!
//! Each kind (claude today, aider/codex/etc. tomorrow) is described by a
//! single YAML file. The host-side supervisor doesn't need to know what's
//! inside the VM beyond what these manifests state, so adding a new kind is
//! "drop a yaml file into the image + register it".

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{Result, SupervisorError};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct AgentKind {
    pub name: String,
    /// Path to the agent binary inside the VM.
    pub binary: String,
    /// Argv used to start the agent in interactive mode (defaults to `[binary]`).
    #[serde(default)]
    pub argv: Vec<String>,
    /// Login command to run if no credentials are present (e.g. `claude login`).
    pub login_command: Option<String>,
    /// Extra environment variables passed when launching the agent.
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    /// Filesystem path inside the guest where credentials are mounted (read-only).
    /// For claude this is the host's `~/.claude` directory.
    #[serde(default)]
    pub credentials_mount: Option<String>,
}

impl AgentKind {
    pub fn from_yaml(s: &str) -> Result<Self> {
        let parsed: Self = serde_yaml_neo::from_str(s)?;
        parsed.validate()?;
        Ok(parsed)
    }

    pub fn from_file(path: &Path) -> Result<Self> {
        let contents = std::fs::read_to_string(path).map_err(|e| {
            SupervisorError::Config(format!(
                "failed to read kind manifest {}: {e}",
                path.display()
            ))
        })?;
        Self::from_yaml(&contents)
    }

    /// Reject env keys that aren't valid POSIX env-var names. The values
    /// are escaped at the point of use (`agent_runtime` shell-quotes them),
    /// but the keys are interpolated bare into the tmux launch command —
    /// a key containing `;` or whitespace would turn the assignment into
    /// a separate shell command. Builtin kinds always pass; this gate
    /// fires when a kind is parsed from a user-supplied YAML file under
    /// `kinds.d/`.
    fn validate(&self) -> Result<()> {
        for key in self.env.keys() {
            if !is_valid_posix_env_name(key) {
                return Err(SupervisorError::Config(format!(
                    "agent kind `{}`: env key {key:?} is not a valid POSIX env-var name \
                     (must match [A-Za-z_][A-Za-z0-9_]*)",
                    self.name
                )));
            }
        }
        Ok(())
    }
}

fn is_valid_posix_env_name(s: &str) -> bool {
    let mut chars = s.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !(first.is_ascii_alphabetic() || first == '_') {
        return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Built-in `shell` kind — boots the VM and drops the user at a plain bash
/// prompt with `/workspace` + `/creds` mounted, no auto-launched agent.
/// This is the generic primitive the rest of the platform spawns and the
/// `agent` subcommand layers on top.
pub fn builtin_shell() -> AgentKind {
    AgentKind {
        name: "shell".to_string(),
        binary: "/bin/bash".to_string(),
        // Empty argv → profile.sh skips the auto-launch shim entirely and
        // sshd's default shell takes over.
        argv: Vec::new(),
        login_command: None,
        env: BTreeMap::new(),
        credentials_mount: None,
    }
}

/// Built-in claude manifest, used as a fallback when no on-disk manifest is
/// present and so unit tests don't need a filesystem.
///
/// `/creds` is bind-mounted **read-only** into the guest (the host's
/// `~/.claude`). Claude itself needs to write its session state, so we
/// can't point `CLAUDE_CONFIG_DIR` at `/creds` directly. The argv below
/// stages a writable per-VM copy in `/root/.claude` before launching
/// claude:
///
/// 1. Copy everything from `/creds/` (real Claude Code config + backups)
///    into `/root/.claude`.
/// 2. If `.claude.json` is missing (a recurring pre-existing state on
///    some hosts where claude itself rotated the file out), restore from
///    the most recent `backups/.claude.json.backup.*` so the agent boots
///    instead of re-printing the "configuration file not found" loop.
/// 3. Exec claude pointed at the writable copy.
///
/// All work happens inside the VM via the SSH-launched shell, so it only
/// runs once per agent spawn and leaves the host `/creds` untouched.
pub fn builtin_claude() -> AgentKind {
    // Claude refuses to run several permission modes as root, so we run it
    // as a dedicated non-root `agent` user inside the VM. The user is
    // created lazily on first agent spawn (idempotent) so the cached image
    // doesn't have to know about it.
    //
    // `--permission-mode acceptEdits` ("auto mode" in the TUI) auto-approves
    // file edits but still prompts for shell commands, which is the right
    // default inside a per-VM sandbox: edits are scoped to the ephemeral
    // qcow2 overlay, but operators still want a confirmation before random
    // `rm -rf` style commands run unattended.
    //
    // `DISABLE_AUTOUPDATER=1` stops claude from trying to npm-i a new
    // version in-place (the binary lives under `/usr/local`, the agent
    // user can't write there — every boot would emit a noisy
    // "Auto-update failed" line otherwise). The `autoUpdaterStatus` /
    // `autoUpdates` keys staged into `.claude.json` cover the equivalent
    // config-file knob so changing the launch command later won't
    // accidentally re-enable it.
    //
    // Steps (all happen inside the VM via the SSH-launched shell, every time
    // an agent is created — cheap on warm runs):
    //   1. Create the `agent` user if missing.
    //   2. Stage credentials in `/home/agent/.claude` (writable copy of the
    //      read-only `/creds` mount). If `.claude.json` is gone, restore from
    //      the most recent `backups/.claude.json.backup.*`.
    //   3. Make the workspace writable by `agent` (host uid mapping isn't
    //      guaranteed via 9p `security_model=mapped-xattr`).
    //   4. Drop privileges with `su` and exec claude with the right
    //      `CLAUDE_CONFIG_DIR` + `HOME`, starting in `/workspace`.
    // We deliberately do NOT bulk-copy `/creds` — the user's host
    // `~/.claude` accumulates large dirs (`file-history`, `cache`,
    // `image-cache`, `projects`, `sessions`, …) plus the occasional
    // symlink loop in `debug/latest`. A blanket `cp -a` either fills the
    // VM disk or aborts on the loop, leaving the agent without auth.
    //
    // What claude actually needs to start cleanly inside the VM:
    //   - `.claude.json`           — the active OAuth config
    //   - `backups/`               — fallback if `.claude.json` is empty
    //   - `settings.json` / `settings.local.json` — user prefs
    //
    // Everything else is regenerated per-VM. `[ ! -s file ]` covers both
    // "missing" and "zero-byte" states (the latter is what claude leaves
    // behind when it crashes mid-write — that bug is in claude, not us).
    // After staging credentials, pre-mark `/workspace` (and `/`, which
    // claude uses when /workspace is unavailable) as trusted in
    // `.claude.json`. The host's trust list is keyed by the *host's*
    // workspace path (`/home/<user>/projects/...`), so a copied
    // `.claude.json` always re-shows the "Is this folder trusted?"
    // dialog inside the VM. Setting `projects./workspace.hasTrustDialogAccepted`
    // up front bypasses the prompt; the alpine image ships python3 so
    // we use it as the JSON editor of choice (no jq dependency).
    let bootstrap = "set -e; \
        id agent >/dev/null 2>&1 || adduser -D -s /bin/sh agent; \
        install -d -o agent -g agent /home/agent/.claude /home/agent/.claude/backups; \
        if [ -d /creds ]; then \
            [ -s /creds/.claude.json ] && cp /creds/.claude.json /home/agent/.claude/.claude.json 2>/dev/null || true; \
            [ -f /creds/.credentials.json ] && cp /creds/.credentials.json /home/agent/.claude/.credentials.json 2>/dev/null || true; \
            [ -f /creds/settings.json ] && cp /creds/settings.json /home/agent/.claude/ 2>/dev/null || true; \
            [ -f /creds/settings.local.json ] && cp /creds/settings.local.json /home/agent/.claude/ 2>/dev/null || true; \
            if [ -d /creds/backups ]; then \
                for b in /creds/backups/.claude.json.backup.*; do \
                    [ -s \"$b\" ] && cp \"$b\" /home/agent/.claude/backups/ 2>/dev/null || true; \
                done; \
            fi; \
            if [ ! -s /home/agent/.claude/.claude.json ]; then \
                latest=$(ls -1t /home/agent/.claude/backups/.claude.json.backup.* 2>/dev/null \
                    | while read f; do [ -s \"$f\" ] && { echo \"$f\"; break; }; done); \
                if [ -n \"$latest\" ]; then cp \"$latest\" /home/agent/.claude/.claude.json; fi; \
            fi; \
            python3 -c \"import json, pathlib; p=pathlib.Path('/home/agent/.claude/.claude.json'); \
src=p.read_text() if p.exists() else '{}'; \
d=(lambda v: v if isinstance(v, dict) else {})(json.loads(src)); \
d.setdefault('hasCompletedOnboarding', True); \
d.setdefault('bypassPermissionsModeAccepted', True); \
d['autoUpdaterStatus']='disabled'; \
d['autoUpdates']=False; \
prj=d.setdefault('projects', {}); \
[prj.__setitem__(k, dict((prj.get(k) if isinstance(prj.get(k), dict) else {}), hasTrustDialogAccepted=True, hasCompletedProjectOnboarding=True)) for k in ('/workspace', '/home/agent', '/')]; \
p.parent.mkdir(parents=True, exist_ok=True); \
p.write_text(json.dumps(d, indent=2))\" 2>/dev/null || true; \
            chown -R agent:agent /home/agent/.claude; \
        fi; \
        if [ -d /workspace ]; then chown agent:agent /workspace 2>/dev/null || true; fi; \
        exec su -s /bin/sh agent -c \
            'cd /workspace 2>/dev/null || cd; \
             export HOME=/home/agent CLAUDE_CONFIG_DIR=/home/agent/.claude DISABLE_AUTOUPDATER=1; \
             exec /usr/local/bin/claude --permission-mode acceptEdits'";

    AgentKind {
        name: "claude".to_string(),
        binary: "/usr/local/bin/claude".to_string(),
        // The agent is sandboxed by KVM + per-agent qcow2 overlay, so
        // granting full tool permissions is the right default — anything
        // it does is contained to its own ephemeral guest.
        argv: vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            bootstrap.to_string(),
        ],
        login_command: Some("/usr/local/bin/claude login".to_string()),
        // SLOP-37: the canonical `CLAUDE_CONFIG_DIR` is set by the bootstrap
        // shell (under the `agent` user, pointing at /home/agent/.claude).
        // Setting it here too would be either redundant or contradictory —
        // the `su -c` in the bootstrap discards the parent env anyway, so a
        // mismatch here is dead code at best, a foot-gun at worst. Keep
        // `env` empty for the claude kind.
        env: BTreeMap::new(),
        credentials_mount: Some("/creds".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_manifest() {
        let yaml = r#"
name: claude
binary: /usr/local/bin/claude
login_command: claude login
env:
  CLAUDE_CONFIG_DIR: /creds
credentials_mount: /creds
"#;
        let kind = AgentKind::from_yaml(yaml).unwrap();
        assert_eq!(kind.name, "claude");
        assert_eq!(kind.binary, "/usr/local/bin/claude");
        assert_eq!(kind.env.get("CLAUDE_CONFIG_DIR").map(String::as_str), Some("/creds"));
    }

    #[test]
    fn rejects_unknown_fields() {
        let yaml = r#"
name: claude
binary: /x
unknown_field: nope
"#;
        assert!(AgentKind::from_yaml(yaml).is_err());
    }

    #[test]
    fn builtin_claude_round_trips() {
        let k = builtin_claude();
        let yaml = serde_yaml_neo::to_string(&k).unwrap();
        let parsed = AgentKind::from_yaml(&yaml).unwrap();
        assert_eq!(parsed.name, "claude");
    }

    #[test]
    fn rejects_env_key_with_shell_metacharacters() {
        // A YAML manifest under `kinds.d/` that smuggles `;` into an env
        // key would let the value-quoting in agent_runtime become a
        // command separator. Block it at the parse boundary.
        let yaml = r#"
name: evil
binary: /bin/sh
env:
  "FOO; rm -rf /tmp;": bar
"#;
        let err = AgentKind::from_yaml(yaml).unwrap_err();
        let msg = format!("{err}");
        assert!(
            msg.contains("not a valid POSIX env-var name"),
            "expected POSIX-name error, got: {msg}"
        );
    }

    #[test]
    fn rejects_env_key_starting_with_digit() {
        let yaml = r#"
name: evil
binary: /bin/sh
env:
  "1FOO": bar
"#;
        assert!(AgentKind::from_yaml(yaml).is_err());
    }

    #[test]
    fn shipped_claude_manifest_parses() {
        // The manifest baked into the VM image must match the schema this
        // crate enforces — otherwise guests boot with a broken kind.
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("image-builder")
            .join("claude.yaml");
        let parsed = AgentKind::from_file(&path).expect("shipped claude.yaml parses");
        assert_eq!(parsed.name, "claude");
        assert_eq!(parsed.binary, "/usr/local/bin/claude");
        assert_eq!(parsed.credentials_mount.as_deref(), Some("/creds"));
    }
}
