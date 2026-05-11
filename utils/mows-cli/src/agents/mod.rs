//! `mows vms` and `mows agents` — CLI entrypoints that drive the
//! mows-vm-supervisor container.
//!
//! See `.plans/agent-vm/PLAN.md` for the full design. This module is a thin
//! HTTP/websocket client; the supervisor crate owns QEMU spawning, the
//! per-agent SSH/pty runtime, image building, and WireGuard.

mod bootstrap;
mod client;
mod commands;

pub use commands::{
    agent_attach, agent_create, agent_list, agent_logs, agent_rm, agent_run, agent_stop, agent_ui,
    agent_user_add, agent_user_list, agent_user_passwd, agent_user_rm,
    vm_attach, vm_build_image, vm_list, vm_logs, vm_rm, vm_run, vm_stop, vm_supervisor_logs,
    vm_supervisor_start, vm_supervisor_status, vm_supervisor_stop, vm_supervisor_wg_config,
};
