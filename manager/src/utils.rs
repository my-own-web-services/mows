use anyhow::{bail, Context};
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use tokio::process::Command;

use crate::some_or_bail;

pub fn generate_id(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8; 62] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            *CHARSET.get(idx).unwrap() as char
        })
        .collect()
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

    if !command.status.success() {
        let stderr = std::str::from_utf8(&command.stderr).unwrap_or("Failed to get stderr");
        bail!("{}: [{}]: {}", error.to_string(), command.status, stderr)
    }

    Ok(String::from_utf8(command.stdout)?)
}

pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
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
