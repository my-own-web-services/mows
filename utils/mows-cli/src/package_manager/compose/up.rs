use std::fs;
use std::time::Duration;
use tracing::{debug, info};

use crate::error::Result;
use super::checks::{
    check_containers_ready, print_check_results, run_and_print_health_checks, run_debug_checks,
    validate_volume_mounts,
};
use colored::Colorize;

use super::docker::{default_client, ComposeBuildOptions, ComposeUpOptions, DockerClient};
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
pub(super) fn find_compose_file(dir: &std::path::Path) -> Option<std::path::PathBuf> {
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

/// Run compose up: render templates and run docker compose up.
///
/// When `watch` is true, after the initial deployment the process stays alive
/// and monitors source files for changes, re-running the full pipeline on each change.
pub fn compose_up(watch: bool, debounce_ms: u64) -> Result<()> {
    let base_dir = find_manifest_dir()?;

    info!("Running compose up in: {}", base_dir.display());

    // Create Docker client (also checks Docker is available)
    let client = default_client()?;

    if watch {
        // In watch mode, a failed initial deploy is not fatal — print the
        // error and enter the watch loop so the user can fix & save.
        if let Err(e) = run_deploy_cycle(&base_dir, client.as_ref(), false) {
            eprintln!(
                "\n{} Initial deploy failed: {}\n       Fix the issue and save to retry.",
                "watch:".red().bold(),
                e
            );
        }
        super::watch::run_watch_loop(&base_dir, client.as_ref(), debounce_ms)?;
    } else {
        run_deploy_cycle(&base_dir, client.as_ref(), false)?;
    }

    Ok(())
}

/// Execute the full deploy cycle: render, validate, compose up, health checks.
///
/// This is the core pipeline extracted so it can be called both for the initial
/// deploy and for each re-deploy triggered by the watch loop.
///
/// When `build_context_changed` is `true`, Docker build cache is skipped
/// (`--no-cache`) to ensure source file changes inside build contexts are
/// picked up by the image rebuild.
pub(super) fn run_deploy_cycle(
    base_dir: &std::path::Path,
    client: &dyn DockerClient,
    build_context_changed: bool,
) -> Result<()> {
    // Create render context
    let context = RenderContext::new(base_dir)?;

    // Sync and validate provided secrets
    let secrets_path = base_dir.join("provided-secrets.env");
    super::secrets::sync_provided_secrets_from_manifest(&context.manifest, &secrets_path)?;
    super::secrets::validate_provided_secrets(&context.manifest, &secrets_path)?;

    // Run the render pipeline
    run_render_pipeline(&context)?;

    // Run pre-deployment debug checks
    run_pre_deployment_checks(client, &context);

    // Validate volume mounts before Docker can create root-owned directories
    validate_rendered_volume_mounts(&context)?;

    // Run docker compose up
    run_docker_compose_up(client, &context, build_context_changed)?;

    // Run post-deployment health checks
    run_post_deployment_checks(client, &context);

    Ok(())
}

/// Validate that bind mounts in the rendered compose file only use allowed paths.
///
/// This is a fatal check — if any bind mount resolves to a path outside
/// `./config/` or `./data/`, the deploy is aborted before Docker runs.
fn validate_rendered_volume_mounts(context: &RenderContext) -> Result<()> {
    let results_dir = context.base_dir.join(super::RESULTS_DIR_NAME);

    let compose_path = match find_compose_file(&results_dir) {
        Some(path) => path,
        None => return Ok(()),
    };

    let content = fs::read_to_string(&compose_path)
        .map_err(|e| crate::error::MowsError::io("Failed to read docker-compose for mount validation", e))?;

    let compose_value: serde_yaml_neo::Value = parse_yaml(&content, Some(&compose_path))?;

    validate_volume_mounts(&compose_value, &context.base_dir)
}

/// Run pre-deployment debug checks against the rendered docker-compose file.
///
/// Loads the rendered compose file from the results directory, parses it,
/// and runs diagnostic checks (e.g., port conflicts, missing images).
/// Failures here are non-fatal — they produce warnings but do not abort
/// the deployment.
fn run_pre_deployment_checks(client: &dyn DockerClient, context: &RenderContext) {
    let results_dir = context.base_dir.join(super::RESULTS_DIR_NAME);

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
/// Does not register its own Ctrl+C handler — the caller (or default OS
/// signal handling) is responsible for clean shutdown. This avoids conflicts
/// with the watch loop's `ctrlc::set_handler` (which can only be set once).
fn run_post_deployment_checks(client: &dyn DockerClient, context: &RenderContext) {
    use std::io::{self, Write};
    use std::time::Instant;

    let project_name = context.manifest.project_name();
    let results_dir = context.base_dir.join(super::RESULTS_DIR_NAME);

    let start = Instant::now();
    let mut showing_progress = false;

    // Initial short wait for containers to appear
    std::thread::sleep(CONTAINER_STARTUP_DELAY);

    // Poll until ready or timeout
    loop {
        let readiness = check_containers_ready(client, &project_name);

        if readiness.all_ready {
            break;
        }

        if start.elapsed() >= CONTAINER_READY_TIMEOUT {
            debug!(
                "Container readiness timeout: {}/{} running, {} starting",
                readiness.running, readiness.total, readiness.starting
            );
            break;
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
        showing_progress = true;

        std::thread::sleep(CONTAINER_POLL_INTERVAL);
    };

    // Clear progress line before continuing
    if showing_progress {
        print!("\r\x1b[K");
        let _ = io::stdout().flush();
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

/// Execute docker compose up with the project configuration.
///
/// Always runs `docker compose build` followed by `docker compose up -d`.
/// Separating the build and deploy steps (rather than using `up --build`)
/// ensures Docker properly rebuilds images when source files change —
/// particularly important for multi-stage builds like cargo-chef where
/// `up --build` may not always invalidate the layer cache correctly.
///
/// When `build_context_changed` is `true`, the build runs with `--no-cache`
/// to force a complete rebuild, ensuring source file changes inside build
/// contexts are picked up.
fn run_docker_compose_up(
    client: &dyn DockerClient,
    context: &RenderContext,
    build_context_changed: bool,
) -> Result<()> {
    use crate::error::MowsError;

    let project_name = context.manifest.project_name();
    let results_dir = context.base_dir.join(super::RESULTS_DIR_NAME);

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

    let env_file_refs: Vec<&std::path::Path> = env_files.iter().map(|p| p.as_path()).collect();

    // Always run an explicit `docker compose build` before `docker compose up`.
    // Using `up --build` alone relies on Docker's inline build which may not
    // properly invalidate cache in all scenarios (e.g. multi-stage cargo-chef
    // builds). A separate build step is more reliable and gives clearer errors.
    // When build_context_changed is true, pass --no-cache to force a full
    // rebuild; otherwise use Docker's layer cache (fast if nothing changed).
    let build_options = ComposeBuildOptions {
        project: &project_name,
        compose_file: &compose_file,
        project_dir: &results_dir,
        env_files: env_file_refs.clone(),
        working_dir: &context.base_dir,
        no_cache: build_context_changed,
    };
    client.compose_build(&build_options)?;

    let options = ComposeUpOptions {
        project: &project_name,
        compose_file: &compose_file,
        project_dir: &results_dir,
        env_files: env_file_refs,
        working_dir: &context.base_dir,
        build: false,
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
        assert!(dir.path().join(super::super::RESULTS_DIR_NAME).join("docker-compose.yaml").exists());
    }

    #[test]
    fn test_run_docker_compose_up_missing_compose_file() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        // Create results dir but no docker-compose file
        fs::create_dir_all(dir.path().join(super::super::RESULTS_DIR_NAME)).unwrap();

        let client = ConfigurableMockClient::default();
        let result = run_docker_compose_up(&client, &context, false);

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

        let result = run_docker_compose_up(&client, &context, false);

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
        let result = run_docker_compose_up(&client, &context, false);

        assert!(result.is_ok());
    }

    #[test]
    fn test_run_docker_compose_up_with_env_files() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // Create env files that should be included
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::write(results_dir.join("generated-secrets.env"), "SECRET=value").unwrap();
        fs::write(results_dir.join("provided-secrets.env"), "API_KEY=key").unwrap();

        let client = ConfigurableMockClient::default();
        let result = run_docker_compose_up(&client, &context, false);

        assert!(result.is_ok());
    }

    #[test]
    fn test_run_docker_compose_up_always_builds() {
        use crate::package_manager::compose::docker::{
            CommandOutput, ComposeBuildOptions, ComposePassthroughOptions,
        };
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let dir = tempdir().unwrap();
        create_minimal_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        let build_called = Arc::new(AtomicBool::new(false));
        let no_cache_used = Arc::new(AtomicBool::new(false));
        let bc = Arc::clone(&build_called);
        let nc = Arc::clone(&no_cache_used);

        struct TrackingMock {
            build_called: Arc<AtomicBool>,
            no_cache_used: Arc<AtomicBool>,
        }
        impl DockerClient for TrackingMock {
            fn check_daemon(&self) -> crate::error::Result<String> {
                Ok("24.0.0".to_string())
            }
            fn compose_ps(&self, _: &str, _: &str) -> crate::error::Result<CommandOutput> {
                Ok(CommandOutput::success(""))
            }
            fn compose_logs(&self, _: &str, _: Option<&str>) -> crate::error::Result<CommandOutput> {
                Ok(CommandOutput::success(""))
            }
            fn compose_up(&self, options: &ComposeUpOptions) -> crate::error::Result<()> {
                assert!(!options.build, "compose_up should not use --build when compose_build is called separately");
                Ok(())
            }
            fn compose_build(&self, options: &ComposeBuildOptions) -> crate::error::Result<()> {
                self.build_called.store(true, Ordering::SeqCst);
                self.no_cache_used.store(options.no_cache, Ordering::SeqCst);
                Ok(())
            }
            fn compose_passthrough(&self, _: &ComposePassthroughOptions) -> crate::error::Result<()> {
                Ok(())
            }
            fn inspect_container(&self, _: &str) -> crate::error::Result<String> {
                Ok("{}".to_string())
            }
            fn list_containers(&self, _: &[(&str, &str)]) -> crate::error::Result<String> {
                Ok("[]".to_string())
            }
        }

        // Test with build_context_changed=false: build with cache
        let client = TrackingMock { build_called: Arc::clone(&build_called), no_cache_used: Arc::clone(&no_cache_used) };
        let result = run_docker_compose_up(&client, &context, false);
        assert!(result.is_ok());
        assert!(build_called.load(Ordering::SeqCst), "compose_build should always be called");
        assert!(!no_cache_used.load(Ordering::SeqCst), "no_cache should be false for normal deploys");

        // Reset and test with build_context_changed=true: build without cache
        build_called.store(false, Ordering::SeqCst);
        no_cache_used.store(false, Ordering::SeqCst);
        let client = TrackingMock { build_called: bc, no_cache_used: nc };
        let result = run_docker_compose_up(&client, &context, true);
        assert!(result.is_ok());
        assert!(build_called.load(Ordering::SeqCst), "compose_build should be called");
        assert!(no_cache_used.load(Ordering::SeqCst), "no_cache should be true when build context changed");
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

        let result = run_docker_compose_up(&client, &context, false);

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
