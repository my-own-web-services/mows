//! Supervisor-managed SSH keypair.
//!
//! On first startup the supervisor generates an ed25519 keypair under
//! `state_dir/host_keys/`. The public part is injected into every agent VM's
//! `authorized_keys`; the private part is served (host-only) via the
//! `/v1/agents/:id/ssh` endpoint so the CLI can `ssh -i` into the running VM.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use tokio::process::Command;

use crate::error::{Result, SupervisorError};

pub struct HostKeyPair {
    pub private_key_path: PathBuf,
    pub public_key: String,
}

pub async fn ensure_host_keypair(state_dir: &Path) -> Result<HostKeyPair> {
    let key_dir = state_dir.join("host_keys");
    tokio::fs::create_dir_all(&key_dir).await?;
    let priv_path = key_dir.join("agent_id_ed25519");
    let pub_path = key_dir.join("agent_id_ed25519.pub");

    if !priv_path.exists() {
        let status = Command::new("ssh-keygen")
            .arg("-t")
            .arg("ed25519")
            .arg("-N")
            .arg("")
            .arg("-q")
            .arg("-C")
            .arg("mows-vm-supervisor")
            .arg("-f")
            .arg(&priv_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .status()
            .await
            .map_err(|e| {
                SupervisorError::Internal(format!("ssh-keygen exec failed: {e}"))
            })?;
        if !status.success() {
            return Err(SupervisorError::Internal(format!(
                "ssh-keygen exited with {status}"
            )));
        }
        // 0600 enforced by ssh-keygen, but be explicit on the public file too.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&priv_path, std::fs::Permissions::from_mode(0o600));
            let _ = std::fs::set_permissions(&pub_path, std::fs::Permissions::from_mode(0o644));
        }
    }

    let public_key = tokio::fs::read_to_string(&pub_path).await?.trim().to_string();
    Ok(HostKeyPair {
        private_key_path: priv_path,
        public_key,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn generates_keypair_idempotently() {
        if Command::new("ssh-keygen")
            .arg("-V")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .is_err()
        {
            // ssh-keygen unavailable (rare in dev envs but shield CI).
            return;
        }
        let tmp = tempfile::tempdir().unwrap();
        let kp1 = ensure_host_keypair(tmp.path()).await.unwrap();
        let kp2 = ensure_host_keypair(tmp.path()).await.unwrap();
        assert_eq!(kp1.public_key, kp2.public_key);
        assert!(kp1.public_key.starts_with("ssh-ed25519 "));
    }
}
