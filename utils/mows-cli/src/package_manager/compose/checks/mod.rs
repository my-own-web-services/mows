//! Deployment checks for Docker Compose projects.
//!
//! This module provides pre-deployment and post-deployment checks:
//! - Pre-flight checks: Traefik availability, volume mounts, file permissions, Ofelia/Watchtower
//! - Health checks: Container status, logs, ports, Traefik URL reachability

mod display;
mod health;
mod preflight;

// Re-export public API
pub use display::{print_check_results, run_and_print_health_checks};
pub use health::check_containers_ready;
pub use preflight::run_debug_checks;
