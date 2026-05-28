use std::path::PathBuf;
use std::sync::Arc;

use clap::Parser;
use mows_vm_supervisor::api;
use mows_vm_supervisor::config::SupervisorConfig;
use mows_vm_supervisor::db;
use mows_vm_supervisor::error::Result;
use mows_vm_supervisor::events::SupervisorEvent;
use mows_vm_supervisor::recovery;
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

    // Reconcile VMs the previous supervisor run thought were alive.
    // On container restart the PID namespace is fresh and every QEMU
    // child is gone; on in-process restart the QEMU may linger but we
    // no longer hold a `Child` handle to it. Both cases flip the row
    // to `failed` here so the UI doesn't show a "running" VM whose SSH
    // port is dead. Runs BEFORE the port-reservation query below so
    // failed VMs' ports are not re-reserved (the query filters out
    // `failed`); `failed_vm_ids` carries the affected rows forward
    // for event emission once the event bus is up.
    let reconcile = recovery::reconcile_orphans(&pool, chrono::Utc::now(), None).await?;
    if reconcile.vms_marked_failed > 0 || reconcile.agents_marked_failed > 0 {
        tracing::warn!(
            vms = reconcile.vms_marked_failed,
            agents = reconcile.agents_marked_failed,
            killed_qemu = reconcile.qemu_processes_killed,
            "reconciled orphaned VMs/agents from previous supervisor run"
        );
    }

    // Recover port allocator state from the DB so a supervisor restart
    // doesn't hand out ports already bound by surviving QEMU processes
    // from the previous run. Depends on `reconcile_orphans` having
    // already flipped orphans to `failed` so they're filtered out below
    // — see the comment on reconcile above.
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

    // Emit the recovery transitions on the now-live event bus so any
    // future `/v1/events` subscriber (e.g. a fleet coordinator) and
    // in-process listeners observe the failures rather than relying on
    // a manual REST refresh. Past-tense events for clients that connect
    // after this point are best-effort — they'll see the failed status
    // on their initial GET, so this is mostly forward-compatibility for
    // pre-existing in-process subscribers.
    for vm_id in reconcile.failed_vm_ids {
        state.events.emit(SupervisorEvent::VmUpdated { id: vm_id });
    }
    for agent_id in reconcile.failed_agent_ids {
        state.events.emit(SupervisorEvent::AgentUpdated { id: agent_id });
    }

    api::serve(state).await
}
