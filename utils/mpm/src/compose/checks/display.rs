//! Display and formatting for deployment check results.
//!
//! Provides formatted output with colors and emojis for both
//! pre-deployment checks and post-deployment health checks.

use colored::Colorize;

use crate::compose::DockerClient;
use super::health::{check_traefik_host, collect_container_health, ContainerHealth};
use super::preflight::{CheckResult, Severity};

/// Print check results to the console (pre-flight checks)
pub fn print_check_results(results: &[CheckResult]) {
    if results.is_empty() {
        return;
    }

    // Header
    println!();
    println!("{}", "Pre-flight Checks".cyan().bold());
    println!("{}", "─────────────────".dimmed());

    let mut errors = 0;
    let mut warnings = 0;

    for result in results {
        let status_icon = if result.passed {
            "✅".to_string()
        } else {
            match result.severity {
                Severity::Error => {
                    errors += 1;
                    "❌".to_string()
                }
                Severity::Warning => {
                    warnings += 1;
                    "⚠".yellow().to_string()
                }
                Severity::Info => "ℹ".cyan().to_string(),
            }
        };

        // Handle multiline messages
        let message_lines: Vec<&str> = result.message.lines().collect();
        if message_lines.len() > 1 {
            println!("{} {} {}", status_icon, result.name.bold(), message_lines[0]);
            for line in &message_lines[1..] {
                println!("    {}", line.dimmed());
            }
        } else {
            println!("{} {} {}", status_icon, result.name.bold(), result.message);
        }
    }

    // Summary
    println!();
    if errors > 0 || warnings > 0 {
        let error_text = if errors > 0 {
            format!("❌ {} error(s)", errors)
        } else {
            format!("{} error(s)", errors)
        };
        let warning_text = if warnings > 0 {
            format!("⚠ {} warning(s)", warnings).yellow().bold().to_string()
        } else {
            format!("{} warning(s)", warnings)
        };
        println!("{}, {}", error_text, warning_text);
    } else {
        println!("{}", "✅ All checks passed!".bold());
    }
}

/// Run health checks on all containers in a Docker Compose project and print results.
///
/// Collects health information for all containers including:
/// - Container running status and uptime
/// - Docker health check status (only shown if unhealthy/starting)
/// - Recent error patterns in logs (last 30 seconds)
/// - Port connectivity (TCP connection test with retries)
/// - Traefik URL reachability (if configured via labels)
///
/// Output is formatted with colors and emojis when terminal supports it:
/// ```text
/// Health Checks
/// ─────────────
/// 📦 my-container 5 minutes
///     ✅ logs clean
///     ✅ port 8080 responding
///
/// ✅ All checks passed!
/// ```
///
/// When issues are detected:
/// ```text
/// 📦 my-container 5 minutes
///     ⚠  starting
///     ⚠  2 error(s) in logs:
///        connection refused
///     ⚠  port 8080 not responding
///
/// 0 error(s), ⚠  3 warning(s)
/// ```
///
/// # Arguments
/// - `client`: Docker client for executing commands
/// - `project_name`: Docker Compose project name (used with `docker compose -p`)
/// - `compose`: Optional parsed compose file for extracting Traefik labels
///
/// # Side Effects
/// - Prints directly to stdout
/// - Returns early without output if no containers found
pub fn run_and_print_health_checks(client: &dyn DockerClient, project_name: &str, compose: Option<&serde_yaml_neo::Value>) {
    let containers = collect_container_health(client, project_name, compose);

    if containers.is_empty() {
        return;
    }

    print_health_checks(&containers);
}

/// Print health check results for containers
fn print_health_checks(containers: &[ContainerHealth]) {
    // Header
    println!();
    println!("{}", "Health Checks".cyan().bold());
    println!("{}", "─────────────".dimmed());

    let mut total_errors = 0;
    let mut total_warnings = 0;

    for container in containers {
        // Container header line: 📦 name (bold) uptime (dimmed) - all on same line
        let uptime = container
            .status
            .strip_prefix("Up ")
            .unwrap_or(&container.status);

        if !container.running {
            total_errors += 1;
        }
        println!("📦 {} {}", container.name.bold(), uptime.dimmed());

        // Health status - only show if unhealthy (skip healthy and no-healthcheck cases)
        if container.has_healthcheck {
            if let Some(ref health) = container.health {
                if health.contains("unhealthy") || health.contains("starting") {
                    // Extra space after warning emoji
                    println!("    {}  {}", "⚠".yellow(), health);
                    total_warnings += 1;
                }
            }
        }

        // Logs
        if container.log_errors.is_empty() {
            println!("    ✅ logs clean");
        } else {
            // Extra space after warning emoji
            println!(
                "    {}  {} error(s) in logs:",
                "⚠".yellow(),
                container.log_errors.len()
            );
            total_warnings += 1;
            for line in container.log_errors.iter().take(3) {
                // Extract just the log message part after the container name
                let msg = if let Some(pos) = line.find(" | ") {
                    &line[pos + 3..]
                } else {
                    line
                };
                println!("       {}", msg.trim().dimmed());
            }
            if container.log_errors.len() > 3 {
                println!(
                    "       {}",
                    format!("... and {} more", container.log_errors.len() - 3).dimmed()
                );
            }
        }

        // Endpoints
        if !container.ports.is_empty() {
            for port in &container.ports {
                if port.responding {
                    println!("    ✅ port {} responding", port.port);
                } else {
                    // Extra space after warning emoji
                    println!("    {}  port {} not responding", "⚠".yellow(), port.port);
                    total_warnings += 1;
                }
            }
        } else if !container.traefik_urls.is_empty() {
            // Check traefik URLs if no ports but traefik is configured
            for host in &container.traefik_urls {
                // Try HTTP first (more common for local dev), then HTTPS
                if let Some(result) = check_traefik_host(host) {
                    println!(
                        "    ✅ {} {} {}",
                        result.url, result.status_code, result.status_text
                    );
                } else {
                    // Extra space after warning emoji, include http:// prefix for clickable link
                    println!("    {}  http://{} not reachable", "⚠".yellow(), host);
                    total_warnings += 1;
                }
            }
        }

        println!(); // Blank line between containers
    }

    // Summary
    if total_errors > 0 || total_warnings > 0 {
        let error_text = if total_errors > 0 {
            format!("❌ {} error(s)", total_errors)
        } else {
            format!("{} error(s)", total_errors)
        };
        let warning_text = if total_warnings > 0 {
            // Extra space after warning emoji
            format!("⚠  {} warning(s)", total_warnings).yellow().bold().to_string()
        } else {
            format!("{} warning(s)", total_warnings)
        };
        println!("{}, {}", error_text, warning_text);
    } else {
        println!("{}", "✅ All checks passed!".bold());
    }
}

