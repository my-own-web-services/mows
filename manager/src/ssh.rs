use std::{io::Read, process::Command};

use ssh2::Session;
use std::net::TcpStream;

use crate::{
    config::{Machine, SshAccess},
    utils::generate_id,
};

struct SshPubAndPrivKey {
    pub pub_key: String,
    pub priv_key: String,
}

impl SshAccess {
    pub fn new() -> anyhow::Result<Self> {
        let ssh_username = "kairos".to_string();
        let ssh_password = generate_id(100);
        let ssh_passphrase = generate_id(100);

        let ssh_keys = Self::generate_ssh_key(&ssh_passphrase)?;

        Ok(Self {
            ssh_username,
            ssh_private_key: ssh_keys.priv_key,
            ssh_public_key: ssh_keys.pub_key,
            ssh_passphrase,
            ssh_password,
            remote_fingerprint: None,
        })
    }

    fn generate_ssh_key(ssh_passphrase: &str) -> anyhow::Result<SshPubAndPrivKey> {
        Command::new("ssh-keygen")
            .args(["-t", "ed25519", "-q", "-N", ssh_passphrase, "-f", "/id"])
            .spawn()?
            .wait()?;

        let keys = SshPubAndPrivKey {
            pub_key: std::fs::read_to_string("/id.pub")?.trim().to_string(),
            priv_key: std::fs::read_to_string("/id")?,
        };

        std::fs::remove_file("/id")?;
        std::fs::remove_file("/id.pub")?;

        Ok(keys)
    }

    pub async fn prepare_manual_access() -> anyhow::Result<()> {
        todo!()
        //fs::write("~./ssh/id", contents)
    }

    pub async fn exec(
        &self,
        machine: &Machine,
        command: &str,
        timeout_seconds: u32,
    ) -> anyhow::Result<String> {
        let ip = machine.get_current_ip().await?;

        let tcp = TcpStream::connect(format!("{ip}:22"))?;

        // TODO add known hosts!

        let mut sess = Session::new()?;
        sess.set_tcp_stream(tcp);
        sess.handshake()?;

        sess.userauth_pubkey_memory(
            &self.ssh_username,
            Some(&self.ssh_public_key),
            &self.ssh_private_key,
            Some(&self.ssh_passphrase),
        )?;

        sess.set_timeout(timeout_seconds * 1000);

        let mut channel = sess.channel_session()?;

        channel.exec(command)?;

        let mut s = String::new();
        channel.read_to_string(&mut s)?;
        channel.wait_close()?;

        Ok(s)
    }
}
