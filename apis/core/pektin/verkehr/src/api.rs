use crate::{config::VerkehrConfig, routing_config::RoutingConfig};
use anyhow::bail;
use futures_util::Future;
use http::{Request, Response};
use http_body_util::{combinators::BoxBody, BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper_util::rt::TokioIo;
// use include_dir::{include_dir, Dir};
use std::sync::Arc;
use std::{convert::Infallible, net::SocketAddr, pin::Pin, str::FromStr};
use tokio::net::TcpListener;
use tokio::sync::RwLock;

// TODO: Enable when ui-build directory exists
// static UI_ROOT: Dir = include_dir!("ui-build");

pub async fn create_api(
    verkehr_config: Arc<RwLock<VerkehrConfig>>,
    routing_config: Arc<RwLock<RoutingConfig>>,
) -> anyhow::Result<Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>>> {
    let http_addr = SocketAddr::from_str("[::]:1337")?;
    let listener = TcpListener::bind(&http_addr).await?;

    let fut = async move {
        loop {
            let (tcp_stream, client_addr) = match listener.accept().await {
                Ok(conn) => conn,
                Err(e) => {
                    tracing::error!(error = %e, "failed to accept API connection");
                    continue;
                }
            };

            let io = TokioIo::new(tcp_stream);
            let verkehr_config_clone = Arc::clone(&verkehr_config);
            let routing_config_clone = Arc::clone(&routing_config);

            tokio::spawn(async move {
                let service = service_fn(move |req| {
                    handle_api_or_ui(
                        req,
                        Arc::clone(&verkehr_config_clone),
                        Arc::clone(&routing_config_clone),
                        client_addr,
                    )
                });

                if let Err(e) = http1::Builder::new().serve_connection(io, service).await {
                    tracing::error!(error = %e, "error serving API connection");
                }
            });
        }
    };

    Ok(Box::pin(async move { Ok(fut.await) }))
}

pub async fn handle_api_or_ui(
    req: Request<Incoming>,
    verkehr_config: Arc<RwLock<VerkehrConfig>>,
    routing_config: Arc<RwLock<RoutingConfig>>,

    client_addr: SocketAddr,
) -> Result<Response<BoxBody<Bytes, std::convert::Infallible>>, Infallible> {
    match api_or_ui_inner(req, verkehr_config, routing_config, client_addr).await {
        Ok(r) => Ok(r),
        Err(e) => {
            tracing::error!(error = %e, "internal server error in API");
            Ok(Response::builder()
                .status(500)
                .body(
                    Full::new(Bytes::from(format!("Internal Server Error: {}", e)))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap())
        }
    }
}

pub async fn api_or_ui_inner(
    req: Request<Incoming>,
    verkehr_config: Arc<RwLock<VerkehrConfig>>,
    routing_config: Arc<RwLock<RoutingConfig>>,
    client_addr: SocketAddr,
) -> anyhow::Result<Response<BoxBody<Bytes, std::convert::Infallible>>> {
    let path = req.uri().path();

    if path.starts_with("/api/") {
        handle_api(req, verkehr_config, routing_config, client_addr).await
    } else if verkehr_config.read().await.api.dashboard {
        handle_ui(req, verkehr_config, routing_config, client_addr).await
    } else {
        bail!("UI is disabled")
    }
}

pub async fn handle_api(
    _req: Request<Incoming>,
    _verkehr_config: Arc<RwLock<VerkehrConfig>>,
    _routing_config: Arc<RwLock<RoutingConfig>>,
    _client_addr: SocketAddr,
) -> anyhow::Result<Response<BoxBody<Bytes, std::convert::Infallible>>> {
    Ok(Response::new(
        Full::new(Bytes::from("API!"))
            .map_err(|never| match never {})
            .boxed(),
    ))
}

pub async fn handle_ui(
    _req: Request<Incoming>,
    _verkehr_config: Arc<RwLock<VerkehrConfig>>,
    _routing_config: Arc<RwLock<RoutingConfig>>,
    _client_addr: SocketAddr,
) -> anyhow::Result<Response<BoxBody<Bytes, std::convert::Infallible>>> {
    // TODO: Implement UI serving when ui-build directory exists
    Ok(Response::builder()
        .status(503)
        .body(
            Full::new(Bytes::from("UI not available"))
                .map_err(|never| match never {})
                .boxed(),
        )
        .unwrap())
}
