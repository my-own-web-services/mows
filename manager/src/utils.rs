use std::{os::unix::fs::PermissionsExt, process::Stdio};

use anyhow::{bail, Context};
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use tokio::{process::Command, signal};
use tracing::debug;

use crate::{
    internal_config::INTERNAL_CONFIG,
    some_or_bail,
    types::{ApiResponse, ApiResponseStatus},
};

pub async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

pub async fn start_pixiecore() -> anyhow::Result<()> {
    let ic = &INTERNAL_CONFIG;
    tracing::info!("Starting pixiecore server");

    Command::new("pixiecore")
        .args(["api", "http://localhost:3000", "--dhcp-no-bind"])
        .stdout(if ic.log.pixiecore.stdout {
            Stdio::inherit()
        } else {
            Stdio::null()
        })
        .stderr(if ic.log.pixiecore.stderr {
            Stdio::inherit()
        } else {
            Stdio::null()
        })
        .spawn()
        .context("Failed to start pixiecore server")?;

    Ok(())
}

pub async fn start_dnsmasq() -> anyhow::Result<()> {
    let ic = &INTERNAL_CONFIG;
    tracing::info!("Starting dnsmasq server");

    // start dnsmasq: dnsmasq -a 192.168.112.3 --no-daemon --log-queries --dhcp-alternate-port=67 --dhcp-range=192.168.112.5,192.168.112.30,12h --domain-needed --bogus-priv --dhcp-authoritative

    // the directory for the manually created dns entries
    tokio::fs::create_dir_all("/hosts").await?;

    //combine the host resolv conf with the default one
    let resolv_conf = tokio::fs::read_to_string("/etc/resolv.conf").await?;

    let host_resolv_conf = tokio::fs::read_to_string("/etc/host-resolv.conf").await?;

    tokio::fs::write(
        "/tmp/resolv.conf",
        format!("{}\n{}", resolv_conf, host_resolv_conf),
    )
    .await?;

    let mut args = vec![
        "--no-daemon",
        "--log-queries",
        "--dhcp-alternate-port=67",
        "--domain-needed",
        "--bogus-priv",
        "--dhcp-authoritative",
        "--hostsdir",
        "/hosts/",
        "--dhcp-leasefile=/temp/dnsmasq/leases",
        "--resolv-file=/tmp/resolv.conf",
    ];

    let mut dhcp_args = vec![];

    for range in &ic.dhcp.ranges {
        dhcp_args.push(format!("--dhcp-range={}", range));
    }

    dhcp_args.iter().for_each(|arg| args.push(arg));

    tokio::fs::create_dir_all("/temp/dnsmasq").await?;
    // enable everyone to delete the folder
    tokio::fs::set_permissions("/temp/dnsmasq", std::fs::Permissions::from_mode(0o777)).await?;

    Command::new("dnsmasq")
        .args(args)
        .stdout(if ic.log.dnsmasq.stdout {
            Stdio::inherit()
        } else {
            Stdio::null()
        })
        .stderr(if ic.log.dnsmasq.stderr {
            Stdio::inherit()
        } else {
            Stdio::null()
        })
        .spawn()
        .context("Failed to start the dnsmasq server")?;

    Ok(())
}

pub async fn cmd(cmd_and_args: Vec<&str>, error: &str) -> anyhow::Result<String> {
    let cmd = some_or_bail!(cmd_and_args.first(), "No command provided");
    let args = cmd_and_args
        .iter()
        .skip(1)
        .map(|s| s.to_string())
        .collect::<Vec<String>>();
    let command = Command::new(cmd)
        .args(args.clone())
        .output()
        .await
        .context(error.to_string())?;

    if command.status.code().is_some_and(|code| code != 0) {
        let stderr = std::str::from_utf8(&command.stderr).unwrap_or("Failed to get stderr");
        let stdout = std::str::from_utf8(&command.stdout).unwrap_or("Failed to get stdout");

        // log the exact command that was spawned
        debug!("Failed to execute command: {} {:?}", cmd, args);

        bail!(
            "{}: [{}]: {} {}",
            error.to_string(),
            command.status,
            stderr,
            stdout
        )
    }

    Ok(String::from_utf8(command.stdout)?)
}

pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            StatusCode::OK,
            Json(ApiResponse {
                message: self.0.to_string(),
                data: None::<()>,
                status: ApiResponseStatus::Error,
            }),
        )
            .into_response()
    }
}

// This enables using `?` on functions that return `Result<_, anyhow::Error>` to turn them into
// `Result<_, AppError>`. That way you don't need to do that manually.
impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

pub struct Arp {
    pub ip: String,
    pub hwtype: String,
    pub mac: String,
}

pub async fn get_connected_machines_arp() -> anyhow::Result<Vec<Arp>> {
    let output = Command::new("arp").output().await?;
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

pub async fn get_current_ip_from_mac(mac: &str) -> anyhow::Result<String> {
    let online_machines = get_connected_machines_arp().await.context(
        "Could not get connected machines from arp table while trying to get ip from mac address",
    )?;

    let arp_machine = some_or_bail!(
        online_machines.into_iter().find(|arp| arp.mac == mac),
        "Machine not found while trying to get ip from mac address"
    );

    Ok(arp_machine.ip)
}
