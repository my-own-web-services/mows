//! Per-VM SSH keypairs.
//!
//! Each VM gets its own ed25519 keypair, generated under
//! `state_dir/vms/<vm_id>/ssh/`. The public key is injected into that VM's
//! `authorized_keys`; the private key is served (host-only) via the
//! `GET /v1/vms/{id}/ssh` endpoint so the CLI can `ssh -i` into the running
//! VM.
//!
//! Per-VM keys mean compromising one VM doesn't grant access to any other,
//! and `GET /v1/vms/{id}/ssh` cannot leak credentials usable against VMs
//! the caller did not create.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use tokio::process::Command;

use crate::error::{Result, SupervisorError};

pub struct VmKeyPair {
    pub private_key_path: PathBuf,
    pub public_key: String,
}

/// Ensure a per-VM ed25519 keypair under `vm_dir/ssh/id_ed25519{,.pub}`.
/// Idempotent: if the keypair already exists, returns it unchanged.
pub async fn ensure_vm_keypair(vm_dir: &Path, vm_id: &str) -> Result<VmKeyPair> {
    let key_dir = vm_dir.join("ssh");
    tokio::fs::create_dir_all(&key_dir).await?;
    let priv_path = key_dir.join("id_ed25519");
    let pub_path = key_dir.join("id_ed25519.pub");

    if !priv_path.exists() {
        let status = Command::new("ssh-keygen")
            .arg("-t")
            .arg("ed25519")
            .arg("-N")
            .arg("")
            .arg("-q")
            .arg("-C")
            .arg(format!("mows-vm-supervisor/{vm_id}"))
            .arg("-f")
            .arg(&priv_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .status()
            .await
            .map_err(|e| {
                SupervisorError::SshFailed(format!("ssh-keygen exec failed: {e}"))
            })?;
        if !status.success() {
            return Err(SupervisorError::SshFailed(format!(
                "ssh-keygen exited with {status} for vm {vm_id}"
            )));
        }
        // ssh-keygen already sets 0600 on the private key, but redundancy
        // here makes the invariant explicit. We propagate errors instead
        // of swallowing them: a private key with looser permissions is a
        // security regression that must surface loudly.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            tokio::fs::set_permissions(&priv_path, std::fs::Permissions::from_mode(0o600))
                .await
                .map_err(|e| {
                    SupervisorError::FilesystemError(format!(
                        "failed to enforce 0600 on per-vm private key {}: {e}",
                        priv_path.display()
                    ))
                })?;
            tokio::fs::set_permissions(&pub_path, std::fs::Permissions::from_mode(0o644))
                .await
                .map_err(|e| {
                    SupervisorError::FilesystemError(format!(
                        "failed to enforce 0644 on per-vm public key {}: {e}",
                        pub_path.display()
                    ))
                })?;
        }
    }

    let public_key = tokio::fs::read_to_string(&pub_path).await?.trim().to_string();
    Ok(VmKeyPair {
        private_key_path: priv_path,
        public_key,
    })
}

/// Helper used by `api::agents` to locate a VM's SSH private key without
/// going through the (async) `ensure_vm_keypair` path; the keypair must
/// already exist because the VM was created earlier.
pub fn vm_key_paths(state_dir: &Path, vm_id: &str) -> (PathBuf, PathBuf) {
    let key_dir = state_dir.join("vms").join(vm_id).join("ssh");
    (key_dir.join("id_ed25519"), key_dir.join("id_ed25519.pub"))
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
            return;
        }
        let tmp = tempfile::tempdir().unwrap();
        let kp1 = ensure_vm_keypair(tmp.path(), "vm-aaa").await.unwrap();
        let kp2 = ensure_vm_keypair(tmp.path(), "vm-aaa").await.unwrap();
        assert_eq!(kp1.public_key, kp2.public_key);
        assert!(kp1.public_key.starts_with("ssh-ed25519 "));
    }

    #[tokio::test]
    async fn different_vm_ids_get_different_keypairs() {
        if Command::new("ssh-keygen")
            .arg("-V")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .await
            .is_err()
        {
            return;
        }
        let tmp = tempfile::tempdir().unwrap();
        let a_dir = tmp.path().join("a");
        let b_dir = tmp.path().join("b");
        let kp_a = ensure_vm_keypair(&a_dir, "vm-a").await.unwrap();
        let kp_b = ensure_vm_keypair(&b_dir, "vm-b").await.unwrap();
        assert_ne!(kp_a.public_key, kp_b.public_key);
    }
}
