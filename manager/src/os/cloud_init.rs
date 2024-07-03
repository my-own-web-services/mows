use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    config::{SshAccess, Vip},
    s,
};

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
    pub name: String,
    pub commands: Vec<String>,
    #[serde(rename = "if")]
    pub if_: Option<String>,
    pub layout: Option<DiskLayout>,
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
    ) -> CloudInit {
        let todo = "http://192.168.122.216:30000";

        // variables https://github.com/zcalusic/sysinfo#sample-output

        let user = User {
            name: ssh_config.ssh_username.clone(),
            ssh_authorized_keys: vec![ssh_config.ssh_public_key.clone()],
            passwd: ssh_config.ssh_password.clone(),
        };

        let mut stages = HashMap::new();

        stages.insert(
            s!("initramfs"),
            vec![Task {
                name: s!("Mount the partition p0"),
                commands: vec![
                    s!("mkdir -p /var/lib/longhorn/drives/p0"),
                    s!("mount -o rw /dev/disk/by-partlabel/p0 /var/lib/longhorn/drives/p0"),
                    s!("mkdir -p /var/lib/longhorn/drives/p1"),
                    s!("mount -o rw /dev/disk/by-partlabel/p1 /var/lib/longhorn/drives/p1"),
                ],
                ..Task::default()
            }],
        );

        stages.insert(
            s!("kairos-install.pre.before"),
            vec![Task {
                if_: Some(format!(r#"[ -e "{}" ]"#, get_device_string(virt, 1))),
                name: s!("Create the partition p1 as ext4"),
                commands: vec![format!(
                    r#"parted --script --machine -- "{}" mklabel gpt"#,
                    get_device_string(virt, 1)
                )],
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
            }],
        );

        CloudInit {
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
        }
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
                persistent: PersistentPartition { size: 1024 * 10 },
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
            "--disable-network-policy",
            "--disable-kube-proxy",
            "--disable traefik",
            "--disable servicelb",
            "--cluster-cidr=10.42.0.0/16", // ,2001:cafe:42::/56 TODO implement ipv6
            "--service-cidr=10.43.0.0/16", // ,2001:cafe:43::/112
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
