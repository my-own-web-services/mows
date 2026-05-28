//! Startup reconciliation of VMs and agents that the supervisor *thought*
//! were alive but cannot have survived the supervisor's restart.
//!
//! Why this exists
//! ---------------
//! QEMU processes are spawned as children of the supervisor process and
//! their I/O (stdout/stderr/console socket/monitor socket) is owned by the
//! supervisor's in-memory state. When the supervisor (or its container)
//! restarts:
//!
//! 1. **Container restart** — Docker tears down the PID namespace, every
//!    QEMU child dies, but the `vms` rows still say `status = 'running'`
//!    and their ports look reserved. Click-to-launch SSH from the UI then
//!    silently hangs because the host SSH port no longer has a QEMU
//!    behind it. This is the bug that triggered the fix.
//! 2. **In-process supervisor crash + restart inside the same container**
//!    — QEMU may still be alive, reparented to PID 1, but the supervisor
//!    has no `tokio::process::Child` handle to it anymore, so it cannot
//!    `kill()` it, cannot await it, cannot read its monitor socket. The
//!    VM is unmanageable; cleaner to kill and let the operator restart.
//!
//! In both cases the right move on startup is: walk every VM the DB
//! marks as non-terminal, terminate any stray QEMU process whose PID we
//! recorded (best effort, only if `/proc/<pid>/comm` still says QEMU so
//! we don't shoot an unrelated process that happens to share the PID
//! after a namespace reset), and flip the row to `failed`. Agents that
//! were running inside those VMs are flipped to `failed` by the same
//! transaction since their execution context just died.

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

use crate::error::Result;
use crate::events::{EventBus, SupervisorEvent};

/// Counts returned from a reconciliation pass — useful for the startup
/// log line and as the assertion target in tests. Carries the row ids
/// that flipped so the caller can drive event emission and a future
/// fleet coordinator can attribute recovery per supervisor (FUTURE-5).
#[derive(Debug, Default, PartialEq, Eq)]
pub struct ReconcileStats {
    pub vms_marked_failed: u64,
    pub agents_marked_failed: u64,
    pub qemu_processes_killed: u64,
    /// VM ids that transitioned to `failed`. Emitted as
    /// `VmUpdated` so any connected event stream sees the recovery
    /// immediately rather than on the next manual refresh.
    pub failed_vm_ids: Vec<String>,
    /// Agent ids that transitioned to `failed` (cascaded from a
    /// failed VM).
    pub failed_agent_ids: Vec<String>,
}

/// Mark every non-terminal VM as `failed` (and every non-terminal agent
/// inside such a VM likewise) on supervisor startup. Returns the number
/// of rows touched plus the affected ids so the caller can:
///   - log a single summary line, and
///   - emit `SupervisorEvent::{Vm,Agent}Updated` so any frontend
///     subscribed to `/v1/events` sees the recovery transitions.
///
/// Optionally takes an `&EventBus`; when provided, this function will
/// emit events directly. When `None` the caller is responsible for
/// draining `failed_vm_ids` / `failed_agent_ids` and emitting itself
/// (or skipping emission entirely in tests).
pub async fn reconcile_orphans(
    pool: &SqlitePool,
    now: DateTime<Utc>,
    events: Option<&EventBus>,
) -> Result<ReconcileStats> {
    let orphans: Vec<(String, Option<i64>, String)> = sqlx::query_as(
        "SELECT id, qemu_pid, status FROM vms \
         WHERE status IN ('starting', 'running', 'stopping')",
    )
    .fetch_all(pool)
    .await?;

    if orphans.is_empty() {
        return Ok(ReconcileStats::default());
    }

    let mut killed = 0u64;
    for (vm_id, pid, previous_status) in &orphans {
        // Tell stopping-mid-shutdown (clean interruption) apart from
        // running/starting (true orphan) so operators reading the log
        // post-restart aren't misled by a wall of "WARN: killed stray
        // qemu" when the supervisor was just shutting down.
        let level = if previous_status == "stopping" {
            tracing::Level::INFO
        } else {
            tracing::Level::WARN
        };
        if let Some(pid) = pid {
            if kill_if_qemu(*pid) {
                killed += 1;
                match level {
                    tracing::Level::INFO => tracing::info!(
                        vm_id = %vm_id,
                        pid = pid,
                        previous_status = previous_status,
                        "reaped qemu mid-shutdown from previous supervisor run"
                    ),
                    _ => tracing::warn!(
                        vm_id = %vm_id,
                        pid = pid,
                        previous_status = previous_status,
                        "killed stray qemu process from previous supervisor run"
                    ),
                }
            }
        }
    }

    let timestamp = now.to_rfc3339();
    let mut tx = pool.begin().await?;

    let failed_vm_ids: Vec<String> = sqlx::query_scalar(
        "SELECT id FROM vms WHERE status IN ('starting', 'running', 'stopping')",
    )
    .fetch_all(&mut *tx)
    .await?;

    let failed_agent_ids: Vec<String> = if failed_vm_ids.is_empty() {
        Vec::new()
    } else {
        // Inline the placeholder list — sqlx doesn't expand `IN (?)`
        // bindings for `Vec<T>`. Each id is a UUID so quoting is safe.
        let placeholders = (1..=failed_vm_ids.len())
            .map(|i| format!("?{i}"))
            .collect::<Vec<_>>()
            .join(",");
        let query_string = format!(
            "SELECT id FROM agents \
             WHERE status IN ('starting', 'running', 'stopping') \
               AND vm_id IN ({placeholders})"
        );
        let mut query = sqlx::query_scalar::<_, String>(&query_string);
        for vm_id in &failed_vm_ids {
            query = query.bind(vm_id);
        }
        query.fetch_all(&mut *tx).await?
    };

    let vm_update = sqlx::query(
        "UPDATE vms SET status = 'failed', exited_at = ?1 \
         WHERE status IN ('starting', 'running', 'stopping')",
    )
    .bind(&timestamp)
    .execute(&mut *tx)
    .await?;

    let agent_update = sqlx::query(
        "UPDATE agents SET status = 'failed', exited_at = ?1 \
         WHERE status IN ('starting', 'running', 'stopping') \
           AND vm_id IN (SELECT id FROM vms WHERE status = 'failed' AND exited_at = ?1)",
    )
    .bind(&timestamp)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if let Some(bus) = events {
        for vm_id in &failed_vm_ids {
            bus.emit(SupervisorEvent::VmUpdated { id: vm_id.clone() });
        }
        for agent_id in &failed_agent_ids {
            bus.emit(SupervisorEvent::AgentUpdated { id: agent_id.clone() });
        }
    }

    Ok(ReconcileStats {
        vms_marked_failed: vm_update.rows_affected(),
        agents_marked_failed: agent_update.rows_affected(),
        qemu_processes_killed: killed,
        failed_vm_ids,
        failed_agent_ids,
    })
}

/// Best-effort: SIGKILL the given PID **iff** its `/proc/<pid>/comm`
/// matches a known qemu binary basename exactly. Returns `true` if a
/// kill was actually sent.
///
/// The `comm` check is the safety belt: after a container restart the
/// PID namespace is fresh, so an old recorded PID either does not
/// resolve (no-op) or — in the in-process supervisor restart case —
/// resolves to the original QEMU process reparented to PID 1. If it
/// resolves to a different unrelated process (e.g. PID reuse in an
/// in-process restart with a long gap), the `comm` check refuses to
/// kill it.
///
/// `comm` is the kernel's truncated 16-byte basename of the binary, so
/// we match against the exact set of `qemu-system-*` binaries the
/// project spawns. A prefix `starts_with("qemu")` would happily kill an
/// unrelated `qemu_helper`, `qemu-img`, `qemu-nbd`, etc. — too loose.
fn kill_if_qemu(pid: i64) -> bool {
    /// 16-byte `comm` strings (kernel truncates to TASK_COMM_LEN-1 = 15
    /// chars + NUL). `qemu-system-x86_64` would render as
    /// `qemu-system-x86`, so check the truncated forms too.
    const QEMU_COMM_NAMES: &[&str] = &[
        "qemu-system-x86",     // truncated qemu-system-x86_64
        "qemu-system-x86_64",  // full name when binary is shorter (older kernels)
        "qemu-system-aarc",    // truncated qemu-system-aarch64
        "qemu-system-aarch64",
        "qemu-system-arm",
        "qemu-system-riscv",
    ];

    let Ok(pid_u32) = u32::try_from(pid) else {
        return false;
    };
    if pid_u32 <= 1 {
        // PID 1 (init) and PID 0 are never QEMU children of ours. The
        // `comm` check below would already refuse, but bail early as a
        // belt-and-braces measure.
        return false;
    }
    let comm_path = format!("/proc/{pid_u32}/comm");
    let comm = match std::fs::read_to_string(&comm_path) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let comm = comm.trim();
    if !QEMU_COMM_NAMES.iter().any(|name| comm == *name) {
        return false;
    }
    // `kill -9 <pid>` — best effort. We do not propagate failures
    // because the only sensible recovery is "carry on with marking the
    // row failed" which we do regardless.
    let _ = std::process::Command::new("kill")
        .arg("-9")
        .arg(pid_u32.to_string())
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn fresh_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    async fn insert_vm(pool: &SqlitePool, id: &str, status: &str, pid: Option<i64>) {
        sqlx::query(
            "INSERT INTO vms (id, name, status, started_at, qemu_pid) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(id)
        .bind(format!("vm-{id}"))
        .bind(status)
        .bind("2026-01-01T00:00:00Z")
        .bind(pid)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn insert_agent(pool: &SqlitePool, id: &str, vm_id: &str, status: &str) {
        sqlx::query(
            "INSERT INTO agents (id, vm_id, name, kind, status, started_at) \
             VALUES (?1, ?2, ?3, 'claude', ?4, '2026-01-01T00:00:00Z')",
        )
        .bind(id)
        .bind(vm_id)
        .bind(format!("agent-{id}"))
        .bind(status)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn status_of_vm(pool: &SqlitePool, id: &str) -> String {
        sqlx::query_scalar::<_, String>("SELECT status FROM vms WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    async fn status_of_agent(pool: &SqlitePool, id: &str) -> String {
        sqlx::query_scalar::<_, String>("SELECT status FROM agents WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    async fn exited_at_of_vm(pool: &SqlitePool, id: &str) -> Option<String> {
        sqlx::query_scalar::<_, Option<String>>("SELECT exited_at FROM vms WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn marks_running_vm_as_failed() {
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm1", "running", None).await;

        let now: DateTime<Utc> = "2026-05-26T16:00:00Z".parse().unwrap();
        let stats = reconcile_orphans(&pool, now, None).await.unwrap();

        assert_eq!(stats.vms_marked_failed, 1);
        assert_eq!(stats.agents_marked_failed, 0);
        assert_eq!(stats.qemu_processes_killed, 0);
        assert_eq!(status_of_vm(&pool, "vm1").await, "failed");
        assert_eq!(
            exited_at_of_vm(&pool, "vm1").await.as_deref(),
            Some("2026-05-26T16:00:00+00:00")
        );
    }

    #[tokio::test]
    async fn marks_starting_and_stopping_vms_too() {
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm-start", "starting", None).await;
        insert_vm(&pool, "vm-stop", "stopping", None).await;

        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();

        assert_eq!(stats.vms_marked_failed, 2);
        assert_eq!(status_of_vm(&pool, "vm-start").await, "failed");
        assert_eq!(status_of_vm(&pool, "vm-stop").await, "failed");
    }

    #[tokio::test]
    async fn leaves_terminal_vms_untouched() {
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm-stopped", "stopped", None).await;
        insert_vm(&pool, "vm-failed", "failed", None).await;

        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();

        assert_eq!(stats.vms_marked_failed, 0);
        assert_eq!(status_of_vm(&pool, "vm-stopped").await, "stopped");
        assert_eq!(status_of_vm(&pool, "vm-failed").await, "failed");
        assert_eq!(exited_at_of_vm(&pool, "vm-stopped").await, None);
    }

    #[tokio::test]
    async fn cascades_to_running_agents_of_failed_vms() {
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm1", "running", None).await;
        insert_agent(&pool, "a1", "vm1", "running").await;
        insert_agent(&pool, "a2", "vm1", "starting").await;
        insert_agent(&pool, "a-done", "vm1", "stopped").await;

        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();

        assert_eq!(stats.vms_marked_failed, 1);
        assert_eq!(stats.agents_marked_failed, 2);
        assert_eq!(status_of_agent(&pool, "a1").await, "failed");
        assert_eq!(status_of_agent(&pool, "a2").await, "failed");
        assert_eq!(status_of_agent(&pool, "a-done").await, "stopped");
    }

    #[tokio::test]
    async fn cascades_to_agents_in_starting_vm() {
        // Regression for QA-6: a VM in `starting` state with agents in
        // a mix of non-terminal/terminal states. Reconcile must flip
        // only the non-terminal agents inside that VM to `failed`.
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm-start", "starting", None).await;
        insert_agent(&pool, "a-starting", "vm-start", "starting").await;
        insert_agent(&pool, "a-running", "vm-start", "running").await;
        insert_agent(&pool, "a-stopping", "vm-start", "stopping").await;
        insert_agent(&pool, "a-stopped", "vm-start", "stopped").await;

        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();
        assert_eq!(stats.vms_marked_failed, 1);
        assert_eq!(stats.agents_marked_failed, 3);
        assert_eq!(status_of_agent(&pool, "a-starting").await, "failed");
        assert_eq!(status_of_agent(&pool, "a-running").await, "failed");
        assert_eq!(status_of_agent(&pool, "a-stopping").await, "failed");
        assert_eq!(
            status_of_agent(&pool, "a-stopped").await,
            "stopped",
            "terminal agents must be left untouched even when their VM was marked failed"
        );
    }

    #[tokio::test]
    async fn no_op_when_db_is_clean() {
        let pool = fresh_pool().await;
        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();
        assert_eq!(stats, ReconcileStats::default());
    }

    #[tokio::test]
    async fn emits_events_for_failed_vms_and_agents() {
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm1", "running", None).await;
        insert_agent(&pool, "a1", "vm1", "running").await;

        let bus = EventBus::new();
        let mut rx = bus.subscribe();
        let stats = reconcile_orphans(&pool, Utc::now(), Some(&bus)).await.unwrap();

        assert_eq!(stats.failed_vm_ids, vec!["vm1".to_string()]);
        assert_eq!(stats.failed_agent_ids, vec!["a1".to_string()]);

        // Drain — order is VmUpdated first, then AgentUpdated.
        let first = rx.try_recv().expect("VmUpdated emitted");
        let second = rx.try_recv().expect("AgentUpdated emitted");
        assert!(
            matches!(&first, SupervisorEvent::VmUpdated { id } if id == "vm1"),
            "expected VmUpdated for vm1, got {first:?}"
        );
        assert!(
            matches!(&second, SupervisorEvent::AgentUpdated { id } if id == "a1"),
            "expected AgentUpdated for a1, got {second:?}"
        );
    }

    #[tokio::test]
    async fn returns_failed_ids_even_without_event_bus() {
        // Tests that consumers who pass `None` can still drain
        // `failed_vm_ids` / `failed_agent_ids` and emit events
        // themselves (or skip emission entirely).
        let pool = fresh_pool().await;
        insert_vm(&pool, "vm1", "running", None).await;
        insert_agent(&pool, "a1", "vm1", "starting").await;

        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();
        assert_eq!(stats.failed_vm_ids, vec!["vm1".to_string()]);
        assert_eq!(stats.failed_agent_ids, vec!["a1".to_string()]);
    }

    #[tokio::test]
    async fn refuses_to_kill_non_qemu_pid() {
        // Spawn a real `sleep` child so /proc/<pid>/comm resolves to
        // something non-QEMU. The reconciler must NOT signal it even
        // though the VM row claims qemu_pid points there.
        let mut child = std::process::Command::new("sleep")
            .arg("30")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .expect("spawn sleep");
        let pid = child.id() as i64;

        let pool = fresh_pool().await;
        insert_vm(&pool, "vm1", "running", Some(pid)).await;

        let stats = reconcile_orphans(&pool, Utc::now(), None).await.unwrap();
        assert_eq!(stats.vms_marked_failed, 1);
        assert_eq!(
            stats.qemu_processes_killed, 0,
            "non-qemu PID must be left alone"
        );

        // sleep is still alive: try_wait returns None.
        let still_alive = matches!(child.try_wait(), Ok(None));
        assert!(still_alive, "reconciler must not have killed our sleep");

        let _ = child.kill();
        let _ = child.wait();
    }
}
