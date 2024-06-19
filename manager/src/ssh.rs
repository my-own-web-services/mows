use std::time::Duration;
use std::{path::Path, process::Stdio};

use anyhow::bail;
use async_ssh2_tokio::{AuthMethod, Client, Config, ServerCheckMethod};
use tokio::{io::AsyncWriteExt, process::Command};

use crate::{
    config::{ClusterNode, Machine, SshAccess},
    utils::generate_id,
};

struct SshPubAndPrivKey {
    pub pub_key: String,
    pub priv_key: String,
}

impl SshAccess {
    pub async fn new() -> anyhow::Result<Self> {
        let ssh_username = "kairos".to_string();
        let ssh_password = generate_id(100);
        let ssh_passphrase = generate_id(100);

        let ssh_keys = Self::generate_ssh_key(&ssh_passphrase).await?;

        Ok(Self {
            ssh_username,
            ssh_private_key: ssh_keys.priv_key,
            ssh_public_key: ssh_keys.pub_key,
            ssh_passphrase,
            ssh_password,
            remote_fingerprint: None,
        })
    }

    async fn generate_ssh_key(ssh_passphrase: &str) -> anyhow::Result<SshPubAndPrivKey> {
        Command::new("ssh-keygen")
            .args(["-t", "ed25519", "-q", "-N", ssh_passphrase, "-f", "/id"])
            .spawn()?
            .wait()
            .await?;

        let keys = SshPubAndPrivKey {
            pub_key: tokio::fs::read_to_string("/id.pub")
                .await?
                .trim()
                .to_string(),
            priv_key: tokio::fs::read_to_string("/id").await?,
        };

        tokio::fs::remove_file("/id").await?;
        tokio::fs::remove_file("/id.pub").await?;

        Ok(keys)
    }

    pub async fn exec(
        &self,
        machine: &Machine,
        command: &str,
        timeout_seconds: u32,
    ) -> anyhow::Result<String> {
        let ip = machine.get_current_ip().await?;

        // TODO add known hosts!

        let auth_method = AuthMethod::with_key(&self.ssh_private_key, Some(&self.ssh_passphrase));

        let mut ssh_config = Config::default();
        ssh_config.inactivity_timeout = Some(Duration::from_secs(2));

        let client = Client::connect_with_config(
            (ip, 22),
            &self.ssh_username,
            auth_method,
            ServerCheckMethod::NoCheck,
            ssh_config,
        )
        .await?;

        let res = client.execute(command).await?;

        if res.exit_status != 0 {
            bail!("SSH Command failed: {:?}", res.stderr)
        }

        Ok(res.stdout)
    }

    pub async fn add_ssh_key_to_local_agent(&self, node: &ClusterNode) -> anyhow::Result<()> {
        let key_path = Path::new("/id/");

        tokio::fs::create_dir_all(&key_path).await?;

        tokio::fs::write(&key_path.join(&node.hostname), &self.ssh_private_key).await?;
        // add private keys to ssh agent
        let mut child = Command::new("ssh-add")
            .arg(&key_path)
            .stdin(Stdio::piped())
            .spawn()
            .expect("Failed to execute ssh-add");

        {
            let stdin = child.stdin.as_mut().expect("Failed to open stdin");
            stdin
                .write_all(&self.ssh_passphrase.as_bytes())
                .await
                .expect("Failed to write to stdin");
        }

        let output = child
            .wait_with_output()
            .await
            .expect("Failed to read stdout");

        tokio::fs::remove_file(&key_path).await?;

        if output.status.success() {
            // remove the private key
            Ok(())
        } else {
            bail!("Failed to add ssh key to agent")
        }
    }
}
