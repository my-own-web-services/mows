use anyhow::bail;
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinSet;
use verkehr::{
    api::create_api, config::load_verkehr_config, http::create_http_server,
    proxy_tcp::create_tcp_server, routing_config::load_routing_config, some_or_bail,
};

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _common_config = get_current_config_cloned!(common_config(true));
    init_observability().await;

    tracing::info!("Starting Verkehr proxy");

    let verkehr_config = match load_verkehr_config("/config.yml") {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Couldn't find verkehr config at /config.yml: {e} trying dev path...");
            match load_verkehr_config("./tests/config/file/verkehr.yml") {
                Ok(c) => c,
                Err(e) => bail!("Could not load verkehr config: {}", e),
            }
        }
    };

    let api_verkehr_config = verkehr_config.clone();
    let api_enabled = api_verkehr_config.api.enabled;

    let routing_config = Arc::new(RwLock::new(load_routing_config(&verkehr_config).await?));

    let cfg = routing_config.read().await.clone();
    tracing::debug!(
        config = %serde_json::to_string(&cfg).unwrap(),
        "loaded routing config"
    );

    let t_config = routing_config.clone();

    let (restart_tx, mut restart_rx) = tokio::sync::mpsc::channel::<()>(1);
    tokio::spawn(async move {
        // restarting the entrypoints every thirty days should update the certificates
        // TODO this may be improved but reloading certificates is not possible (for me because of mutability and async issues)
        let thirty_days = 30 * 24 * 60 * 60;
        let config_reload_time = 5;
        let mut waited = 0;
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(config_reload_time)).await;
            waited += config_reload_time;
            {
                let mut c = t_config.write().await;
                let new_config = match load_routing_config(&verkehr_config).await {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::error!(error = %e, "Could not load routing config");
                        continue;
                    }
                };

                if some_or_bail!(&new_config.http, "no http section found in config").entrypoints
                    != some_or_bail!(&c.http, "no http section found in config").entrypoints
                    || waited >= thirty_days
                {
                    waited = 0;
                    restart_tx.send(()).await.unwrap();
                }
                *c = new_config;
            }
        }
        #[allow(unreachable_code)]
        // this is needed for the compiler to infer the return type of this async block
        Ok(())
    });

    loop {
        let mut server_handles = JoinSet::new();

        {
            let ht = &routing_config.read().await.http;
            let http = some_or_bail!(ht, "no http section found in config");
            let entrypoints =
                some_or_bail!(&http.entrypoints, "no entrypoints found in config.http");

            for entrypoint in entrypoints {
                let handle = create_http_server(
                    entrypoint.1.address.clone(),
                    entrypoint.1.cert_resolver.is_some(),
                    routing_config.clone(),
                    entrypoint.0.clone(),
                )
                .await?;
                server_handles.spawn(async { handle.await });
            }
            // Start TCP entrypoints
            if let Some(tcp) = &routing_config.read().await.tcp {
                if let Some(entrypoints) = &tcp.entrypoints {
                    for (entrypoint_name, entrypoint_config) in entrypoints {
                        let config_clone = routing_config.clone();
                        let address = entrypoint_config.address.clone();
                        let has_cert = entrypoint_config.cert_resolver.is_some();
                        let name = entrypoint_name.clone();

                        server_handles.spawn(async move {
                            if let Err(e) =
                                create_tcp_server(&address, has_cert, config_clone, &name).await
                            {
                                tracing::error!(
                                    entrypoint = %name,
                                    error = %e,
                                    "TCP server failed"
                                );
                            }
                            Ok(())
                        });
                    }
                }
            }

            if api_enabled {
                let api_handle = create_api(
                    Arc::new(RwLock::new(api_verkehr_config.clone())),
                    routing_config.clone(),
                )
                .await?;
                server_handles.spawn(async { api_handle.await });
            }
        }

        restart_rx.recv().await;
        tracing::info!("Restarting due to changed entrypoints or certs");
        server_handles.shutdown().await;
    }
}
