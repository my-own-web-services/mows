#![allow(unused_imports, unused_variables)]
use actix_web::{
    cookie::time::error, get, middleware, web::Data, App, HttpRequest, HttpResponse, HttpServer, Responder,
};
use anyhow::Context;
pub use controller::{self, ControllerState};
use mows_common_rust::observability::init_observability;
use tracing_actix_web::TracingLogger;

#[get("/metrics")]
async fn metrics(c: Data<ControllerState>, _req: HttpRequest) -> impl Responder {
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
async fn index(c: Data<ControllerState>, _req: HttpRequest) -> impl Responder {
    let d = c.diagnostics().await;
    HttpResponse::Ok().json(&d)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_observability().await;

    let state = ControllerState::new()
        .await
        .context("Failed to initialize controller state with vault client")?;
    let controller = controller::run(state.clone());

    // Start web server
    let server = HttpServer::new(move || {
        App::new()
            .wrap(TracingLogger::default())
            .app_data(Data::new(state.clone()))
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
