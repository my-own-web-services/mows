use crate::certificates::get_http_cert_resolver;
use crate::config::routing_config::{HttpMiddleware, HttpRouter, HttpService, RoutingConfig};
use crate::config::rules::check::http::check_http_rule;
use crate::middleware::http::{
    handle_middleware_incoming, handle_middleware_outgoing, requires_body_buffering,
    MiddlewareError,
};
use crate::routing_cache::RoutingCache;
use crate::some_or_bail;
use crate::utils::{get_host_from_uri_or_header, host_addr, parse_addr, tunnel};
use anyhow::bail;
use http::uri::Parts;
use http::HeaderValue;
use http_body_util::{combinators::BoxBody, BodyExt, Empty, Full};
use hyper::body::{Bytes, Incoming};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::rt::TokioExecutor;
use hyper_util::rt::TokioIo;
use std::convert::Infallible;
use std::future::Future;
use std::net::SocketAddr;
use std::pin::Pin;
use std::str::FromStr;
use std::sync::Arc;
use std::vec;
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

pub async fn create_http_server(
    listen_addr: String,
    tls: bool,
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: String,
    routing_cache: Arc<RoutingCache>,
) -> anyhow::Result<Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>>> {
    info!(entrypoint = %entrypoint_name, "creating HTTP server");

    let addr = parse_addr(&listen_addr)?;
    let http_addr = SocketAddr::from_str(&addr)?;

    // Use webpki-roots (embedded Mozilla CA certificates) for consistency across all environments
    let https_connector = HttpsConnectorBuilder::new()
        .with_webpki_roots()
        .https_or_http()
        .enable_http1()
        .build();

    let client = Client::builder(TokioExecutor::new()).build::<_, Incoming>(https_connector);

    if tls {
        let tls_cfg = {
            let resolver = get_http_cert_resolver(&config, &entrypoint_name).await?;

            let mut cfg = rustls::ServerConfig::builder()
                .with_no_client_auth()
                .with_cert_resolver(resolver);
            cfg.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
            std::sync::Arc::new(cfg)
        };

        let listener = TcpListener::bind(&http_addr).await?;
        let entrypoint_name_clone = entrypoint_name.clone();

        let fut = async move {
            let tls_acceptor = tokio_rustls::TlsAcceptor::from(tls_cfg);

            loop {
                let (tcp_stream, client_addr) = match listener.accept().await {
                    Ok(conn) => conn,
                    Err(e) => {
                        error!(error = %e, "failed to accept connection");
                        continue;
                    }
                };

                let tls_stream = match tls_acceptor.accept(tcp_stream).await {
                    Ok(s) => s,
                    Err(e) => {
                        error!(error = %e, "TLS handshake failed");
                        continue;
                    }
                };

                let io = TokioIo::new(tls_stream);
                let client_clone = client.clone();
                let config_clone = Arc::clone(&config);
                let cache_clone = Arc::clone(&routing_cache);
                let entrypoint_clone = entrypoint_name_clone.clone();

                tokio::spawn(async move {
                    let service = service_fn(move |req| {
                        proxy(
                            client_clone.clone(),
                            req,
                            Arc::clone(&config_clone),
                            entrypoint_clone.clone(),
                            client_addr,
                            Arc::clone(&cache_clone),
                        )
                    });

                    if let Err(e) = http1::Builder::new()
                        .preserve_header_case(true)
                        .title_case_headers(true)
                        .serve_connection(io, service)
                        .with_upgrades()
                        .await
                    {
                        error!(error = %e, "error serving connection");
                    }
                });
            }
        };

        Ok(Box::pin(async move { Ok(fut.await) }))
    } else {
        let listener = TcpListener::bind(&http_addr).await?;
        let entrypoint_name_clone = entrypoint_name.clone();

        let fut = async move {
            loop {
                let (tcp_stream, client_addr) = match listener.accept().await {
                    Ok(conn) => conn,
                    Err(e) => {
                        error!(error = %e, "failed to accept connection");
                        continue;
                    }
                };

                let io = TokioIo::new(tcp_stream);
                let client_clone = client.clone();
                let config_clone = Arc::clone(&config);
                let cache_clone = Arc::clone(&routing_cache);
                let entrypoint_clone = entrypoint_name_clone.clone();

                tokio::spawn(async move {
                    let service = service_fn(move |req| {
                        proxy(
                            client_clone.clone(),
                            req,
                            Arc::clone(&config_clone),
                            entrypoint_clone.clone(),
                            client_addr,
                            Arc::clone(&cache_clone),
                        )
                    });

                    if let Err(e) = http1::Builder::new()
                        .preserve_header_case(true)
                        .title_case_headers(true)
                        .serve_connection(io, service)
                        .with_upgrades()
                        .await
                    {
                        error!(error = %e, "error serving connection");
                    }
                });
            }
        };

        Ok(Box::pin(async move { Ok(fut.await) }))
    }
}

async fn proxy(
    client: Client<HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>, Incoming>,
    req: Request<Incoming>,
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: String,
    client_addr: SocketAddr,
    routing_cache: Arc<RoutingCache>,
) -> Result<Response<BoxBody<Bytes, std::convert::Infallible>>, Infallible> {
    match route_or_internal_error(
        client,
        req,
        config,
        &entrypoint_name,
        client_addr,
        routing_cache,
    )
    .await
    {
        Ok(response) => Ok(response),
        Err(e) => {
            error!(error = %e, "internal server error");
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

pub async fn route_or_internal_error(
    client: Client<HttpsConnector<hyper_util::client::legacy::connect::HttpConnector>, Incoming>,
    mut req: Request<Incoming>,
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &str,
    client_addr: SocketAddr,
    routing_cache: Arc<RoutingCache>,
) -> anyhow::Result<Response<BoxBody<Bytes, std::convert::Infallible>>> {
    // Check cache version and invalidate if needed (lock-free fast path)
    routing_cache.check_version(config.clone()).await;

    // Try to get cached routing decision (lock-free)
    let (_router_to_use, service_to_use, middlewares_to_use) =
        match routing_cache.get(&req, entrypoint_name, client_addr) {
            Some(entry) => {
                // Cache hit - use cached routing decision (cheap Arc clone)
                (entry.router, entry.service, entry.middlewares)
            }
            None => {
                // Cache miss - compute routing decision
                match decide_routing(config.clone(), entrypoint_name, &req, client_addr).await {
                    Ok(result) => {
                        // Store in cache for future requests (lock-free)
                        routing_cache.insert(
                            &req,
                            entrypoint_name,
                            client_addr,
                            crate::routing_cache::RoutingCacheEntry {
                                router: Arc::new(result.0.clone()),
                                service: result.1.clone().map(Arc::new),
                                middlewares: Arc::new(result.2.clone()),
                            },
                        );
                        (
                            Arc::new(result.0),
                            result.1.map(Arc::new),
                            Arc::new(result.2),
                        )
                    }
                    Err(e) => {
                        warn!(error = %e, "no router found");
                        // TODO  http1 connections can currently match no routers
                        return Ok(Response::builder()
                            .status(404)
                            .body(
                                Full::new(Bytes::from("Not found"))
                                    .map_err(|never| match never {})
                                    .boxed(),
                            )
                            .unwrap());
                    }
                }
            }
        };

    if Method::CONNECT == req.method() {
        if let Some(addr) = host_addr(req.uri()) {
            tokio::task::spawn(async move {
                match hyper::upgrade::on(req).await {
                    Ok(upgraded) => {
                        if let Err(e) = tunnel(upgraded, addr).await {
                            error!(error = %e, "tunnel IO error");
                        };
                    }
                    Err(e) => error!(error = %e, "upgrade error"),
                }
            });

            Ok(Response::new(
                Empty::new().map_err(|never| match never {}).boxed(),
            ))
        } else {
            error!(uri = ?req.uri(), "CONNECT host is not socket addr");
            let mut resp = Response::new(
                Full::new(Bytes::from("CONNECT must be to a socket address"))
                    .map_err(|never| match never {})
                    .boxed(),
            );
            *resp.status_mut() = http::StatusCode::BAD_REQUEST;

            Ok(resp)
        }
    } else {
        match handle_middleware_incoming(&mut req, middlewares_to_use.as_ref().clone()).await {
            Ok(req) => req,
            Err(e) => match e {
                MiddlewareError::Default { res } => return Ok(res),
            },
        };

        let mut res_builder_cors = Response::builder();

        if !middlewares_to_use.is_empty() {
            for (i, middleware) in middlewares_to_use.as_ref().iter().enumerate() {
                #[allow(clippy::single_match)]
                match middleware {
                    HttpMiddleware::Cors(args) => {
                        if req.method() == hyper::Method::OPTIONS {
                            return Ok(Response::builder()
                                .status(200)
                                .header("Access-Control-Allow-Origin", args.origin.clone())
                                .header("Access-Control-Allow-Methods", args.methods.clone())
                                .header("Access-Control-Allow-Headers", args.headers.clone())
                                .header("Access-Control-Max-Age", args.age.clone())
                                .body(Empty::new().map_err(|never| match never {}).boxed())
                                .unwrap());
                        } else if i == 0 {
                            res_builder_cors = res_builder_cors
                                .header("Access-Control-Allow-Origin", args.origin.clone())
                                .header("Access-Control-Allow-Methods", args.methods.clone())
                                .header("Access-Control-Allow-Headers", args.headers.clone())
                                .header("Access-Control-Max-Age", args.age.clone());
                        }
                    }
                    _ => {}
                }
            }
        }

        let service_url = match &service_to_use {
            Some(service) => service
                .as_ref()
                .loadbalancer
                .as_ref()
                .map(|lb| &lb.servers[0].url),
            None => None,
        };

        let service_url = match service_url {
            Some(s) => s,
            None => {
                // when the service url cannot be found we try to find a middleware that returns a redirect request
                if !middlewares_to_use.is_empty() {
                    for middleware in middlewares_to_use.as_ref().iter() {
                        #[allow(clippy::single_match)]
                        match middleware {
                            HttpMiddleware::RedirectScheme(args) => {
                                let host = get_host_from_uri_or_header(&req)?;
                                let path = match req.uri().path_and_query() {
                                    Some(path) => path.as_str(),
                                    None => "/",
                                };

                                return Ok(res_builder_cors
                                    .status(if let Some(perm) = args.permanent {
                                        if perm {
                                            301
                                        } else {
                                            302
                                        }
                                    } else {
                                        302
                                    })
                                    .header(
                                        "Location",
                                        format!("{}://{}{}", args.scheme, host, path),
                                    )
                                    .body(Empty::new().map_err(|never| match never {}).boxed())
                                    .unwrap());
                            }
                            _ => {}
                        }
                    }
                }
                // if no middleware is found and the service url is not present we need to abort the request
                bail!("no loadbalancer found")
            }
        };

        let service_uri_parsed = http::Uri::from_str(service_url)?;

        let mut parts = Parts::default();
        parts.scheme = Some(
            some_or_bail!(
                service_uri_parsed.scheme_str(),
                "Missing scheme in service uri: {service_uri_parsed}"
            )
            .parse()?,
        );
        parts.authority = service_uri_parsed.authority().cloned();
        parts.path_and_query = req.uri().path_and_query().cloned();

        let uri = http::Uri::from_parts(parts)?;

        let _host = some_or_bail!(uri.host(), format!("Missing host in uri: {}", service_url));
        let client_ip = client_addr.ip();

        // add the forwarded for header
        let x_forwarded_for = req.headers_mut().get("X-Forwarded-For");
        if let Some(xff) = x_forwarded_for {
            let xff = xff.to_str()?;
            let xff = format!("{}, {}", client_ip, xff);
            req.headers_mut().remove("X-Forwarded-For");
            req.headers_mut().insert("X-Forwarded-For", xff.parse()?);
        } else {
            req.headers_mut().remove("X-Forwarded-For");
            req.headers_mut().append(
                "X-Forwarded-For",
                HeaderValue::from_str(&client_ip.to_string())?,
            );
        }

        // add the real ip header
        req.headers_mut()
            .append("X-Real-IP", HeaderValue::from_str(&client_ip.to_string())?);

        /*
                req.headers_mut().remove("Host");
                req.headers_mut()
                    .append("Host", HeaderValue::from_str(host).unwrap());
        */
        *req.uri_mut() = uri;
        *req.version_mut() = http::Version::HTTP_11;
        //dbg!(&req);

        let res = match client.request(req).await {
            Ok(resp) => resp,
            Err(e) => {
                error!(error = %e, "backend request failed");
                return Ok(res_builder_cors
                    .status(502)
                    .body(
                        Full::new(Bytes::from("Bad Gateway"))
                            .map_err(|never| match never {})
                            .boxed(),
                    )
                    .unwrap());
            }
        };

        // TODO: Implement streaming for better performance
        // For now, buffer all responses to ensure stability
        // Streaming can be added later with proper error handling
        let (parts, body) = res.into_parts();
        let body_bytes = match body.collect().await {
            Ok(collected) => collected.to_bytes(),
            Err(e) => {
                error!(error = %e, "failed to collect response body");
                return Ok(res_builder_cors
                    .status(502)
                    .body(
                        Full::new(Bytes::from("Failed to read backend response"))
                            .map_err(|never| match never {})
                            .boxed(),
                    )
                    .unwrap());
            }
        };
        let boxed_body = Full::new(body_bytes)
            .map_err(|never| match never {})
            .boxed();
        let mut res = Response::from_parts(parts, boxed_body);

        match handle_middleware_outgoing(&mut res, middlewares_to_use.as_ref().clone()).await {
            Ok(resp) => resp,
            Err(e) => match e {
                MiddlewareError::Default { res } => return Ok(res),
            },
        };
        Ok(res)
    }
}

pub async fn decide_routing<'a>(
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &'a str,
    req: &Request<Incoming>,
    client_addr: SocketAddr,
) -> anyhow::Result<(HttpRouter, Option<HttpService>, Vec<HttpMiddleware>)> {
    let http = some_or_bail!(&config.read().await.http, "no http section in config").clone();
    let routers = some_or_bail!(&http.routers, "No router available to decide routing").clone();

    //filter out the routers for the current entrypoint
    let mut maybe_selected_router: Option<(String, HttpRouter)> = None;
    for (cr_name, cr) in routers {
        // cr is the current router
        let rule_ok = matches!(check_http_rule(req, &cr.rule.rule, client_addr), Ok(true));

        if cr.entrypoints.contains(&entrypoint_name.to_string()) && rule_ok {
            match maybe_selected_router {
                Some((sr_name, sr)) => {
                    let cr_prio = cr.priority.unwrap_or(0);
                    let sr_prio = sr.priority.unwrap_or(0);
                    if cr_prio == 0 && sr_prio == 0 {
                        if cr.rule.len > sr.rule.len {
                            maybe_selected_router = Some((cr_name, cr));
                        } else {
                            maybe_selected_router = Some((sr_name, sr));
                        }
                    } else if cr_prio > sr_prio {
                        maybe_selected_router = Some((cr_name, cr));
                    } else {
                        maybe_selected_router = Some((sr_name, sr));
                    }
                }
                None => {
                    maybe_selected_router = Some((cr_name, cr));
                }
            }
        }
    }

    let (_selected_router_name, selected_router) = some_or_bail!(
        maybe_selected_router,
        "no router found for entrypoint {entrypoint_name}"
    );

    let mut middleware_to_use: Vec<HttpMiddleware> = vec![];

    if let Some(middleware_strings) = &selected_router.middlewares {
        if let Some(defined_middlewares) = &http.middlewares {
            for middleware_str in middleware_strings {
                if let Some(m) = defined_middlewares.get(middleware_str) {
                    middleware_to_use.push(m.clone());
                }
            }
        }
    }
    let services = some_or_bail!(&http.services, "No service available to decide routing");
    let service = services.get(&selected_router.service).cloned();

    Ok((selected_router, service, middleware_to_use))
}
