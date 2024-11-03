use anyhow::{bail, Context};
use async_ssh2_tokio::{AuthMethod, Client, Config, ServerCheckMethod};
use std::env;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::process::Stdio;
use std::time::Duration;
use tempfile::NamedTempFile;
use tokio::{io::AsyncWriteExt, process::Command};

use crate::config::Machine;
use crate::{
    config::{ClusterNode, SshAccess},
    utils::generate_id,
};
use crate::{some_or_bail, write_config};

struct SshPubAndPrivKey {
    pub pub_key: String,
    pub priv_key: String,
}

impl SshAccess {
    pub async fn new(
        remote_hostname: Option<String>,
        ssh_username: Option<&str>,
    ) -> anyhow::Result<Self> {
        let ssh_username = ssh_username.unwrap_or("kairos").to_string();
        let ssh_password = generate_id(100);
        let ssh_passphrase = generate_id(100);

        let ssh_keys = Self::generate_ssh_key(&ssh_passphrase).await?;

        Ok(Self {
            ssh_username,
            ssh_private_key: ssh_keys.priv_key,
            ssh_public_key: ssh_keys.pub_key,
            ssh_passphrase,
            ssh_password,
            remote_public_key: None,
            remote_hostname,
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

    pub async fn get_remote_pub_key(&self) -> anyhow::Result<String> {
        let hostname = some_or_bail!(self.remote_hostname.as_ref(), "No remote hostname");
        let output = Command::new("ssh-keyscan").arg(&hostname).output().await?;

        let pub_key = if output.status.success() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            bail!(
                "Failed to get remote public key: {}",
                &String::from_utf8_lossy(&output.stderr)
            )
        };

        let words: Vec<&str> = pub_key.split_ascii_whitespace().collect();

        for (i, word) in words.iter().enumerate() {
            if *word == "ssh-ed25519" {
                return Ok(words[i + 1].to_string());
            }
        }

        bail!("Failed to get remote public key: {:?}", pub_key)
    }

    pub async fn set_remote_pub_key(&self, current_machine: &Machine) -> anyhow::Result<String> {
        let pub_key = self.get_remote_pub_key().await?;

        let mut config = write_config!();

        for machine in config.machines.values_mut() {
            if machine.id == current_machine.id {
                machine.ssh.remote_public_key = Some(pub_key.clone());
            }
        }
        Ok(pub_key)
    }

    pub async fn exec(
        &self,
        machine: &Machine,
        command: &str,
        inactivity_timeout_secs: u64,
    ) -> anyhow::Result<String> {
        let remote_pub_key = match &self.remote_public_key {
            Some(pk) => pk.clone(),
            None => self.set_remote_pub_key(machine).await?.clone(),
        };

        let auth_method = AuthMethod::with_key(&self.ssh_private_key, Some(&self.ssh_passphrase));

        let mut ssh_config = Config::default();
        ssh_config.inactivity_timeout = Some(Duration::from_secs(inactivity_timeout_secs));

        let client = Client::connect_with_config(
            (
                self.remote_hostname.clone().unwrap_or(machine.id.clone()),
                22,
            ),
            &self.ssh_username,
            auth_method,
            ServerCheckMethod::PublicKey(remote_pub_key),
            ssh_config,
        )
        .await?;

        let res = client.execute(command).await?;

        if res.exit_status != 0 {
            bail!("SSH Command failed: {:?}", res.stderr)
        }

        Ok(res.stdout)
    }

    pub async fn ensure_local_ssh_agent_is_running(&self) -> anyhow::Result<()> {
        if env::var("SSH_AGENT_PID").is_err() {
            // Start the SSH agent
            let output = Command::new("ssh-agent")
                .arg("-s")
                .output()
                .await
                .context("Failed to start ssh-agent")?;

            // Set the SSH agent environment variables
            let output_str = String::from_utf8_lossy(&output.stdout);
            for line in output_str.split('\n') {
                if line.starts_with("SSH_") {
                    let parts: Vec<&str> = line.split(';').collect();
                    if parts.len() > 1 {
                        let kv: Vec<&str> = parts[0].split('=').collect();
                        if kv.len() == 2 {
                            env::set_var(kv[0], kv[1]);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub async fn add_ssh_key_to_local_agent(&self) -> anyhow::Result<()> {
        self.ensure_local_ssh_agent_is_running().await?;

        let mut tempfile = NamedTempFile::new().context("Failed to create temporary file ")?;

        writeln!(tempfile, "{}", &self.ssh_private_key).context("Failed to write private key")?;

        tokio::fs::set_permissions(&tempfile.path(), std::fs::Permissions::from_mode(0o600))
            .await
            .context(format!(
                "Failed to set permissions on private key {}",
                &tempfile.path().to_str().unwrap()
            ))?;

        // add private keys to ssh agent
        let mut child = Command::new("ssh-add")
            .arg(&tempfile.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to execute ssh-add")?;

        let stdin = child.stdin.as_mut().expect("Failed to open stdin");
        stdin
            .write_all(&self.ssh_passphrase.as_bytes())
            .await
            .context("Failed to write to stdin")?;

        let output = child
            .wait_with_output()
            .await
            .context("Failed to read stdout")?;

        if output.status.success() {
            Ok(())
        } else {
            bail!("Failed to add ssh key to agent: {:?}", output)
        }
    }
}
