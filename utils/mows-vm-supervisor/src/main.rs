use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use mows_vm_supervisor::api;
use mows_vm_supervisor::config::SupervisorConfig;
use mows_vm_supervisor::db;
use mows_vm_supervisor::error::Result;
use mows_vm_supervisor::ssh_keys;
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
        let cfg = SupervisorConfig::defaults_for_tests();
        println!("{}", serde_yaml_neo::to_string(&cfg)?);
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

    let host_keypair = ssh_keys::ensure_host_keypair(&config.state_dir).await?;
    tracing::info!(
        pubkey = %host_keypair.public_key,
        "host ssh keypair ready"
    );

    let state = Arc::new(AppState::new(config.clone(), pool, host_keypair));

    api::serve(state).await
}
