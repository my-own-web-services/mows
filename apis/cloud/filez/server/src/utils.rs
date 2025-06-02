use async_trait::async_trait;
use axum_health::{HealthDetail, HealthIndicator};
use minio::s3::{response::BucketExistsResponse, types::S3Api};
use tokio::signal::{self};
use zitadel::axum::introspection::IntrospectionState;

use crate::{config::BUCKET_NAME, db::Db};

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

pub async fn create_bucket_if_not_exists(
    bucket_name: &str,
    client: &minio::s3::Client,
) -> Result<(), anyhow::Error> {
    let resp: BucketExistsResponse = client.bucket_exists(bucket_name).send().await?;

    if !resp.exists {
        client.create_bucket(bucket_name).send().await.unwrap();
    };
    Ok(())
}

pub struct MinioHealthIndicator {
    name: String,
    minio_client: minio::s3::Client,
}

impl MinioHealthIndicator {
    pub fn new(name: String, minio_client: minio::s3::Client) -> Self {
        MinioHealthIndicator { name, minio_client }
    }
}

#[async_trait]
impl HealthIndicator for MinioHealthIndicator {
    fn name(&self) -> String {
        self.name.to_owned()
    }

    async fn details(&self) -> HealthDetail {
        match self.minio_client.bucket_exists(BUCKET_NAME).send().await {
            Ok(resp) if resp.exists => HealthDetail::new(axum_health::HealthStatus::Up)
                .with_detail("minio".to_string(), "Minio is healthy".to_string())
                .clone(),
            Ok(_) => HealthDetail::new(axum_health::HealthStatus::Down)
                .with_detail(
                    "minio".to_string(),
                    "Minio bucket does not exist".to_string(),
                )
                .clone(),
            Err(e) => HealthDetail::new(axum_health::HealthStatus::Down)
                .with_detail("minio".to_string(), e.to_string())
                .clone(),
        }
    }
}

pub struct PostgresHealthIndicator {
    name: String,
    db: Db,
}
impl PostgresHealthIndicator {
    pub fn new(name: String, db: Db) -> Self {
        PostgresHealthIndicator { name, db }
    }
}

#[async_trait]
impl HealthIndicator for PostgresHealthIndicator {
    fn name(&self) -> String {
        self.name.to_owned()
    }

    async fn details(&self) -> HealthDetail {
        match self.db.get_health().await {
            Ok(_) => HealthDetail::new(axum_health::HealthStatus::Up)
                .with_detail("database".to_string(), "Postgres is healthy".to_string())
                .clone(),
            Err(e) => HealthDetail::new(axum_health::HealthStatus::Down)
                .with_detail("database".to_string(), e.to_string())
                .clone(),
        }
    }
}

pub struct ZitadelHealthIndicator {
    name: String,
    introspection_state: IntrospectionState,
}
impl ZitadelHealthIndicator {
    pub fn new(name: String, introspection_state: IntrospectionState) -> Self {
        ZitadelHealthIndicator {
            name,
            introspection_state,
        }
    }
}

#[async_trait]
impl HealthIndicator for ZitadelHealthIndicator {
    fn name(&self) -> String {
        self.name.to_owned()
    }

    async fn details(&self) -> HealthDetail {
        let res = match self.introspection_state.get_health().await {
            Ok(_) => HealthDetail::new(axum_health::HealthStatus::Up)
                .with_detail(
                    "introspection".to_string(),
                    "Zitadel introspection is healthy".to_string(),
                )
                .clone(),
            Err(e) => HealthDetail::new(axum_health::HealthStatus::Down)
                .with_detail("Zitadel connection failed".to_string(), e.to_string())
                .clone(),
        };

        res.clone()
    }
}
