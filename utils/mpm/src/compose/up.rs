use std::fs;
use std::process::Command;
use tracing::{debug, info};

use crate::error::{MpmError, Result};
use super::checks::{
    check_containers_ready, print_check_results, run_and_print_health_checks, run_debug_checks,
};
use super::find_manifest_dir;
use super::render::{run_render_pipeline, RenderContext};
use crate::utils::parse_yaml;

/// Check if Docker daemon is available and running
fn check_docker_available() -> Result<()> {
    // First check if docker command exists
    let output = Command::new("docker")
        .arg("--version")
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                MpmError::Docker("Docker is not installed or not in PATH. Please install Docker first.".to_string())
            } else {
                MpmError::command("docker --version", e.to_string())
            }
        })?;

    if !output.status.success() {
        return Err(MpmError::Docker("Docker command failed. Is Docker installed correctly?".to_string()));
    }

    // Check if Docker daemon is running by pinging it
    let output = Command::new("docker")
        .args(["info", "--format", "{{.ServerVersion}}"])
        .output()
        .map_err(|e| MpmError::command("docker info", e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("Cannot connect") || stderr.contains("permission denied") {
            return Err(MpmError::Docker(format!(
                r#"Cannot connect to Docker daemon. Is Docker running?
Try: sudo systemctl start docker
Or add your user to the docker group: sudo usermod -aG docker $USER
Error: {}"#,
                stderr.trim()
            )));
        }
        return Err(MpmError::Docker(format!("Docker daemon check failed: {}", stderr.trim())));
    }

    let version = String::from_utf8_lossy(&output.stdout);
    debug!("Docker daemon version: {}", version.trim());

    Ok(())
}

/// Run compose up: render templates and run docker compose up
pub fn compose_up() -> Result<()> {
    let base_dir = find_manifest_dir()?;

    info!("Running compose up in: {}", base_dir.display());

    // Check Docker is available before doing anything
    check_docker_available()?;

    // Create render context
    let ctx = RenderContext::new(&base_dir)?;

    // Run the render pipeline
    run_render_pipeline(&ctx)?;

    // Run pre-deployment debug checks
    run_pre_deployment_checks(&ctx);

    // Run docker compose up
    run_docker_compose_up(&ctx)?;

    // Run post-deployment health checks
    run_post_deployment_checks(&ctx);

    Ok(())
}

/// Run pre-deployment debug checks
fn run_pre_deployment_checks(ctx: &RenderContext) {
    let results_dir = ctx.base_dir.join("results");

    // Find and parse the docker-compose file
    let compose_path = if results_dir.join("docker-compose.yaml").exists() {
        results_dir.join("docker-compose.yaml")
    } else if results_dir.join("docker-compose.yml").exists() {
        results_dir.join("docker-compose.yml")
    } else {
        debug!("No docker-compose file found for debug checks");
        return;
    };

    let content = match fs::read_to_string(&compose_path) {
        Ok(c) => c,
        Err(e) => {
            debug!("Could not read docker-compose for checks: {}", e);
            return;
        }
    };

    let compose_value: serde_yaml_neo::Value = match parse_yaml(&content, Some(&compose_path)) {
        Ok(v) => v,
        Err(e) => {
            debug!("Could not parse docker-compose for checks: {}", e);
            return;
        }
    };

    let project_name = ctx.manifest.project_name();
    let results = run_debug_checks(&compose_value, &ctx.base_dir, &project_name);

    if !results.is_empty() {
        print_check_results(&results);
    }
}

/// Run post-deployment health checks with polling for container readiness.
///
/// Polls every 2 seconds for up to 30 seconds waiting for:
/// - All containers to be in "Up" state
/// - No containers with "starting" health status
///
/// Shows progress feedback while waiting, then runs full health checks.
/// Handles Ctrl+C gracefully by clearing the progress line before exit.
fn run_post_deployment_checks(ctx: &RenderContext) {
    use std::io::{self, Write};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    let project_name = ctx.manifest.project_name();
    let results_dir = ctx.base_dir.join("results");

    let timeout = Duration::from_secs(30);
    let poll_interval = Duration::from_secs(2);
    let start = Instant::now();

    // Track whether we're showing a progress line that needs clearing
    let showing_progress = Arc::new(AtomicBool::new(false));
    let showing_progress_handler = Arc::clone(&showing_progress);

    // Set up Ctrl+C handler to clear progress line before exit
    let _ = ctrlc::set_handler(move || {
        if showing_progress_handler.load(Ordering::SeqCst) {
            print!("\r\x1b[K");
            let _ = io::stdout().flush();
        }
        std::process::exit(130); // Standard exit code for SIGINT
    });

    // Initial short wait for containers to appear
    std::thread::sleep(Duration::from_secs(1));

    // Poll until ready or timeout
    let interrupted = loop {
        let readiness = check_containers_ready(&project_name);

        if readiness.all_ready {
            break false;
        }

        if start.elapsed() >= timeout {
            debug!(
                "Container readiness timeout: {}/{} running, {} starting",
                readiness.running, readiness.total, readiness.starting
            );
            break false;
        }

        // Show progress
        let status = if readiness.starting > 0 {
            format!(
                "Waiting for containers... ({}/{} running, {} starting)",
                readiness.running, readiness.total, readiness.starting
            )
        } else if readiness.running < readiness.total {
            format!(
                "Waiting for containers... ({}/{} running)",
                readiness.running, readiness.total
            )
        } else {
            "Waiting for containers...".to_string()
        };
        print!("\r{}", status);
        let _ = io::stdout().flush();
        showing_progress.store(true, Ordering::SeqCst);

        std::thread::sleep(poll_interval);
    };

    // Clear progress line before continuing
    if showing_progress.load(Ordering::SeqCst) {
        print!("\r\x1b[K");
        let _ = io::stdout().flush();
        showing_progress.store(false, Ordering::SeqCst);
    }

    if interrupted {
        return;
    }

    // Load compose content for traefik URL detection
    let compose = get_compose_content(&results_dir);

    run_and_print_health_checks(&project_name, compose.as_ref());
}

/// Load docker-compose content from results directory
fn get_compose_content(results_dir: &std::path::Path) -> Option<serde_yaml_neo::Value> {
    let compose_path = if results_dir.join("docker-compose.yaml").exists() {
        results_dir.join("docker-compose.yaml")
    } else if results_dir.join("docker-compose.yml").exists() {
        results_dir.join("docker-compose.yml")
    } else {
        return None;
    };

    fs::read_to_string(&compose_path)
        .ok()
        .and_then(|content| serde_yaml_neo::from_str(&content).ok())
}

/// Execute docker compose up with the project configuration
fn run_docker_compose_up(ctx: &RenderContext) -> Result<()> {
    let project_name = ctx.manifest.project_name();
    let results_dir = ctx.base_dir.join("results");

    // Find the docker-compose file
    let compose_file = if results_dir.join("docker-compose.yaml").exists() {
        "docker-compose.yaml"
    } else if results_dir.join("docker-compose.yml").exists() {
        "docker-compose.yml"
    } else {
        return Err(MpmError::Docker("No docker-compose.yaml or docker-compose.yml found in results directory".to_string()));
    };

    info!(
        "Running docker compose up for project: {}",
        project_name
    );

    // Build the command
    // docker compose -p PROJECT_NAME --project-directory results/ up --build -d --remove-orphans
    let mut cmd = Command::new("docker");
    cmd.arg("compose")
        .arg("-p")
        .arg(project_name)
        .arg("--project-directory")
        .arg(&results_dir)
        .arg("-f")
        .arg(results_dir.join(compose_file));

    // Add env files if they exist
    let generated_secrets = results_dir.join("generated-secrets.env");
    let provided_secrets = results_dir.join("provided-secrets.env");

    if generated_secrets.exists() {
        cmd.arg("--env-file").arg(&generated_secrets);
    }
    if provided_secrets.exists() {
        cmd.arg("--env-file").arg(&provided_secrets);
    }

    cmd.arg("up")
        .arg("--build")
        .arg("-d")
        .arg("--remove-orphans");

    debug!("Executing: {:?}", cmd);

    // Set current directory to base_dir for relative paths in docker-compose
    cmd.current_dir(&ctx.base_dir);

    let status = cmd
        .status()
        .map_err(|e| MpmError::command("docker compose up", e.to_string()))?;

    if !status.success() {
        return Err(MpmError::Docker(format!(
            "docker compose up failed with exit code: {}",
            status.code().unwrap_or(-1)
        )));
    }

    info!("Docker compose up completed successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    fn create_minimal_project(dir: &std::path::Path) {
        // Create manifest
        fs::write(
            dir.join("mows-manifest.yaml"),
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
spec:
  compose: {}
"#,
        )
        .unwrap();

        // Create templates
        fs::create_dir_all(dir.join("templates")).unwrap();
        fs::write(
            dir.join("templates/docker-compose.yaml"),
            r#"services:
  web:
    image: nginx:latest
"#,
        )
        .unwrap();
    }

    #[test]
    fn test_render_pipeline() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        // Test the render pipeline directly
        let ctx = RenderContext::new(dir.path()).unwrap();
        let result = run_render_pipeline(&ctx);
        assert!(result.is_ok());

        // Verify results were created
        assert!(dir.path().join("results/docker-compose.yaml").exists());
    }
}
