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

/// One MCP server entry inside an agent's `~/.claude.json`. The bootstrap
/// script materialises this set into the `mcpServers` JSON object at
/// agent-spawn time, so adding a server is a Rust-side data change rather
/// than an edit to an inline shell heredoc.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct McpServerSpec {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
}

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
    /// MCP servers the bootstrap script should inject into the agent's
    /// `~/.claude.json`. Keyed by server name (becomes the key in the
    /// resulting `mcpServers` JSON object).
    #[serde(default)]
    pub mcp_servers: BTreeMap<String, McpServerSpec>,
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
        mcp_servers: BTreeMap::new(),
    }
}

/// Inline bootstrap script for the `claude` agent kind. Sourced from a
/// real `.sh` file so shellcheck + syntax highlighting + tests apply, and
/// so the rationale for each step lives next to the code that runs it
/// (see [`CLAUDE_BOOTSTRAP_SH`] for the full body). The MCP server set
/// is injected through `MOWS_CLAUDE_MCP_SERVERS` (a JSON object) rather
/// than baked into the shell so adding a server is a data change in
/// [`builtin_claude`], not an edit to the script.
const CLAUDE_BOOTSTRAP_SH: &str = include_str!("kinds/claude_bootstrap.sh");

/// Built-in claude manifest, used as a fallback when no on-disk manifest is
/// present and so unit tests don't need a filesystem.
///
/// `/creds` is bind-mounted **read-only** into the guest (the host's
/// `~/.claude`). Claude itself needs to write its session state, so we
/// can't point `CLAUDE_CONFIG_DIR` at `/creds` directly. The argv below
/// runs `claude_bootstrap.sh` inside the VM, which:
///
/// 1. Creates the `agent` user (claude refuses several permission modes
///    as root).
/// 2. Stages credentials in a writable per-VM copy under
///    `/home/agent/.claude`, restoring `.claude.json` from the most
///    recent backup if needed.
/// 3. Stages plugins from `/creds/plugins` (mandatory once present —
///    the previous "silent failure on missing plugin dir" behaviour was
///    a real bug, not a feature).
/// 4. Patches `.claude.json` with `mcpServers`, `bypassPermissionsModeAccepted`,
///    and the project trust flags.
/// 5. Drops privileges via `su` and execs claude.
///
/// `--dangerously-skip-permissions` is the right default inside a per-VM
/// sandbox: anything the agent does is contained to the ephemeral qcow2
/// overlay, so the cost of a wrong `rm -rf` is bounded to one VM. The
/// user has pre-accepted the bypass mode in `.claude.json`
/// (`bypassPermissionsModeAccepted`) so claude launches without a
/// confirmation prompt on top of that.
pub fn builtin_claude() -> AgentKind {
    let mut mcp_servers = BTreeMap::new();
    mcp_servers.insert(
        "chrome-devtools".to_string(),
        McpServerSpec {
            command: "chrome-devtools-mcp".to_string(),
            args: vec!["--isolated".to_string(), "--headless".to_string()],
            env: BTreeMap::new(),
        },
    );

    let mcp_json = serde_json::to_string(&mcp_servers)
        .expect("serialising a BTreeMap<String, McpServerSpec> cannot fail");

    // The bootstrap script reads `MOWS_CLAUDE_MCP_SERVERS` from the
    // inherited env. agent_runtime shell-quotes both keys and values
    // when assembling the tmux launch command, so embedding the JSON
    // directly here is safe regardless of what characters end up in
    // the values.
    let mut argv_env = BTreeMap::new();
    argv_env.insert("MOWS_CLAUDE_MCP_SERVERS".to_string(), mcp_json);

    let bootstrap_command = format!(
        "export MOWS_CLAUDE_MCP_SERVERS={}; exec /bin/sh -c {}",
        shell_quote(argv_env.get("MOWS_CLAUDE_MCP_SERVERS").unwrap()),
        shell_quote(CLAUDE_BOOTSTRAP_SH),
    );

    AgentKind {
        name: "claude".to_string(),
        binary: "/usr/local/bin/claude".to_string(),
        // The agent is sandboxed by KVM + per-agent qcow2 overlay, so
        // granting full tool permissions is the right default — anything
        // it does is contained to its own ephemeral guest.
        argv: vec![
            "/bin/sh".to_string(),
            "-c".to_string(),
            bootstrap_command,
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
        mcp_servers,
    }
}

/// POSIX single-quote shell escape. Used to embed the bootstrap script
/// and the MCP-server JSON into the outer `sh -c` invocation that
/// agent_runtime hands to tmux. `'` is closed, a `'\''` escape sequence
/// inserted, and the quoted string reopened.
fn shell_quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('\'');
    for ch in s.chars() {
        if ch == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(ch);
        }
    }
    out.push('\'');
    out
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
        let kind = builtin_claude();
        let yaml = serde_yaml_neo::to_string(&kind).unwrap();
        let parsed = AgentKind::from_yaml(&yaml).unwrap();
        assert_eq!(parsed.name, "claude");
        assert_eq!(parsed.mcp_servers.get("chrome-devtools").map(|s| s.command.as_str()),
                   Some("chrome-devtools-mcp"));
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

    #[test]
    fn builtin_claude_argv_carries_mcp_env_and_bootstrap() {
        // Regression for MAJ-8: the chrome-devtools MCP entry must end
        // up in the inlined env and the bootstrap argv must invoke the
        // extracted shell script. If someone removes the script include
        // or drops the env injection, this test catches it.
        let kind = builtin_claude();
        assert_eq!(kind.argv.len(), 3);
        assert_eq!(kind.argv[0], "/bin/sh");
        assert_eq!(kind.argv[1], "-c");
        let command = &kind.argv[2];
        assert!(
            command.starts_with("export MOWS_CLAUDE_MCP_SERVERS="),
            "argv[2] should export the MCP env var: {command}"
        );
        assert!(
            command.contains("chrome-devtools-mcp"),
            "MCP env var should carry the chrome-devtools command: {command}"
        );
        // Bootstrap script content must be embedded so the `sh -c`
        // executes it directly rather than reading from disk.
        assert!(
            command.contains("install -d -o agent -g agent /home/agent/.claude"),
            "bootstrap script body should be embedded into argv[2]"
        );
        assert!(
            command.contains("--dangerously-skip-permissions"),
            "bootstrap should carry the documented launch flag"
        );
    }

    #[test]
    fn shell_quote_escapes_single_quote() {
        // The escape sequence is `'` → `'\''` (close, escaped quote,
        // reopen). The outer wrapper quotes are added by shell_quote.
        assert_eq!(shell_quote("hello"), "'hello'");
        assert_eq!(shell_quote("it's"), "'it'\\''s'");
        assert_eq!(shell_quote(""), "''");
    }

    #[test]
    fn bootstrap_script_refuses_symlinked_plugins_dir() {
        // Static check: the extracted bootstrap script must refuse to
        // follow a /creds/plugins symlink. Catches CRIT-4 regressions
        // even without spinning up a real guest.
        assert!(
            CLAUDE_BOOTSTRAP_SH.contains("/creds/plugins is a symlink"),
            "bootstrap script must guard /creds/plugins against symlink follow"
        );
        assert!(
            CLAUDE_BOOTSTRAP_SH.contains("--no-dereference"),
            "bootstrap script must use cp --no-dereference for plugin staging"
        );
    }
}
