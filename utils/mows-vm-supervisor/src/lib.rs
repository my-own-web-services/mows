//! mows-vm-supervisor — runs AI coding agents (claude-code today, others
//! later) inside ephemeral Alpine QEMU VMs.
//!
//! See `.plans/agent-vm/PLAN.md` in `utils/mows-cli` for the full design.

pub mod agent_runtime;
pub mod api;
pub mod config;
pub mod db;
pub mod error;
pub mod kinds;
pub mod qemu;
pub mod ssh_keys;
pub mod state;
