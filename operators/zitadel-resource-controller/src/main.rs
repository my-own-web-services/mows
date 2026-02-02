use actix_web::{get, middleware, web::Data, App, HttpRequest, HttpResponse, HttpServer, Responder};
use mows_common_rust::{get_current_config_cloned, observability::init_observability};
use tracing::info;
use tracing_actix_web::TracingLogger;
use zitadel::api::zitadel::management::v1::GetIamRequest;
use zitadel_resource_controller::config::{config, ProviderMode};
use zitadel_resource_controller::provider::DockerProvider;
use zitadel_resource_controller::zitadel_client::ZitadelClient;
use zitadel_resource_controller::{self, ControllerWebServerSharedState};

#[get("/metrics")]
async fn metrics(c: Data<ControllerWebServerSharedState>, _req: HttpRequest) -> impl Responder {
    let metrics = c.metrics();
    HttpResponse::Ok()
        .content_type("application/openmetrics-text; version=1.0.0; charset=utf-8")
        .body(metrics)
}

#[get("/health")]
async fn health(_: HttpRequest) -> impl Responder {
    HttpResponse::Ok().json("healthy")
}

#[get("/")]
async fn index(c: Data<ControllerWebServerSharedState>, _req: HttpRequest) -> impl Responder {
    let d = c.diagnostics().await;
    HttpResponse::Ok().json(&d)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_observability().await;

    let cfg = get_current_config_cloned!(config());

    // Test Zitadel connection (shared by both providers)
    let mut zitadel_client = ZitadelClient::new().await?.management_client(None).await?;
    zitadel_client.get_iam(GetIamRequest {}).await?;
    info!("Zitadel connection successful");

    match cfg.provider_mode {
        ProviderMode::Kubernetes => {
            info!(
                "Starting in Kubernetes provider mode (detected via service account token at '{}')",
                cfg.service_account_token_path
            );

            let state = ControllerWebServerSharedState::default();
            let controller = zitadel_resource_controller::run(state.clone());

            let server = HttpServer::new(move || {
                App::new()
                    .app_data(Data::new(state.clone()))
                    .wrap(TracingLogger::default())
                    .wrap(middleware::Logger::default().exclude("/health"))
                    .service(index)
                    .service(health)
                    .service(metrics)
            })
            .bind("0.0.0.0:8080")?
            .shutdown_timeout(5);

            tokio::join!(controller, server.run()).1?;
        }
        ProviderMode::Docker => {
            info!(
                "Starting in Docker provider mode (detected via Docker socket at '{}')",
                cfg.docker_socket_path
            );

            let docker_provider = DockerProvider::new(
                &cfg.docker_socket_path,
                cfg.reconcile_interval_seconds,
                cfg.docker_label_prefix.clone(),
            )?;

            let server = HttpServer::new(move || {
                App::new()
                    .wrap(TracingLogger::default())
                    .wrap(middleware::Logger::default().exclude("/health"))
                    .service(health)
            })
            .bind("0.0.0.0:8080")?
            .shutdown_timeout(5);

            let docker_result = tokio::select! {
                result = docker_provider.run() => result,
                result = server.run() => {
                    result.map_err(|e| anyhow::anyhow!("Web server error: {}", e))?;
                    Ok(())
                }
            };

            docker_result?;
        }
    }

    Ok(())
}
