use std::fs;
use std::time::Duration;
use tracing::{debug, info};

use crate::error::Result;
use super::checks::{
    check_containers_ready, print_check_results, run_and_print_health_checks, run_debug_checks,
};
use super::docker::{default_client, ComposeUpOptions, DockerClient};
use super::find_manifest_dir;
use super::render::{run_render_pipeline, RenderContext};
use crate::utils::parse_yaml;

/// Maximum time to wait for containers to become ready after `docker compose up`.
const CONTAINER_READY_TIMEOUT: Duration = Duration::from_secs(30);

/// Interval between container readiness polls.
const CONTAINER_POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Initial delay after starting containers before first readiness check.
/// Allows containers time to appear in `docker ps`.
const CONTAINER_STARTUP_DELAY: Duration = Duration::from_secs(1);

/// Find the docker-compose file in a directory.
///
/// Looks for `docker-compose.yaml` first, then `docker-compose.yml`.
/// Returns `None` if neither file exists.
fn find_compose_file(dir: &std::path::Path) -> Option<std::path::PathBuf> {
    let yaml_path = dir.join("docker-compose.yaml");
    if yaml_path.exists() {
        return Some(yaml_path);
    }

    let yml_path = dir.join("docker-compose.yml");
    if yml_path.exists() {
        return Some(yml_path);
    }

    None
}

/// Run compose up: render templates and run docker compose up
pub fn compose_up() -> Result<()> {
    let base_dir = find_manifest_dir()?;

    info!("Running compose up in: {}", base_dir.display());

    // Create Docker client (also checks Docker is available)
    let client = default_client()?;

    // Create render context
    let context = RenderContext::new(&base_dir)?;

    // Sync and validate provided secrets
    let secrets_path = base_dir.join("provided-secrets.env");
    super::secrets::sync_provided_secrets_from_manifest(&context.manifest, &secrets_path)?;
    super::secrets::validate_provided_secrets(&context.manifest, &secrets_path)?;

    // Run the render pipeline
    run_render_pipeline(&context)?;

    // Run pre-deployment debug checks
    run_pre_deployment_checks(client.as_ref(), &context);

    // Run docker compose up
    run_docker_compose_up(client.as_ref(), &context)?;

    // Run post-deployment health checks
    run_post_deployment_checks(client.as_ref(), &context);

    Ok(())
}

/// Run pre-deployment debug checks
fn run_pre_deployment_checks(client: &dyn DockerClient, context: &RenderContext) {
    let results_dir = context.base_dir.join("results");

    // Find and parse the docker-compose file
    let compose_path = match find_compose_file(&results_dir) {
        Some(path) => path,
        None => {
            debug!("No docker-compose file found for debug checks");
            return;
        }
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

    let project_name = context.manifest.project_name();
    let results = run_debug_checks(client, &compose_value, &context.base_dir, &project_name);

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
fn run_post_deployment_checks(client: &dyn DockerClient, context: &RenderContext) {
    use std::io::{self, Write};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Instant;

    let project_name = context.manifest.project_name();
    let results_dir = context.base_dir.join("results");

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
    std::thread::sleep(CONTAINER_STARTUP_DELAY);

    // Poll until ready or timeout
    let interrupted = loop {
        let readiness = check_containers_ready(client, &project_name);

        if readiness.all_ready {
            break false;
        }

        if start.elapsed() >= CONTAINER_READY_TIMEOUT {
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

        std::thread::sleep(CONTAINER_POLL_INTERVAL);
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

    run_and_print_health_checks(client, &project_name, compose.as_ref());
}

/// Load docker-compose content from results directory
fn get_compose_content(results_dir: &std::path::Path) -> Option<serde_yaml_neo::Value> {
    let compose_path = find_compose_file(results_dir)?;

    fs::read_to_string(&compose_path)
        .ok()
        .and_then(|content| serde_yaml_neo::from_str(&content).ok())
}

/// Execute docker compose up with the project configuration
fn run_docker_compose_up(client: &dyn DockerClient, context: &RenderContext) -> Result<()> {
    use crate::error::MowsError;

    let project_name = context.manifest.project_name();
    let results_dir = context.base_dir.join("results");

    // Find the docker-compose file
    let compose_file = find_compose_file(&results_dir).ok_or_else(|| {
        MowsError::Docker(
            "No docker-compose.yaml or docker-compose.yml found in results directory".to_string(),
        )
    })?;

    info!(
        "Running docker compose up for project: {}",
        project_name
    );

    // Collect env files
    let mut env_files = Vec::new();
    let generated_secrets = results_dir.join("generated-secrets.env");
    let provided_secrets = results_dir.join("provided-secrets.env");

    if generated_secrets.exists() {
        env_files.push(generated_secrets);
    }
    if provided_secrets.exists() {
        env_files.push(provided_secrets);
    }

    let options = ComposeUpOptions {
        project: &project_name,
        compose_file: &compose_file,
        project_dir: &results_dir,
        env_files: env_files.iter().map(|p| p.as_path()).collect(),
        working_dir: &context.base_dir,
        build: true,
        detach: true,
        remove_orphans: true,
    };

    client.compose_up(&options)?;

    info!("Docker compose up completed successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::package_manager::compose::docker::{ConfigurableMockClient, MockResponse};
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
        let context = RenderContext::new(dir.path()).unwrap();
        let result = run_render_pipeline(&context);
        assert!(result.is_ok());

        // Verify results were created
        assert!(dir.path().join("results/docker-compose.yaml").exists());
    }

    #[test]
    fn test_run_docker_compose_up_missing_compose_file() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        // Create results dir but no docker-compose file
        fs::create_dir_all(dir.path().join("results")).unwrap();

        let client = ConfigurableMockClient::default();
        let result = run_docker_compose_up(&client, &context);

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No docker-compose.yaml or docker-compose.yml"));
    }

    #[test]
    fn test_run_docker_compose_up_docker_error() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        // Run render pipeline to create docker-compose file
        run_render_pipeline(&context).unwrap();

        // Configure mock client to fail on compose_up
        let client = ConfigurableMockClient {
            compose_up: MockResponse::err("Failed to start containers"),
            ..Default::default()
        };

        let result = run_docker_compose_up(&client, &context);

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Failed to start containers"));
    }

    #[test]
    fn test_run_docker_compose_up_success() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        // Run render pipeline to create docker-compose file
        run_render_pipeline(&context).unwrap();

        let client = ConfigurableMockClient::default();
        let result = run_docker_compose_up(&client, &context);

        assert!(result.is_ok());
    }

    #[test]
    fn test_run_docker_compose_up_with_env_files() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // Create env files that should be included
        let results_dir = dir.path().join("results");
        fs::write(results_dir.join("generated-secrets.env"), "SECRET=value").unwrap();
        fs::write(results_dir.join("provided-secrets.env"), "API_KEY=key").unwrap();

        let client = ConfigurableMockClient::default();
        let result = run_docker_compose_up(&client, &context);

        assert!(result.is_ok());
    }

    // =========================================================================
    // Error Propagation Tests (#34) - Verify errors propagate correctly
    // =========================================================================

    #[test]
    fn test_render_context_fails_with_invalid_manifest() {
        let dir = tempdir().unwrap();

        // Create invalid manifest
        fs::write(
            dir.path().join("mows-manifest.yaml"),
            "this is not valid yaml: [unclosed",
        )
        .unwrap();

        let result = RenderContext::new(dir.path());

        assert!(result.is_err());
        let err = match result {
            Err(e) => e.to_string(),
            Ok(_) => panic!("Expected error"),
        };
        assert!(
            err.contains("parse") || err.contains("yaml") || err.contains("YAML"),
            "Error should mention parsing: {}",
            err
        );
    }

    #[test]
    fn test_render_pipeline_fails_with_invalid_template() {
        let dir = tempdir().unwrap();

        // Create valid manifest
        fs::write(
            dir.path().join("mows-manifest.yaml"),
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
spec:
  compose: {}
"#,
        )
        .unwrap();

        // Create templates directory
        fs::create_dir_all(dir.path().join("templates")).unwrap();

        // Create invalid template (unclosed Tera block)
        fs::write(
            dir.path().join("templates/docker-compose.yaml"),
            r#"services:
  web:
    image: {{ undefined_variable }}
"#,
        )
        .unwrap();

        let context = RenderContext::new(dir.path()).unwrap();
        let result = run_render_pipeline(&context);

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("undefined") || err.contains("template") || err.contains("Template"),
            "Error should mention undefined variable: {}",
            err
        );
    }

    #[test]
    fn test_run_docker_compose_up_propagates_client_error() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // Mock client that fails with specific error
        let client = ConfigurableMockClient {
            compose_up: MockResponse::err("Permission denied: cannot connect to Docker socket"),
            ..Default::default()
        };

        let result = run_docker_compose_up(&client, &context);

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Permission denied") && err.contains("Docker"),
            "Error should contain original message: {}",
            err
        );
    }

    #[test]
    fn test_find_compose_file_yaml() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("docker-compose.yaml"), "services: {}").unwrap();

        let result = find_compose_file(dir.path());
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("docker-compose.yaml"));
    }

    #[test]
    fn test_find_compose_file_yml() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("docker-compose.yml"), "services: {}").unwrap();

        let result = find_compose_file(dir.path());
        assert!(result.is_some());
        assert!(result.unwrap().ends_with("docker-compose.yml"));
    }

    #[test]
    fn test_find_compose_file_prefers_yaml_over_yml() {
        let dir = tempdir().unwrap();
        // Create both files
        fs::write(dir.path().join("docker-compose.yaml"), "yaml").unwrap();
        fs::write(dir.path().join("docker-compose.yml"), "yml").unwrap();

        let result = find_compose_file(dir.path());
        assert!(result.is_some());
        // Should prefer .yaml extension
        assert!(result.unwrap().ends_with("docker-compose.yaml"));
    }

    #[test]
    fn test_find_compose_file_not_found() {
        let dir = tempdir().unwrap();
        // Don't create any compose file

        let result = find_compose_file(dir.path());
        assert!(result.is_none());
    }
}
