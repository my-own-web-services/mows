use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use mows_vm_supervisor::api;
use mows_vm_supervisor::config::SupervisorConfig;
use mows_vm_supervisor::db;
use mows_vm_supervisor::error::Result;
use mows_vm_supervisor::state::AppState;
use tracing_subscriber::EnvFilter;

#[derive(Parser, Debug)]
#[command(name = "mows-vm-supervisor")]
#[command(about = "Runs AI coding agents in QEMU VMs", long_about = None)]
struct Cli {
    /// Path to the YAML config file.
    #[arg(
        long,
        env = "MOWS_VM_SUPERVISOR_CONFIG",
        default_value = "/etc/mows-vm-supervisor/config.yaml"
    )]
    config: PathBuf,

    /// Print a default config to stdout and exit.
    #[arg(long)]
    print_default_config: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if cli.print_default_config {
        // SLOP-39: use the production-safe constructor so the YAML an
        // operator pipes into a real config file points at
        // `/var/lib/mows-agent`, not the test sandbox.
        let config = SupervisorConfig::defaults_for_user();
        println!("{}", serde_yaml_neo::to_string(&config)?);
        return Ok(());
    }

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_target(false)
        .compact()
        .init();

    tracing::info!(config = %cli.config.display(), "starting mows-vm-supervisor");

    let config = SupervisorConfig::load(&cli.config)?;
    std::fs::create_dir_all(&config.state_dir)?;
    std::fs::create_dir_all(&config.image_dir)?;

    let pool = db::open(&config.state_dir).await?;
    db::migrate(&pool).await?;

    // Recover port allocator state from the DB so a supervisor restart
    // doesn't hand out ports already bound by surviving QEMU processes
    // from the previous run.
    let live_ports: Vec<u16> = sqlx::query_as::<_, (Option<i64>, Option<i64>)>(
        "SELECT host_ssh_port, host_docker_port FROM vms \
         WHERE status NOT IN ('stopped', 'failed')",
    )
    .fetch_all(&pool)
    .await?
    .into_iter()
    .flat_map(|(ssh, docker)| {
        [ssh, docker]
            .into_iter()
            .filter_map(|p| p.and_then(|v| u16::try_from(v).ok()))
            .collect::<Vec<_>>()
    })
    .collect();
    if !live_ports.is_empty() {
        tracing::info!(
            count = live_ports.len(),
            "restored port reservations from previous supervisor run"
        );
    }

    let state = Arc::new(AppState::with_port_reservations(
        config.clone(),
        pool,
        live_ports,
    ));

    api::serve(state).await
}
