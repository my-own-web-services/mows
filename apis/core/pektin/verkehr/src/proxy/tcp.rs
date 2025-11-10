use std::{net::SocketAddr, sync::Arc};

use tokio::{
    net::{TcpListener, TcpStream},
    sync::RwLock,
    try_join,
};

use crate::{
    config::rules::check::tcp::check_tcp_rule,
    config::routing_config::{RoutingConfig, TcpMiddleware, TcpRouter, TcpService},
    some_or_bail,
    utils::parse_addr,
};
use tracing::{debug, error, info, warn};

pub async fn create_tcp_server(
    listen_addr: &str,
    tls: bool,
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &str,
) -> anyhow::Result<()> {
    let addr = parse_addr(listen_addr)?;
    if tls {
        warn!(
            entrypoint = %entrypoint_name,
            listen_addr = %listen_addr,
            "TLS support for TCP proxy not yet implemented"
        );
        Ok(())
    } else {
        let proxy_server = TcpListener::bind(addr).await?;
        info!(
            entrypoint = %entrypoint_name,
            listen_addr = %listen_addr,
            "TCP proxy server started"
        );

        while let Ok((client, client_addr)) = proxy_server.accept().await {
            debug!(
                entrypoint = %entrypoint_name,
                client_addr = %client_addr,
                "accepted TCP connection"
            );
            let entrypoint_name = entrypoint_name.to_string();
            let config = config.clone();
            tokio::spawn(async move {
                let entrypoint_name = entrypoint_name.to_string();
                if let Err(e) = proxy(client, config, &entrypoint_name).await {
                    error!(
                        entrypoint = %entrypoint_name,
                        error = %e,
                        "TCP proxy error"
                    );
                }
            });
        }
        Ok(())
    }
}

async fn proxy(
    client_conn: TcpStream,
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &str,
) -> anyhow::Result<()> {
    let client_addr = client_conn.peer_addr()?;
    route_or_abort(client_conn, config, entrypoint_name, client_addr).await
}

async fn route_or_abort(
    mut client_conn: TcpStream,
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &str,
    client_addr: SocketAddr,
) -> anyhow::Result<()> {
    let (router_to_use, service_to_use, _middlewares_to_use) =
        decide_routing(config, entrypoint_name, client_addr, &client_conn).await?;

    let lb = some_or_bail!(
        &service_to_use.loadbalancer,
        format!(
            "Missing loadbalancer for service: {}",
            router_to_use.service
        )
    );

    let backend_addr = &lb.servers[0].address;
    debug!(
        client_addr = %client_addr,
        backend_addr = %backend_addr,
        service = %router_to_use.service,
        "routing TCP connection"
    );

    let mut main_server_conn = TcpStream::connect(backend_addr).await?;
    let (mut client_recv, mut client_send) = client_conn.split();
    let (mut server_recv, mut server_send) = main_server_conn.split();

    let handle_one = async { tokio::io::copy(&mut server_recv, &mut client_send).await };

    let handle_two = async { tokio::io::copy(&mut client_recv, &mut server_send).await };

    let (from_server, from_client) = try_join!(handle_one, handle_two)?;

    debug!(
        client_addr = %client_addr,
        backend_addr = %backend_addr,
        from_client = %from_client,
        from_server = %from_server,
        "TCP connection closed"
    );

    Ok(())
}

async fn decide_routing(
    config: Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &str,
    client_addr: SocketAddr,
    client_conn: &TcpStream,
) -> anyhow::Result<(TcpRouter, TcpService, Vec<TcpMiddleware>)> {
    let tcp = some_or_bail!(&config.read().await.tcp, "no http section in config").clone();
    let routers = some_or_bail!(&tcp.routers, "No router available to decide routing").clone();

    //filter out the routers for the current entrypoint
    let mut maybe_selected_router: Option<(String, TcpRouter)> = None;
    for (cr_name, cr) in routers {
        // cr is the current router
        let rule_ok = matches!(
            check_tcp_rule(client_conn, &cr.rule.rule, client_addr),
            Ok(true)
        );
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

    let (selected_router_name, selected_router) = some_or_bail!(
        maybe_selected_router,
        "no router found for entrypoint {entrypoint_name}"
    );

    debug!(
        entrypoint = %entrypoint_name,
        router = %selected_router_name,
        service = %selected_router.service,
        client_addr = %client_addr,
        "selected TCP router"
    );

    let mut middleware_to_use: Vec<TcpMiddleware> = vec![];
    #[allow(unreachable_code)]
    if let Some(middleware_strings) = &selected_router.middlewares {
        if let Some(defined_middlewares) = &tcp.middlewares {
            for middleware_str in middleware_strings {
                if let Some(m) = defined_middlewares.get(middleware_str) {
                    middleware_to_use.push(m.clone());
                }
            }
        }
    }
    let services = some_or_bail!(&tcp.services, "No service available to decide routing");
    let service = some_or_bail!(
        services.get(&selected_router.service),
        "No service available to decide routing"
    );

    Ok((selected_router.clone(), service.clone(), middleware_to_use))
}
