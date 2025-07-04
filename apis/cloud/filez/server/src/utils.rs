use anyhow::bail;
use bigdecimal::BigDecimal;
use tokio::signal::{self};
use url::Url;
use uuid::Timestamp;

pub fn get_uuid() -> uuid::Uuid {
    let ts = Timestamp::now(uuid::NoContext);
    uuid::Uuid::new_v7(ts)
}

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

#[derive(Debug, thiserror::Error)]
#[error("Invalid enum type: {msg}")]
pub struct InvalidEnumType {
    pub msg: String,
}

impl InvalidEnumType {
    pub fn invalid_type_log(msg: String) -> Self {
        InvalidEnumType { msg }
    }
}

pub struct Range {
    pub start: BigDecimal,
    pub end: Option<BigDecimal>,
    pub length: Option<BigDecimal>,
}

pub fn parse_range(range: &str) -> anyhow::Result<Range> {
    let parts = range.split('=').collect::<Vec<_>>();
    if parts.len() != 2 {
        bail!("Invalid range");
    }
    let range_type = parts
        .first()
        .ok_or_else(|| anyhow::anyhow!("No range type"))?;
    let range = parts.get(1).ok_or_else(|| anyhow::anyhow!("No range"))?;
    if range_type != &"bytes" {
        bail!("Invalid range type");
    }
    let range_parts = range.split('-').collect::<Vec<_>>();

    if range_parts.len() != 2 {
        bail!("Invalid range");
    }
    let start = range_parts
        .first()
        .ok_or_else(|| anyhow::anyhow!("Invalid range byte start"))?
        .parse::<u64>()?;
    let end = range_parts
        .get(1)
        .ok_or_else(|| anyhow::anyhow!("Invalid range byte end"))?
        .parse::<u64>()
        .ok();
    Ok(Range {
        start: BigDecimal::from(start),
        end: end.map(BigDecimal::from),
        length: end.map(|e| BigDecimal::from(e - start + 1)),
    })
}

pub async fn is_dev_origin(config: &crate::config::FilezServerConfig, origin: &Url) -> Option<Url> {
    if config.enable_dev {
        for dev_origin_url in config.dev_allow_origins.iter() {
            if dev_origin_url == origin {
                return Some(dev_origin_url.clone());
            }
        }
    }
    return None;
}
