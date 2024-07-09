use std::{os::unix::fs::PermissionsExt, path::Path};

use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tracing::debug;

use crate::{
    config::{InternalIps, PixiecoreBootConfig, SshAccess, Vip},
    some_or_bail,
    utils::generate_id,
};

use super::cloud_init::CloudInit;

const DOWNLOAD_DIRECTORY: &str = "/temp/pxe-files";

impl PixiecoreBootConfig {
    pub async fn new(
        kairos_version: &str,
        k3s_version: &str,
        os: &str,
        k3s_token: &str,
        own_hostname: &str,
        ssh_config: &SshAccess,
        primary_node_hostname: &str,
        virt: bool,
        vip: &Vip,
        internal_ips: &InternalIps,
    ) -> anyhow::Result<Self> {
        tokio::fs::create_dir_all(DOWNLOAD_DIRECTORY).await?;
        let file_name = format!("cloud-init-{}.yml", generate_id(20));

        let cloud_init_folder = Path::new("/temp/cloud-init/");
        tokio::fs::create_dir_all(cloud_init_folder).await?;
        // allow anyone to delete the folder
        tokio::fs::set_permissions(cloud_init_folder, std::fs::Permissions::from_mode(0o777))
            .await?;

        let cloud_init_path = cloud_init_folder.join(file_name.clone());

        let cloud_init_str = cloud_init_path.to_str().ok_or(anyhow::anyhow!(
            "Failed to convert cloud init path to string"
        ))?;

        Self::download_os_images(kairos_version, k3s_version, os).await?;
        Self::generate_cloud_init(
            own_hostname,
            ssh_config,
            primary_node_hostname,
            k3s_token,
            cloud_init_str,
            virt,
            vip,
            internal_ips,
        )
        .await?;

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
        tokio::fs::create_dir_all(DOWNLOAD_DIRECTORY).await?;

        let kernel_path = Self::get_artifact_path("-kernel", kairos_version, k3s_version, os)?;
        let initrd_path = Self::get_artifact_path("-initrd", kairos_version, k3s_version, os)?;
        let squashfs_path = Self::get_artifact_path(".squashfs", kairos_version, k3s_version, os)?;

        let kernel_url = Self::get_artifact_url("-kernel", kairos_version, k3s_version, os)?;
        let initrd_url = Self::get_artifact_url("-initrd", kairos_version, k3s_version, os)?;
        let squashfs_url = Self::get_artifact_url(".squashfs", kairos_version, k3s_version, os)?;

        Self::download_artifact(&kernel_url, &kernel_path).await?;

        Self::download_artifact(&initrd_url, &initrd_path).await?;

        Self::download_artifact(&squashfs_url, &squashfs_path).await?;

        Ok(())
    }

    async fn download_artifact(url: &str, path: &str) -> anyhow::Result<()> {
        let reqwest = reqwest::Client::new();

        debug!("Downloading PXE files");

        if Path::new(path).exists() {
            return Ok(());
        }

        let mut res = reqwest.get(url).send().await?;
        let mut file = File::create(path).await?;
        while let Some(chunk) = res.chunk().await? {
            file.write_all(&chunk).await?;
        }

        Ok(())
    }

    async fn generate_cloud_init(
        own_hostname: &str,
        ssh_config: &SshAccess,
        primary_node_hostname: &str,
        k3s_token: &str,
        cloud_init_path: &str,
        virt: bool,
        vip: &Vip,
        internal_ips: &InternalIps,
    ) -> anyhow::Result<()> {
        let cloud_init = CloudInit::new(
            own_hostname,
            primary_node_hostname,
            ssh_config,
            true,
            virt,
            k3s_token,
            vip,
            internal_ips,
        );

        let cloud_init_str = "#cloud-config\n".to_string() + &serde_yaml::to_string(&cloud_init)?;

        tokio::fs::write(cloud_init_path, cloud_init_str).await?;

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
