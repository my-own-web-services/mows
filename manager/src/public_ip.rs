use std::{
    collections::{BTreeMap, HashMap},
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
    path::Path,
    str::FromStr,
};

use anyhow::{bail, Context, Ok};
use k8s_openapi::{
    api::core::v1::Namespace, apimachinery::pkg::api::resource::Quantity, ByteString,
};
use kube::api::ObjectMeta;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    api::public_ip::PublicIpCreationConfigType,
    config::{config, Cluster, Machine, PublicIpConfig, PublicIpVmProxy},
    some_or_bail,
    utils::cmd,
    write_config,
};
use mows_common::{config::common_config, get_current_config_cloned, s};

pub async fn remove_public_ip_config_if_exists(machine_id: &str) -> anyhow::Result<()> {
    let config = get_current_config_cloned!(config());

    for (_, cluster) in &config.clusters {
        for (public_ip_id, public_ip) in &cluster.public_ip_config {
            if let PublicIpConfig::MachineProxy(proxy) = public_ip {
                if proxy.machine_id == machine_id {
                    let mut config_locked = write_config!();
                    config_locked
                        .clusters
                        .get_mut(&cluster.id)
                        .unwrap()
                        .public_ip_config
                        .remove(public_ip_id);
                }
            }
        }
    }

    Ok(())
}

pub async fn create_public_ip_handler(
    creation_config: PublicIpCreationConfigType,
) -> anyhow::Result<PublicIpConfig> {
    match creation_config {
        PublicIpCreationConfigType::MachineProxy(remote_machine_id, local_cluster_id) => {
            create_machine_proxy_public_ip(&remote_machine_id, &local_cluster_id).await
        }
    }
}

pub async fn create_machine_proxy_public_ip(
    machine_id: &str,
    cluster_id: &str,
) -> anyhow::Result<PublicIpConfig> {
    let config = get_current_config_cloned!(config());

    let (_, machine) = some_or_bail!(
        config.machines.iter().find(|m| m.1.id == machine_id),
        format!("Could not find machine with id {}", machine_id)
    );

    let (_, cluster) = some_or_bail!(
        config.clusters.iter().find(|c| c.1.id == cluster_id),
        format!("Could not find cluster with id {}", cluster_id)
    );

    let keys = generate_wg_keys()
        .await
        .context("Failed to generate WireGuard keys for the machine.")?;

    install_remote_wireguard(machine, &keys)
        .await
        .context("Failed to install WireGuard on remote machine.")?;

    install_local_wireguard(cluster, &keys, machine.public_ip, machine.public_legacy_ip)
        .await
        .context("Failed to install WireGuard on local cluster.")?;

    Ok(PublicIpConfig::MachineProxy(PublicIpVmProxy {
        machine_id: machine.id.clone(),
        wg_keys: keys,
        ip: machine.public_ip,
        legacy_ip: machine.public_legacy_ip,
    }))
}

pub async fn install_local_wireguard(
    cluster: &Cluster,
    wg_keys: &WgKeys,
    remote_ip: Option<Ipv6Addr>,
    remote_legacy_ip: Option<Ipv4Addr>,
) -> anyhow::Result<()> {
    let common_config = get_current_config_cloned!(common_config(false));

    let mut tcp_service_map: HashMap<u16, String> = HashMap::new();

    let mut udp_service_map: HashMap<u16, String> = HashMap::new();

    // Ingress
    {
        let ingress_const = common_config.constants.core_components.ingress;
        let full_ingress_service_name =
            format!("{}.{}", ingress_const.service_name, ingress_const.namespace);
        tcp_service_map.insert(80, full_ingress_service_name.clone());
        tcp_service_map.insert(443, full_ingress_service_name.clone());
        udp_service_map.insert(443, full_ingress_service_name);
    }
    // DNS
    {
        let dns_const = common_config.constants.core_components.dns;
        let full_dns_service_name =
            format!("{}.{}", dns_const.server_service_name, dns_const.namespace);
        tcp_service_map.insert(53, full_dns_service_name.clone());
        udp_service_map.insert(53, full_dns_service_name);
    }
    // Email
    {
        let email_const = common_config.constants.core_components.email;
        let email_full_service_name =
            format!("{}.{}", email_const.service_name, email_const.namespace);
        let email_ports = email_const.public_ports.clone();
        tcp_service_map.insert(email_ports.smtp, email_full_service_name.clone());
        tcp_service_map.insert(email_ports.submission, email_full_service_name.clone());
        tcp_service_map.insert(email_ports.smtps, email_full_service_name.clone());
        tcp_service_map.insert(email_ports.imap, email_full_service_name.clone());
        tcp_service_map.insert(email_ports.imaps, email_full_service_name.clone());
        tcp_service_map.insert(email_ports.sieve, email_full_service_name.clone());
    }

    let local_wg_config = create_local_wg_config(
        wg_keys,
        remote_ip,
        remote_legacy_ip,
        &tcp_service_map,
        &udp_service_map,
    )
    .await
    .context("Failed to generate local WireGuard configuration for the cluster.")?;

    let namespace_name = common_config
        .constants
        .core_components
        .public_ip
        .namespace
        .clone();

    let kube_client = cluster.get_kube_client().await?;

    // create the namespace

    let namespace_api: kube::Api<Namespace> = kube::Api::all(kube_client.clone());

    let namespace = Namespace {
        metadata: ObjectMeta {
            name: Some(namespace_name.to_string()),
            ..Default::default()
        },
        ..Default::default()
    };

    // only create the namespace if it doesn't exist

    if namespace_api.get(&namespace_name).await.is_err() {
        namespace_api
            .create(&kube::api::PostParams::default(), &namespace)
            .await
            .context("Failed to create namespace for WireGuard configuration.")?;
    }
    // create the wireguard configuration as secret
    let secrets_api: kube::Api<k8s_openapi::api::core::v1::Secret> =
        kube::Api::namespaced(kube_client.clone(), &namespace_name);

    let mut secret_data = BTreeMap::new();

    let secret_name = common_config
        .constants
        .core_components
        .public_ip
        .wg_secret_name
        .clone();

    secret_data.insert(
        s!("wg0.conf"),
        ByteString(local_wg_config.as_bytes().to_vec()),
    );

    let secret = k8s_openapi::api::core::v1::Secret {
        metadata: ObjectMeta {
            name: Some(secret_name.clone()),
            ..Default::default()
        },
        data: Some(secret_data),
        ..Default::default()
    };

    if secrets_api.get(&secret_name).await.is_ok() {
        secrets_api
            .replace(&secret_name, &Default::default(), &secret)
            .await
            .context("Failed to replace secret for WireGuard configuration.")?;
    } else {
        secrets_api
            .create(&kube::api::PostParams::default(), &secret)
            .await
            .context("Failed to create secret for WireGuard configuration.")?;
    }
    // create the wireguard pod
    let pod_api: kube::Api<k8s_openapi::api::core::v1::Pod> =
        kube::Api::namespaced(kube_client.clone(), &namespace_name);

    let pod_name = common_config
        .constants
        .core_components
        .public_ip
        .pod_name
        .clone();

    // delete the pod if it exists
    if pod_api.get(&pod_name).await.is_ok() {
        pod_api
            .delete(&pod_name, &Default::default())
            .await
            .context("Failed to delete pod for WireGuard configuration.")?;
    }

    // wait until the pod is deleted
    loop {
        if pod_api.get(&pod_name).await.is_err() {
            break;
        }
    }

    // TODO create a smaller image
    let wg_client_image = common_config
        .constants
        .core_components
        .public_ip
        .wg_client_image
        .clone();

    let start_cmd = "wg-quick up wg0 && sleep infinity";

    let mut pod_limits = BTreeMap::new();

    pod_limits.insert(s!("cpu"), Quantity(s!("500m")));
    pod_limits.insert(s!("memory"), Quantity(s!("128Mi")));

    // TODO maybe turn this into a deployment

    let pod = k8s_openapi::api::core::v1::Pod {
        metadata: ObjectMeta {
            name: Some(pod_name.clone()),
            ..Default::default()
        },
        spec: Some(k8s_openapi::api::core::v1::PodSpec {
            containers: vec![k8s_openapi::api::core::v1::Container {
                name: pod_name.clone(),
                image: Some(s!(wg_client_image)),
                command: Some(vec![s!("bash"), s!("-c"), s!(start_cmd)]),
                security_context: Some(k8s_openapi::api::core::v1::SecurityContext {
                    capabilities: Some(k8s_openapi::api::core::v1::Capabilities {
                        add: Some(vec![s!("NET_ADMIN")]),
                        ..Default::default()
                    }),
                    ..Default::default()
                }),
                volume_mounts: Some(vec![k8s_openapi::api::core::v1::VolumeMount {
                    name: s!("wg0-conf"),
                    mount_path: s!("/etc/wireguard"),
                    ..Default::default()
                }]),
                resources: Some(k8s_openapi::api::core::v1::ResourceRequirements {
                    limits: Some(pod_limits),
                    ..Default::default()
                }),

                ..Default::default()
            }],
            volumes: Some(vec![k8s_openapi::api::core::v1::Volume {
                name: s!("wg0-conf"),
                secret: Some(k8s_openapi::api::core::v1::SecretVolumeSource {
                    secret_name: Some(secret_name.clone()),
                    ..Default::default()
                }),
                ..Default::default()
            }]),
            restart_policy: Some(s!("Always")),

            ..Default::default()
        }),
        ..Default::default()
    };

    if pod_api.get(&pod_name).await.is_ok() {
        pod_api
            .replace(&pod_name, &Default::default(), &pod)
            .await
            .context("Failed to replace pod for WireGuard configuration.")?;
    } else {
        pod_api
            .create(&kube::api::PostParams::default(), &pod)
            .await
            .context("Failed to create pod for WireGuard configuration.")?;
    }
    // k logs mows-core-network-public-ip -n mows-core-network-public-ip -c mows-core-network-public-ip
    Ok(())
}

pub async fn install_remote_wireguard(machine: &Machine, keys: &WgKeys) -> anyhow::Result<()> {
    let remote_wg_config =
        create_remote_wg_config(keys, "eth0", machine.public_ip, machine.public_legacy_ip)
            .await
            .context("Failed to generate remote WireGuard configuration for the machine.")?;

    let wg_config_command = format!(
        r#"cat <<EOF > /etc/wireguard/wg0.conf
{remote_wg_config}
EOF
    "#
    );

    let commands = vec![
        "apt-get update",
        "apt-get install -y wireguard",
        "echo 'net.ipv4.ip_forward = 1' > /etc/sysctl.d/99-sysctl.conf",
        "echo 'net.ipv6.conf.all.forwarding = 1'>> /etc/sysctl.d/99-sysctl.conf",
        "sysctl --system",
        &wg_config_command,
        "systemctl enable --now wg-quick@wg0",
        "systemctl restart --now wg-quick@wg0",
    ];

    for command in commands {
        machine.exec(command, 20).await.context(format!(
            "Failed to install WireGuard on the machine. Failed at command: {}",
            &command
        ))?;
    }

    Ok(())
}

pub async fn create_local_wg_config(
    wg_keys: &WgKeys,
    ip: Option<Ipv6Addr>,
    legacy_ip: Option<Ipv4Addr>,
    tcp_service_map: &HashMap<u16, String>,
    udp_service_map: &HashMap<u16, String>,
) -> anyhow::Result<String> {
    let WgKeys {
        local_wg_private_key,
        remote_wg_public_key,
        ..
    } = wg_keys;

    let legacy_service_prefix = "10.43.0.0/16";

    let local_internal_ip = Ipv6Addr::from_str("fd00::2").unwrap();
    let local_internal_legacy_ip = Ipv4Addr::new(10, 99, 0, 2);

    let local_internal_ip_str = match (ip, legacy_ip) {
        (Some(_), None) => format!("{}/128", local_internal_ip),
        (None, Some(_)) => format!("{}/32", local_internal_legacy_ip),
        (Some(_), Some(_)) => format!("{}/128, {}/32", local_internal_ip, local_internal_legacy_ip),
        (None, None) => bail!("No IP provided"),
    };

    let remote_ip = match ip {
        Some(i) => IpAddr::V6(i),
        None => IpAddr::V4(some_or_bail!(legacy_ip, "No IP provided")),
    };

    let ip_up = String::new();
    let ip_down = String::new();
    let mut legacy_ip_up = String::new();
    let mut legacy_ip_down = String::new();

    legacy_ip_up.push_str(&format!(
        "PreUp = ip route add {legacy_service_prefix} dev eth0 || true \n\n",
        legacy_service_prefix = legacy_service_prefix
    ));

    legacy_ip_down.push_str(&format!(
        "PostDown = ip route del {legacy_service_prefix} dev eth0 || true \n\n",
        legacy_service_prefix = legacy_service_prefix
    ));

    for (port, service_address) in tcp_service_map.iter() {
        if legacy_ip.is_some() {
            legacy_ip_up.push_str(&format!("PreUp = iptables -t nat -A PREROUTING -i wg0 -p tcp --dport {port} -j DNAT --to-destination $(dig +short {service_address}.svc.cluster.local) ; iptables -t nat -A POSTROUTING -p tcp --dport {port} -j MASQUERADE \n\n"));

            legacy_ip_down.push_str(&format!("PostDown = iptables -t nat -D PREROUTING -i wg0 -p tcp --dport {port} -j DNAT --to-destination $(dig +short {service_address}.svc.cluster.local) ; iptables -t nat -A POSTROUTING -p tcp --dport {port} -j MASQUERADE \n\n"));
        }
    }

    for (port, service_address) in udp_service_map.iter() {
        if legacy_ip.is_some() {
            legacy_ip_up.push_str(&format!("PreUp = iptables -t nat -A PREROUTING -i wg0 -p udp --dport {port} -j DNAT --to-destination $(dig +short {service_address}.svc.cluster.local) ; iptables -t nat -A POSTROUTING -p udp --dport {port} -j MASQUERADE \n\n"));

            legacy_ip_down.push_str(&format!("PostDown = iptables -t nat -D PREROUTING -i wg0 -p udp --dport {port} -j DNAT --to-destination $(dig +short {service_address}.svc.cluster.local) ; iptables -t nat -A POSTROUTING -p udp --dport {port} -j MASQUERADE \n\n"));
        }
    }

    let local_wg_config = format!(
        r#"[Interface]
PrivateKey = {local_wg_private_key}
Address = {local_internal_ip_str}
MTU = 1384

{ip_up}

{ip_down}

{legacy_ip_up}

{legacy_ip_down}

[Peer]
PublicKey = {remote_wg_public_key}
PersistentKeepalive = 25
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = {remote_ip}:55107
"#
    );

    Ok(local_wg_config)
}

pub async fn create_remote_wg_config(
    wg_keys: &WgKeys,
    wan_interface: &str,
    ip: Option<Ipv6Addr>,
    legacy_ip: Option<Ipv4Addr>,
) -> anyhow::Result<String> {
    let wg_listen_port = 55107;

    let WgKeys {
        remote_wg_private_key,
        local_wg_public_key,
        ..
    } = wg_keys;

    let remote_internal_ip = Ipv6Addr::from_str("fd00::1").unwrap();
    let remote_internal_legacy_ip = Ipv4Addr::new(10, 99, 0, 1);

    let remote_internal_ip_str = match (ip, legacy_ip) {
        (Some(_), None) => format!("{}/128", remote_internal_ip),
        (None, Some(_)) => format!("{}/32", remote_internal_legacy_ip),
        (Some(_), Some(_)) => format!(
            "{}/128, {}/32",
            remote_internal_ip, remote_internal_legacy_ip
        ),
        (None, None) => bail!("No IP provided"),
    };

    let local_internal_ip = Ipv6Addr::from_str("fd00::2").unwrap();
    let local_internal_legacy_ip = Ipv4Addr::new(10, 99, 0, 2);

    let local_internal_ip_str = match (ip, legacy_ip) {
        (Some(_), None) => format!("{}/128", local_internal_ip),
        (None, Some(_)) => format!("{}/32", local_internal_legacy_ip),
        (Some(_), Some(_)) => format!("{}/128, {}/32", local_internal_ip, local_internal_legacy_ip),
        (None, None) => bail!("No IP provided"),
    };

    let ip_post_up = match ip {
        Some(i) => format!(
            r#"PostUp = ip6tables -t nat -A PREROUTING -p tcp -i {wan_interface} '!' --dport 22 -j DNAT --to-destination {local_internal_ip}; ip6tables -t nat -A POSTROUTING -o {wan_interface} -j SNAT --to-source {i}
PostUp = ip6tables -t nat -A PREROUTING -p udp -i {wan_interface} '!' --dport {wg_listen_port} -j DNAT --to-destination {local_internal_ip};"#
        ),
        None => s!(""),
    };

    let ip_post_down = match ip {
        Some(i) => format!(
            r#"PostDown = ip6tables -t nat -D PREROUTING -p tcp -i {wan_interface} '!' --dport 22 -j DNAT --to-destination {local_internal_ip}; ip6tables -t nat -D POSTROUTING -o {wan_interface} -j SNAT --to-source {i}
PostDown = ip6tables -t nat -D PREROUTING -p udp -i {wan_interface} '!' --dport {wg_listen_port} -j DNAT --to-destination {local_internal_ip};"#
        ),
        None => s!(""),
    };

    let legacy_ip_post_up = match legacy_ip {
        Some(li) => format!(
            r#"PostUp = iptables -t nat -A PREROUTING -p tcp -i {wan_interface} '!' --dport 22 -j DNAT --to-destination {local_internal_legacy_ip}; iptables -t nat -A POSTROUTING -o {wan_interface} -j SNAT --to-source {li}
PostUp = iptables -t nat -A PREROUTING -p udp -i {wan_interface} '!' --dport {wg_listen_port} -j DNAT --to-destination {local_internal_legacy_ip};"#
        ),
        None => s!(""),
    };

    let legacy_ip_post_down = match legacy_ip {
        Some(li) => format!(
            r#"PostDown = iptables -t nat -D PREROUTING -p tcp -i {wan_interface} '!' --dport 22 -j DNAT --to-destination {local_internal_legacy_ip}; iptables -t nat -D POSTROUTING -o {wan_interface} -j SNAT --to-source {li}
PostDown = iptables -t nat -D PREROUTING -p udp -i {wan_interface} '!' --dport {wg_listen_port} -j DNAT --to-destination {local_internal_legacy_ip};"#
        ),
        None => s!(""),
    };

    let remote_wg_config = format!(
        r#"[Interface]
PrivateKey = {remote_wg_private_key}
ListenPort = {wg_listen_port}
Address = {remote_internal_ip_str}
MTU = 1420

{ip_post_up}

{ip_post_down}

{legacy_ip_post_up}

{legacy_ip_post_down}

[Peer]
PublicKey = {local_wg_public_key}
AllowedIPs = {local_internal_ip_str}"#,
    );

    Ok(remote_wg_config)
}

pub async fn generate_wg_keys() -> anyhow::Result<WgKeys> {
    let output_dir = Path::new("/tmp/wg_keys");

    let gen_keys_script = r#"
    #!/bin/bash

set -euo pipefail

# the first argument to the script is the output directory
OUTPUT_DIR=$1

# generate local keypair
wg genkey | tee $OUTPUT_DIR/local_wg_private_key | wg pubkey > $OUTPUT_DIR/local_wg_public_key

# generate remote keypair
wg genkey | tee $OUTPUT_DIR/remote_wg_private_key | wg pubkey > $OUTPUT_DIR/remote_wg_public_key
"#;

    let _ = tokio::fs::remove_dir_all(output_dir).await;

    tokio::fs::create_dir_all(output_dir)
        .await
        .context("Failed to create directory for WireGuard keys.")?;

    tokio::fs::write(output_dir.join("gen_keys.sh"), gen_keys_script)
        .await
        .context("Failed to write script to generate WireGuard keys to the output directory.")?;

    cmd(
        vec![
            "bash",
            output_dir.join("gen_keys.sh").to_str().unwrap(),
            output_dir.to_str().unwrap(),
        ],
        "Failed to generate WireGuard keys",
    )
    .await
    .context("Failed to run script to generate WireGuard keys.")?;

    let keys = WgKeys {
        local_wg_private_key: tokio::fs::read_to_string(output_dir.join("local_wg_private_key"))
            .await?
            .trim()
            .to_string(),
        local_wg_public_key: tokio::fs::read_to_string(output_dir.join("local_wg_public_key"))
            .await?
            .trim()
            .to_string(),
        remote_wg_private_key: tokio::fs::read_to_string(output_dir.join("remote_wg_private_key"))
            .await?
            .trim()
            .to_string(),
        remote_wg_public_key: tokio::fs::read_to_string(output_dir.join("remote_wg_public_key"))
            .await?
            .trim()
            .to_string(),
    };

    tokio::fs::remove_dir_all(output_dir)
        .await
        .context("Failed to remove directory for WireGuard keys.")?;

    Ok(keys)
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct WgKeys {
    pub remote_wg_private_key: String,
    pub remote_wg_public_key: String,
    pub local_wg_private_key: String,
    pub local_wg_public_key: String,
}
