#![allow(unused_imports, unused_variables)]
use crate::controller::config::config;
use actix_web::{get, middleware, web::Data, App, HttpRequest, HttpResponse, HttpServer, Responder};
use anyhow::Context;
use controller::utils::create_zitadel_management_client;
pub use controller::{self, State};
use mows_common::{get_current_config_cloned, observability::init_observability};
use prometheus_client::metrics::info;
use tracing::info;
use tracing_actix_web::TracingLogger;
use zitadel::api::zitadel::management::v1::{GetIamRequest, GetMyOrgRequest};
#[get("/metrics")]
async fn metrics(c: Data<State>, _req: HttpRequest) -> impl Responder {
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
async fn index(c: Data<State>, _req: HttpRequest) -> impl Responder {
    let d = c.diagnostics().await;
    HttpResponse::Ok().json(&d)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_observability().await;

    // Initialize Kubernetes controller state
    let state = State::default();
    let controller = controller::run(state.clone());

    let mut zitadel_client = create_zitadel_management_client().await?;

    zitadel_client.get_iam(GetIamRequest {}).await?;

    info!("Zitadel connection successful");

    // Start web server
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

    // Both runtimes implements graceful shutdown, so poll until both are done
    tokio::join!(controller, server.run()).1?;
    Ok(())
}
