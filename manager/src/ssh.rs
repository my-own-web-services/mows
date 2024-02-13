use std::{
    fs,
    io::Read,
    process::{Child, Command, Stdio},
    time::Duration,
};

use anyhow::bail;
use wait_timeout::ChildExt;

use crate::{
    config::{Machine, SshAccess},
    some_or_bail,
    utils::generate_id,
};

struct SshPubAndPrivKey {
    pub pub_key: String,
    pub priv_key: String,
}

impl SshAccess {
    pub fn new() -> anyhow::Result<Self> {
        let ssh_username = generate_id(20);
        let ssh_password = generate_id(100);

        let ssh_keys = Self::generate_ssh_key()?;

        Ok(Self {
            ssh_username,
            ssh_private_key: ssh_keys.priv_key,
            ssh_public_key: ssh_keys.pub_key,
            ssh_password,
            remote_fingerprint: None,
        })
    }

    fn generate_ssh_key() -> anyhow::Result<SshPubAndPrivKey> {
        Command::new("ssh-keygen")
            .args(["-t", "ed25519", "-q", "-N", "''", "-f", "/id"])
            .spawn()?
            .wait()?;

        let keys = SshPubAndPrivKey {
            pub_key: std::fs::read_to_string("/id.pub")?,
            priv_key: std::fs::read_to_string("/id")?,
        };

        std::fs::remove_file("/id")?;
        std::fs::remove_file("/id.pub")?;

        Ok(keys)
    }

    pub async fn exec(
        &mut self,
        machine: &Machine,
        command: &str,
        timeout_seconds: u64,
    ) -> anyhow::Result<String> {
        let ip = Self::get_current_ip_from_mac(some_or_bail!(
            machine.mac.clone(),
            "Using something else than mac to get ip of machine is not implemented"
        ))
        .await?;

        println!("Executing command on ip: {}", ip);

        let private_key_path = format!("/root/.ssh/{}{}", machine.name, generate_id(20));
        std::fs::write(&private_key_path, &self.ssh_private_key)?;

        Command::new("chmod")
            .args(["600", &private_key_path])
            .spawn()?
            .wait()?;

        let password_path = format!("/root/.ssh/{}{}", machine.name, generate_id(20));
        std::fs::write(&password_path, &self.ssh_password)?;

        let target = format!("{}@{}", self.ssh_username, ip);
        let real_command = format!("\"{}\"", command);
        let mut args = vec![
            "-f",
            &password_path,
            "ssh",
            "-o",
            "ConnectTimeout=5",
            "-o",
            "BatchMode=yes",
            "-o",
            "ServerAliveInterval=1",
            "-o",
            "HashKnownHosts=no",
        ];

        args.extend([
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null
        ",
        ]);

        match &self.remote_fingerprint {
            Some(remote_fingerprint) => {
                std::fs::write("/root/.ssh/known_hosts", remote_fingerprint)?;
            }
            None => {
                //let _ = &self.try_to_add_known_hosts();
            }
        };

        args.extend(["-i", &private_key_path, &target, &real_command]);

        let mut child = Command::new("sshpass")
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        //fs::remove_file(&private_key_path)?;
        //fs::remove_file(&password_path)?;

        let code = some_or_bail!(
            match child.wait_timeout(Duration::from_secs(timeout_seconds))? {
                Some(v) => v.code(),
                None => {
                    child.kill()?;
                    child.wait()?.code()
                }
            },
            "could not get code for ssh child"
        );

        let mut stdout = String::new();
        some_or_bail!(child.stdout, "Could not get stdout for ssh child")
            .read_to_string(&mut stdout)?;

        let mut stderr = String::new();
        some_or_bail!(child.stderr, "Could not get stderr for ssh child")
            .read_to_string(&mut stderr)?;

        if code == 0 {
            Ok(stdout)
        } else {
            bail!(stderr)
        }
    }

    pub fn try_to_add_known_hosts(&mut self) -> anyhow::Result<()> {
        let remote_fingerprint = fs::read_to_string("/root/.ssh/known_hosts")?;
        self.remote_fingerprint = Some(remote_fingerprint);
        Ok(())
    }

    pub async fn get_current_ip_from_mac(mac: String) -> anyhow::Result<String> {
        let online_machines = Self::get_connected_machines().await?;

        let arp_machine = some_or_bail!(
            online_machines.into_iter().find(|arp| arp.mac == mac),
            "Machine not found"
        );

        Ok(arp_machine.ip)
    }

    pub async fn get_connected_machines() -> anyhow::Result<Vec<Arp>> {
        let output = Command::new("arp").output()?;
        let output = String::from_utf8(output.stdout)?;

        let lines: Vec<&str> = output.lines().skip(1).collect();

        let mut arp_lines = vec![];

        for line in lines {
            let arp_line: Vec<&str> = line.split_whitespace().collect();

            arp_lines.push(Arp {
                ip: some_or_bail!(arp_line.first(), "Could not get ip from arp").to_string(),
                hwtype: some_or_bail!(arp_line.get(1), "Could not get hwtype from arp").to_string(),
                mac: some_or_bail!(arp_line.get(2), "Could not get mac from arp").to_string(),
            });
        }

        Ok(arp_lines)
    }
}

pub struct Arp {
    pub ip: String,
    pub hwtype: String,
    pub mac: String,
}
