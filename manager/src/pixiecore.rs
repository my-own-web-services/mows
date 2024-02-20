use std::path::Path;

use tokio::process::Command;

use crate::{
    config::{PixiecoreBootConfig, SshAccess},
    some_or_bail,
    utils::generate_id,
};

const DOWNLOAD_DIRECTORY: &str = "/pxe_files";

impl PixiecoreBootConfig {
    pub async fn new(
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
        k3s_token: &str,
        hostname: &str,
        ssh_config: &SshAccess,
        primary_node: bool,
    ) -> anyhow::Result<Self> {
        let file_name = format!("cloud-init-{}.yml", generate_id(50));

        let cloud_init_path = Path::new("/").join(file_name.clone());

        let cloud_init_str = cloud_init_path.to_str().ok_or(anyhow::anyhow!(
            "Failed to convert cloud init path to string"
        ))?;

        Self::download_os_images(kairos_version, k3s_version, os).await?;
        Self::generate_cloud_init(
            hostname,
            ssh_config,
            primary_node,
            k3s_token,
            cloud_init_str,
        )?;

        Ok(Self {
            kernel: format!(
                "file://{}",
                Self::get_artifact_path("-kernel", kairos_version, k3s_version, os)?
            ),
            initrd: vec![format!(
                "file://{}",
                Self::get_artifact_path("-initrd", kairos_version, k3s_version, os)?
            )],
            cmdline: Self::get_command_line(kairos_version, k3s_version, os, cloud_init_str)?,
        })
    }

    fn get_command_line(
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
        cloud_init_path: &str,
    ) -> anyhow::Result<String> {
        let squashfs_path = Self::get_artifact_path(".squashfs", kairos_version, k3s_version, os)?;

        Ok(format!("rd.neednet=1 rd.live.overlay.overlayfs=1 ip=dhcp rd.cos.disable root=live:{{{{ URL \"file://{squashfs_path}\" }}}} netboot nodepair.enable config_url={{{{ URL \"file://{cloud_init_path}\" }}}} console=tty1 console=ttyS0 console=tty0"))
    }

    async fn download_os_images(
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
    ) -> anyhow::Result<()> {
        std::fs::create_dir_all(DOWNLOAD_DIRECTORY)?;

        let kernel_path = Self::get_artifact_path("-kernel", kairos_version, k3s_version, os)?;
        let initrd_path = Self::get_artifact_path("-initrd", kairos_version, k3s_version, os)?;
        let squashfs_path = Self::get_artifact_path(".squashfs", kairos_version, k3s_version, os)?;

        let kernel_url = Self::get_artifact_url("-kernel", kairos_version, k3s_version, os)?;
        let initrd_url = Self::get_artifact_url("-initrd", kairos_version, k3s_version, os)?;
        let squashfs_url = Self::get_artifact_url(".squashfs", kairos_version, k3s_version, os)?;

        Command::new("wget")
            .args(["-nc", &kernel_url, "-O", &kernel_path])
            .spawn()?
            .wait()
            .await?;
        Command::new("wget")
            .args(["-nc", &initrd_url, "-O", &initrd_path])
            .spawn()?
            .wait()
            .await?;
        Command::new("wget")
            .args(["-nc", &squashfs_url, "-O", &squashfs_path])
            .spawn()?
            .wait()
            .await?;

        Ok(())
    }

    fn generate_cloud_init(
        hostname: &str,
        ssh_config: &SshAccess,
        primary_node: bool,
        k3s_token: &str,
        cloud_init_path: &str,
    ) -> anyhow::Result<()> {
        let replacement_prefix = "$$$";

        let mut replacements = vec![
            ("SSH_USERNAME", ssh_config.ssh_username.to_string()),
            ("SSH_PASSWORD", ssh_config.ssh_password.to_string()),
            ("SSH_PUBLIC_KEY", ssh_config.ssh_public_key.to_string()),
            ("HOSTNAME", hostname.to_string()),
            ("K3S_TOKEN", k3s_token.to_string()),
            ("INSTALL_DEVICE", "/dev/vda".to_string()),
        ];

        if primary_node {
            let template = include_str!("./cloud-config/primary.yml");

            let local_replacements: Vec<(&str, String)> = vec![];

            replacements.extend(local_replacements);

            let mut temp_config = template.to_string();
            for (key, value) in replacements.iter() {
                temp_config = temp_config.replace(&format!("{replacement_prefix}{key}"), value);
            }

            std::fs::write(cloud_init_path, temp_config)?;
        } else {
            let template = include_str!("./cloud-config/secondary.yml");
            let local_replacements: Vec<(&str, String)> = vec![];

            replacements.extend(local_replacements);

            let mut temp_config = template.to_string();
            for (key, value) in replacements.iter() {
                temp_config = temp_config.replace(&format!("{replacement_prefix}{key}"), value);
            }

            std::fs::write(cloud_init_path, temp_config)?;
        };

        Ok(())
    }

    fn get_artifact_path(
        artifact: &str,
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
    ) -> anyhow::Result<String> {
        Ok(some_or_bail!(
            Path::new(&DOWNLOAD_DIRECTORY)
                .join(format!(
                    "{}{artifact}",
                    Self::get_basename(kairos_version, k3s_version, os)
                ))
                .to_str(),
            "Failed to join kernel path"
        )
        .to_string())
    }

    fn get_artifact_url(
        artifact: &str,
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
    ) -> anyhow::Result<String> {
        Ok(format!(
            "https://github.com/kairos-io/kairos/releases/download/{}/{}{artifact}",
            kairos_version,
            Self::get_basename(kairos_version, k3s_version, os)
        ))
    }

    fn get_basename(kairos_version: &str, k3s_version: &str, os: &str) -> String {
        format!("kairos-{os}-standard-amd64-generic-{kairos_version}-{k3s_version}")
    }
}
