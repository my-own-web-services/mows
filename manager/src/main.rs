use anyhow::Context;
use axum::error_handling::HandleErrorLayer;
use axum::http::header::{CONTENT_TYPE, UPGRADE};
use axum::http::{HeaderValue, Method};
use axum::routing::{delete, get, post, put};
use axum::Router;
use bollard::Docker;
use manager::api::boot::*;
use manager::api::cluster::*;
use manager::api::config::*;
use manager::api::direct_terminal::*;
use manager::api::docker_terminal::*;
use manager::api::machines::*;
use manager::internal_config::{  INTERNAL_CONFIG};
use manager::{config::{self, *}};
use manager::tasks::{
    apply_environment, get_cluster_kubeconfig, install_cluster_basics, start_cluster_proxy,
    update_machine_install_state,
};
use manager::types::*;

use tracing_subscriber::fmt::time;
use tracing_subscriber::util::SubscriberInitExt;

use std::fs::read_to_string;
use std::net::{IpAddr, Ipv6Addr, SocketAddr};
use std::os::unix::fs::PermissionsExt;
use std::process::Stdio;
use std::str::FromStr;
use std::time::Duration;
use tokio::process::Command;
use tokio::{fs, signal};
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::{error, info, trace};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::Layer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
/*
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;
#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;
*/

#[tracing::instrument]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {

    #[derive(OpenApi)]
    #[openapi(
        paths(
            update_config,
            get_config,
            dev_create_machines,
            signal_machine,
            dev_create_cluster_from_all_machines_in_inventory,
            get_boot_config_by_mac,
            delete_machine,
            get_machine_info,
            get_machine_status,
            dev_delete_all_machines,
            docker_terminal,
            direct_terminal,
            dev_install_cluster_basics
        ),
        components(
            schemas(
                ApiResponseStatus,
                ApiResponse<()>,
                ManagerConfig,
                Cluster,
                ClusterNode,
                BackupNode,
                ExternalProviders,
                ExternalProvidersHetzner,
                PublicIpConfig,
                PublicIpConfigSingleIp,
                ExternalProviderIpOptions,
                ExternalProviderIpOptionsHetzner,
                SshAccess,
                MachineType,
                Machine,
                MachineCreationReqBody,
                LocalQemuConfig,
                ExternalHetznerConfig,
                ClusterCreationConfig,
                PixiecoreBootConfig,
                MachineInstallState,
                ClusterInstallState,
                MachineSignalReqBody,
                MachineSignal,
                MachineDeleteReqBody,
                MachineInfoReqBody,
                MachineInfoResBody,
                MachineStatus,
                
            )
        ),
        tags(
            (name = "cluster-manager", description = "Cluster management API")
        )
    )]
    struct ApiDoc;

    let ic = &INTERNAL_CONFIG;
    

    
    //let _ = Docker::connect_with_local_defaults();
    let console_layer = console_subscriber::ConsoleLayer::builder()
        .server_addr((Ipv6Addr::from_str("::")?, 6669))
        .spawn()
        .with_filter(tracing_subscriber::EnvFilter::new(
            "main=trace,manager=trace,tower_http=trace,axum::rejection=trace,tokio=trace,runtime=trace"
            ,
        ));

    let log_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        // axum logs rejections from built-in extractors with the `axum::rejection`
        // target, at `TRACE` level. `axum::rejection=trace` enables showing those events
        "main=debug,manager=debug,tower_http=trace,axum::rejection=trace,tokio=debug,runtime=debug"
            .into()
    });
    let log_layer = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .with_level(true)
        .with_timer(time::ChronoLocal::new("%H:%M:%S".to_string()))
        .with_file(true)
        .with_line_number(true)
        .with_filter(log_filter);
    /*
        let tracing_layer = tracing_opentelemetry::OpenTelemetryLayer::new(
            manager::tracing::init_tracer("http://jaeger:4317"),
        )
        .with_filter(tracing_subscriber::EnvFilter::new(
            "main=trace,manager=trace,tower_http=trace,axum::rejection=trace,tokio=trace,runtime=trace",
        ));
    */
    tracing_subscriber::registry()
        .with(console_layer)
        .with(log_layer)
        //.with(tracing_layer)
        .try_init()?;

    //Machine::delete_all_mows_machines().unwrap();

    let serve_dir = ServeDir::new("ui").not_found_service(ServeFile::new("ui/index.html"));




    info!("Starting pixiecore server");

    Command::new("pixiecore")
        .args(["api", "http://localhost:3000", "-l", &ic.own_addresses.legacy.to_string(), "--dhcp-no-bind"])
        .stdout(if ic.log.pixiecore.stdout { Stdio::inherit() } else { Stdio::null() })
        .stderr(if ic.log.pixiecore.stderr { Stdio::inherit() } else { Stdio::null() })
        .spawn()
        .context("Failed to start pixiecore server")?;




    info!("Starting dnsmasq server");

    // start dnsmasq: dnsmasq -a 192.168.112.3 --no-daemon --log-queries --dhcp-alternate-port=67 --dhcp-range=192.168.112.5,192.168.112.30,12h --domain-needed --bogus-priv --dhcp-authoritative

    let resolv_bak= fs::read_to_string("/etc/resolv.conf.bak").await?;

    let docker_server="nameserver 127.0.0.11";

    fs::write("/etc/resolv.dnsmasq.conf", format!(
        "{}\n{}",
        docker_server,
        resolv_bak

    )).await?;

    // the directory for the manually created dns entries
    tokio::fs::create_dir_all("/hosts").await?;

    let args=["--no-daemon",
    "--log-queries",
    "--dhcp-alternate-port=67",
    &format!("--dhcp-range={},{},{}",ic.dhcp.dhcp_range_start, ic.dhcp.dhcp_range_end, ic.dhcp.lease_time),
    "--domain-needed",
    "--bogus-priv",
    "--dhcp-authoritative",
    "--hostsdir","/hosts/", 
    "--resolv-file=/etc/resolv.dnsmasq.conf",
    "--dhcp-leasefile=/temp/dnsmasq/leases",
    ];

    tokio::fs::create_dir_all("/temp/dnsmasq").await?;
    // enable everyone to delete the folder
    tokio::fs::set_permissions("/temp/dnsmasq", std::fs::Permissions::from_mode(0o777)).await?;


   Command::new("dnsmasq")
    .args(args)
    .stdout(if ic.log.dnsmasq.stdout { Stdio::inherit() } else { Stdio::null() })
    .stderr(if ic.log.dnsmasq.stderr { Stdio::inherit() } else { Stdio::null() })    
    .spawn()
    .context("Failed to start the dnsmasq server")?;
   
    let mut origins = vec![&ic.primary_origin];

    if ic.dev.enabled {
        let _ =&ic.dev.allow_origins.iter().for_each(|x| origins.push(x));

    }

  


    let app = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/api/config", put(update_config))
        .route("/api/config", get(get_config))
        .route("/api/dev/machines/create", post(dev_create_machines))
        .route("/api/machines/signal", post(signal_machine))
        .route("/api/machines/delete", delete(delete_machine))
        .route("/api/machines/info", post(get_machine_info))
        .route("/api/machines/status", get(get_machine_status))
        .route(
            "/api/dev/machines/delete_all",
            delete(dev_delete_all_machines),
        )
        .route(
            "/api/dev/cluster/create_from_all_machines_in_inventory",
            post(dev_create_cluster_from_all_machines_in_inventory),
        )
        .route(
            "/api/dev/cluster/install_basics",
            post(dev_install_cluster_basics),
        )
        .route("/api/terminal/direct/:id", get(direct_terminal))
        .route("/api/terminal/docker/:id", get(docker_terminal))
        .route("/v1/boot/:mac_addr", get(get_boot_config_by_mac))
        .nest_service("/", serve_dir)
        .layer(
            CorsLayer::new()
                .allow_origin(origins.iter().map(|x| 
                    HeaderValue::from_str(x.origin().ascii_serialization().as_str()).unwrap()
                ).collect::<Vec<HeaderValue>>())
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([CONTENT_TYPE, UPGRADE]),
        );



    info!("Open {} in your browser", ic.primary_origin);

    info!("Starting background tasks");
    // these are separated for easier debugging
    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = update_machine_install_state().await {
                trace!("Could not update machine install state: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = apply_environment().await {
                trace!("Failed to apply environment: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = get_cluster_kubeconfig().await {
                trace!("Could not get cluster config: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = install_cluster_basics().await {
                error!("Could not install cluster basics: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        let mut proxy_running_for_cluster:Option<String> = None;
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;

            if let Some(cluster_id) = &proxy_running_for_cluster{
                // the proxy is running... check if the cluster still exists else stop the proxy and allow the next iteration to start a new proxy
                let cfg1 = config::config().read().await.clone();
                if cfg1.clusters.get(&cluster_id.clone()).is_none(){
                    if let Err(e)=Cluster::stop_proxy().await{
                        error!("Could not stop cluster proxy: {:?}", e);
                    }
                    proxy_running_for_cluster = None;
                }else{
                continue;
                }
            };

            match start_cluster_proxy().await {
                Ok(cluster_id) => {
                    proxy_running_for_cluster = cluster_id;
                }
                Err(e) => {
                    error!("Could not start cluster proxy: {:?}", e);
                }
            };
        }
    });

    info!("Starting server");

    let listener = tokio::net::TcpListener::bind(
        SocketAddr::new("::".parse()?,3000),
    ).await?;

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await.context(
        "Failed to start server",
    
    )?;

    Ok(())
}

async fn shutdown_signal() {
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
