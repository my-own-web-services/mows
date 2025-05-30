use std::collections::HashMap;

use anyhow::Context;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    config::{InternalIps, SshAccess, Vip},
    internal_config::INTERNAL_CONFIG,
};
use mows_common_rust::s;

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct CloudInit {
    pub debug: bool,
    pub users: Vec<User>,
    pub k3s: K3s,
    pub hostname: String,
    pub install: Install,
    pub kcrypt: Kcrypt,
    pub stages: Option<HashMap<String, Vec<Task>>>,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct Task {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<String>>,
    #[serde(rename = "if")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub if_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub layout: Option<DiskLayout>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<CloudInitFile>>,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct CloudInitFile {
    pub path: String,
    pub content: String,
    pub permissions: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct DiskLayout {
    pub device: DiskLayoutDevice,
    pub add_partitions: Vec<DiskLayoutPartition>,
}
#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct DiskLayoutDevice {
    pub path: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct DiskLayoutPartition {
    #[serde(rename = "fsLabel")]
    pub fs_label: String,
    pub size: u64,
    #[serde(rename = "pLabel")]
    pub p_label: String,
    pub filesystem: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct User {
    pub name: String,
    pub ssh_authorized_keys: Vec<String>,
    pub passwd: String,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct K3s {
    pub enabled: bool,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct Install {
    pub device: String,
    pub reboot: bool,
    pub auto: bool,
    pub partitions: Partitions,
    #[serde(rename = "extra-partitions")]
    pub extra_partitions: Vec<ExtraPartition>,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct Partitions {
    pub persistent: PersistentPartition,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct PersistentPartition {
    pub size: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct ExtraPartition {
    pub name: String,
    pub size: u64,
    pub fs: String,
}
#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct Kcrypt {
    pub challenger: KcryptChallenger,
}

#[derive(Debug, Deserialize, Serialize, Clone, ToSchema, Default, PartialEq, Eq)]
pub struct KcryptChallenger {
    pub challenger_server: String,
}

pub fn get_device_string(virt: bool, index: u8) -> String {
    if index > 25 {
        panic!("Index out of range")
    }
    // convert the index into letters for the device
    let letter = std::char::from_u32(97 + index as u32).unwrap();

    format!("/dev/{}d{}", if virt { "v" } else { "s" }, letter)
}

impl CloudInit {
    pub fn new(
        node_hostname: &str,
        primary_hostname: &str,
        ssh_config: &SshAccess,
        debug: bool,
        virt: bool,
        k3s_token: &str,
        vip: &Vip,
        internal_ips: &InternalIps,
    ) -> anyhow::Result<CloudInit> {
        let ic = &INTERNAL_CONFIG;

        let todo = "http://192.168.122.216:30000";

        // variables https://github.com/zcalusic/sysinfo#sample-output

        let user = User {
            name: ssh_config.ssh_username.clone(),
            ssh_authorized_keys: vec![ssh_config.ssh_public_key.clone()],
            passwd: ssh_config.ssh_password.clone(),
        };

        let mut stages = HashMap::new();

        // LEAVE THIS ALONE, THE FORMATTING MATTERS FOR SOME REASON, TODO: insert gateway?
        let static_ip_config = format!(
            r#"[Match]
Name=enp1s0

[Network]
Address={}/24
Gateway=192.168.112.1
DHCP=yes
"#,
            internal_ips.legacy
        );

        let mut k3s_registries_yaml_string = String::new();
        if ic.dev.enabled {
            if let Some(k3s_registries) = &ic.dev.k3s_registries_file {
                k3s_registries_yaml_string = serde_yaml::to_string(&k3s_registries)
                    .context("Failed to serialize the k3s registries into a yaml string")?;
            }
        }

        stages.insert(
            s!("initramfs"),
            vec![
                Task {
                    name: Some(s!("Mount the partitions")),
                    commands: Some(vec![
                        s!("mkdir -p /var/lib/longhorn/drives/p0"),
                        s!("mount -o rw /dev/disk/by-partlabel/p0 /var/lib/longhorn/drives/p0"),
                        s!("mkdir -p /var/lib/longhorn/drives/p1"),
                        s!("mount -o rw /dev/disk/by-partlabel/p1 /var/lib/longhorn/drives/p1"),
                    ]),
                    ..Task::default()
                },
                Task {
                    name: Some(s!("Set the static ip addresses")),
                    files: Some(vec![CloudInitFile {
                        path: s!("/etc/systemd/network/01-man.network"),
                        permissions: 644,
                        content: static_ip_config,
                    }]),
                    ..Task::default()
                },
                Task {
                    name: Some(s!("Set up the registry file")),
                    files: Some(vec![CloudInitFile {
                        path: s!("/etc/rancher/k3s/registries.yaml"),
                        permissions: 644,
                        content: k3s_registries_yaml_string,
                    }]),
                    ..Task::default()
                },
            ],
        );

        stages.insert(
            s!("kairos-install.pre.before"),
            vec![Task {
                if_: Some(format!(r#"[ -e "{}" ]"#, get_device_string(virt, 1))),
                name: Some(s!("Create the partition p1 as ext4")),
                commands: Some(vec![format!(
                    r#"parted --script --machine -- "{}" mklabel gpt"#,
                    get_device_string(virt, 1)
                )]),
                layout: Some(DiskLayout {
                    device: DiskLayoutDevice {
                        path: get_device_string(virt, 1),
                    },
                    add_partitions: vec![DiskLayoutPartition {
                        fs_label: s!("p1"),
                        size: 0,
                        p_label: s!("p1"),
                        filesystem: s!("ext4"),
                    }],
                }),
                ..Task::default()
            }],
        );

        Ok(CloudInit {
            debug,
            users: vec![user],
            k3s: K3s::new(
                node_hostname == primary_hostname,
                primary_hostname,
                k3s_token,
                vip,
            ),
            hostname: node_hostname.to_string(),
            install: Install::new(&get_device_string(virt, 0)),
            kcrypt: Kcrypt::new(todo),
            stages: Some(stages),
        })
    }
}

impl Kcrypt {
    pub fn new(challenger_server: &str) -> Kcrypt {
        Kcrypt {
            challenger: KcryptChallenger {
                challenger_server: challenger_server.to_string(),
            },
        }
    }
}

impl Install {
    pub fn new(device: &str) -> Install {
        Install {
            device: device.to_string(),
            reboot: true,
            auto: true,
            partitions: Partitions {
                persistent: PersistentPartition { size: 1024 * 20 },
            },
            extra_partitions: vec![ExtraPartition {
                name: s!("p0"),
                size: 0,
                fs: s!("ext4"),
            }],
        }
    }
}

impl K3s {
    pub fn new(primary: bool, primary_hostname: &str, k3s_token: &str, vip: &Vip) -> K3s {
        let tls_san = match &vip.controlplane.legacy_ip {
            Some(ip) => Some(format!("--tls-san={}", ip)),
            None => None,
        };

        let mut base_args = vec![
            "--flannel-backend=none",
            "--kube-cloud-controller-manager-arg=webhook-secure-port=0",
            "--disable-network-policy",
            "--disable-kube-proxy",
            "--disable local-storage",
            "--disable traefik",
            "--disable servicelb",
            "--etcd-expose-metrics=true",
            "--cluster-cidr=10.42.0.0/16", // ,2001:cafe:42::/56 TODO implement ipv6
            "--service-cidr=10.43.0.0/16", // ,2001:cafe:43::/112
                                           //"--kube-controller-manager-arg=pod-eviction-timeout=30s",
        ];

        if let Some(tls_san) = &tls_san {
            base_args.push(tls_san);
        }

        let primary_args = vec!["--cluster-init"];

        let server_url = format!("https://{}:6443", primary_hostname);

        let secondary_args = vec!["--server", server_url.as_str()];

        let mut env = HashMap::new();

        env.insert("K3S_TOKEN".to_string(), k3s_token.to_string());

        // combine the args
        K3s {
            enabled: true,
            args: base_args
                .iter()
                .chain(if primary {
                    primary_args.iter()
                } else {
                    secondary_args.iter()
                })
                .map(|s| s.to_string())
                .collect(),
            env,
        }
    }
}
