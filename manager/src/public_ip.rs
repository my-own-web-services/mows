use std::{
    net::{Ipv4Addr, Ipv6Addr},
    path::Path,
    str::FromStr,
};

use anyhow::{bail, Context, Ok};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    api::public_ip::PublicIpCreationConfigType,
    config::{Machine, PublicIpConfig, PublicIpVmProxy},
    get_current_config_cloned, s, some_or_bail,
    utils::cmd,
};

pub async fn create_public_ip_handler(
    creation_config: PublicIpCreationConfigType,
) -> anyhow::Result<PublicIpConfig> {
    match creation_config {
        PublicIpCreationConfigType::MachineProxy(id) => create_public_ip_from_machine(&id).await,
    }
}

pub async fn create_public_ip_from_machine(machine_id: &str) -> anyhow::Result<PublicIpConfig> {
    let config = get_current_config_cloned!();

    let (_, machine) = some_or_bail!(
        config.machines.iter().find(|m| m.1.id == machine_id),
        format!("Could not find machine with id {}", machine_id)
    );

    let keys = generate_wg_keys()
        .await
        .context("Failed to generate WireGuard keys for the machine.")?;

    install_wireguard(machine, &keys)
        .await
        .context("Failed to install WireGuard on the machine.")?;

    Ok(PublicIpConfig::MachineProxy(PublicIpVmProxy {
        machine_id: machine.id.clone(),
        wg_keys: keys,
        ip: machine.public_ip,
        legacy_ip: machine.public_legacy_ip,
    }))
}

pub async fn install_wireguard(machine: &Machine, keys: &WgKeys) -> anyhow::Result<()> {
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
    ];

    for command in commands {
        machine.exec(command, 10).await.context(format!(
            "Failed to install WireGuard on the machine. Failed at command: {}",
            &command
        ))?;
    }

    Ok(())
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
    let remote_internal_legacy_ip = Ipv4Addr::new(10, 0, 0, 1);

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
    let local_internal_legacy_ip = Ipv4Addr::new(10, 0, 0, 2);

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

{ip_post_up}

{ip_post_down}

{legacy_ip_post_up}

{legacy_ip_post_down}

[Peer]
PublicKey = {local_wg_public_key}
AllowedIPs = {local_internal_ip_str}

"#,
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
