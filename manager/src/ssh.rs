use std::{fs, io::Read, process::Command};

use ssh2::Session;
use std::net::TcpStream;

use crate::{
    config::{Machine, SshAccess},
    machines::get_connected_machines,
    some_or_bail,
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

    pub async fn exec(
        &self,
        machine: &Machine,
        command: &str,
        timeout_seconds: u32,
    ) -> anyhow::Result<String> {
        let ip = Self::get_current_ip_from_mac(some_or_bail!(
            machine.mac.clone(),
            "Using something else than mac to get ip of machine is not implemented"
        ))
        .await?;

        println!("Executing command on ip: {}", ip);

        let tcp = TcpStream::connect(format!("{ip}:22"))?;

        // TODO add known hosts!

        std::fs::write("/root/.ssh/id", &self.ssh_private_key)?;
        dbg!(&self.ssh_passphrase);

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

    pub async fn get_current_ip_from_mac(mac: String) -> anyhow::Result<String> {
        let online_machines = get_connected_machines().await?;

        let arp_machine = some_or_bail!(
            online_machines.into_iter().find(|arp| arp.mac == mac),
            "Machine not found"
        );

        Ok(arp_machine.ip)
    }
}
