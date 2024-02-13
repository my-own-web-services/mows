use std::{
    collections::HashMap,
    io::Read,
    path::Path,
    process::{Child, Command},
    thread::sleep,
    time::Duration,
};

use wait_timeout::ChildExt;

use anyhow::bail;

use crate::{
    config::{ClusterNode, Machine, SshAccess},
    some_or_bail,
    utils::generate_id,
};

const CLOUD_INIT_OUTPUT_PATH: &str = "/pxe_files/cloud-init.yml";

pub struct Pxe {
    pub kairos_version: String,
    pub k3s_version: String,
    pub os: String,
    download_directory: String,
    node_index: u8,
    pub k3s_token: String,
    pub pxe_server: Option<Child>,
}

impl Pxe {
    pub fn new(kairos_version: &str, k3s_version: &str, os: &str) -> anyhow::Result<Self> {
        let download_directory = "/pxe_files";

        std::fs::create_dir_all(download_directory)?;

        Ok(Self {
            kairos_version: kairos_version.to_string(),
            k3s_version: k3s_version.to_string(),
            os: os.to_string(),
            download_directory: download_directory.to_string(),
            node_index: 0,
            k3s_token: generate_id(100),
            pxe_server: None,
        })
    }

    pub async fn install_cluster(
        &mut self,
        machines: HashMap<String, Machine>,
    ) -> anyhow::Result<HashMap<String, ClusterNode>> {
        self.download_os_images()?;

        let mut nodes: HashMap<String, ClusterNode> = HashMap::new();

        for (name, machine) in machines {
            let node_ssh = self.install_node(&name, &machine).await?;
            let node = ClusterNode {
                ssh_access: node_ssh,
                hostname: name.clone(),
                machine,
            };
            nodes.insert(name, node);
            self.node_index += 1;
        }
        Ok(nodes)
    }

    pub async fn install_node(
        &mut self,
        machine_name: &str,
        machine: &Machine,
    ) -> anyhow::Result<SshAccess> {
        let node_name = &machine_name;

        let mut ssh_access = self.generate_cloud_init(node_name)?;
        self.start_pxe_server()?;

        machine.destroy()?;

        machine.start()?;

        self.poll_installation(&mut ssh_access, machine).await?;
        self.stop_pxe_server()?;

        Ok(ssh_access)
    }

    pub async fn poll_installation(
        &self,
        ssh_access: &mut SshAccess,
        machine: &Machine,
    ) -> anyhow::Result<()> {
        for i in 0..200 {
            match self.poll_single(ssh_access, machine).await {
                Ok(_) => {
                    println!("Node installed after {} seconds", i * 5);
                    return Ok(());
                }
                Err(e) => {
                    println!(
                        "Node {} not installed yet, waiting 5 seconds: {e}",
                        machine.name
                    );
                    sleep(Duration::from_secs(5));
                }
            }
        }
        bail!("Failed to install node")
    }
    pub async fn poll_single(
        &self,
        ssh_access: &mut SshAccess,
        machine: &Machine,
    ) -> anyhow::Result<()> {
        let output = ssh_access
            .exec(&machine.clone(), "kubectl get nodes", 5)
            .await?;

        dbg!(output);

        Ok(())
    }

    fn get_basename(&self) -> String {
        format!(
            "kairos-{os}-standard-amd64-generic-{kairos_version}-{k3s_version}",
            os = self.os,
            kairos_version = self.kairos_version,
            k3s_version = self.k3s_version
        )
    }

    fn download_os_images(&self) -> anyhow::Result<()> {
        let kernel_path = &self.get_artifact_path("-kernel")?;
        let initrd_path = &self.get_artifact_path("-initrd")?;
        let squashfs_path = &self.get_artifact_path(".squashfs")?;

        let kernel_url = &self.get_artifact_url("-kernel")?;
        let initrd_url = &self.get_artifact_url("-initrd")?;
        let squashfs_url = &self.get_artifact_url(".squashfs")?;

        Command::new("wget")
            .args(["-nc", kernel_url, "-O", kernel_path])
            .spawn()?
            .wait()?;
        Command::new("wget")
            .args(["-nc", initrd_url, "-O", initrd_path])
            .spawn()?
            .wait()?;
        Command::new("wget")
            .args(["-nc", squashfs_url, "-O", squashfs_path])
            .spawn()?
            .wait()?;

        Ok(())
    }

    fn generate_cloud_init(&self, hostname: &str) -> anyhow::Result<SshAccess> {
        let replacement_prefix = "$$$";

        let ssh_config = SshAccess::new()?;

        let mut replacements = vec![
            ("SSH_USERNAME", ssh_config.ssh_username.to_string()),
            ("SSH_PASSWORD", ssh_config.ssh_password.to_string()),
            ("SSH_PUBLIC_KEY", ssh_config.ssh_public_key.to_string()),
            ("HOSTNAME", hostname.to_string()),
            ("K3S_TOKEN", self.k3s_token.clone()),
            ("INSTALL_DEVICE", "/dev/vda".to_string()),
        ];

        let generated_config = if self.node_index == 0 {
            let template = include_str!("./cloud-config/primary.yml");

            let local_replacements: Vec<(&str, String)> = vec![];

            replacements.extend(local_replacements);

            let mut temp_config = template.to_string();
            for (key, value) in replacements.iter() {
                temp_config = temp_config.replace(&format!("{replacement_prefix}{key}"), value);
            }

            temp_config
        } else {
            let template = include_str!("./cloud-config/secondary.yml");
            let local_replacements: Vec<(&str, String)> = vec![];

            replacements.extend(local_replacements);

            let mut temp_config = template.to_string();
            for (key, value) in replacements.iter() {
                temp_config = temp_config.replace(key, value);
            }

            temp_config
        };

        std::fs::write(CLOUD_INIT_OUTPUT_PATH, generated_config)?;

        Ok(ssh_config)
    }

    fn get_artifact_path(&self, artifact: &str) -> anyhow::Result<String> {
        Ok(some_or_bail!(
            Path::new(&self.download_directory)
                .join(format!("{}{artifact}", self.get_basename()))
                .to_str(),
            "Failed to join kernel path"
        )
        .to_string())
    }

    fn get_artifact_url(&self, artifact: &str) -> anyhow::Result<String> {
        Ok(format!(
            "https://github.com/kairos-io/kairos/releases/download/{}/{}{artifact}",
            self.kairos_version,
            self.get_basename()
        ))
    }

    fn start_pxe_server(&mut self) -> anyhow::Result<()> {
        let kernel_path = &self.get_artifact_path("-kernel")?;
        let initrd_path = &self.get_artifact_path("-initrd")?;
        let squashfs_path = &self.get_artifact_path(".squashfs")?;

        // 🤮 it took a long time to get this right
        let cmd=format!("rd.neednet=1 rd.live.overlay.overlayfs=1 ip=dhcp rd.cos.disable root=live:{{{{ ID \"{squashfs_path}\" }}}} netboot nodepair.enable config_url={{{{ ID \"{CLOUD_INIT_OUTPUT_PATH}\" }}}} console=tty1 console=ttyS0 console=tty0");

        let child = Command::new("pixiecore")
            .args(["boot", kernel_path, initrd_path, "--cmdline", &cmd])
            .spawn()?;

        self.pxe_server = Some(child);

        Ok(())
    }

    fn stop_pxe_server(&mut self) -> anyhow::Result<()> {
        if let Some(mut pxe_server) = self.pxe_server.take() {
            pxe_server.kill()?;
        }
        Ok(())
    }
}
