use std::collections::HashMap;
use std::fs;
use std::time::Duration;
use tracing::{debug, info, warn};

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

/// `--pull` policy passed to `docker compose up` when the user requests a pull.
pub(super) const UP_PULL_ALWAYS: &str = "always";

/// Collect the env files (`generated-secrets.env`, `provided-secrets.env`) that
/// exist in the results directory, in the order Docker Compose should load them.
///
/// Shared by the build/up step and the repair step so both run with an
/// identical env-file set.
fn deploy_env_files(results_dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut env_files = Vec::new();
    for name in ["generated-secrets.env", "provided-secrets.env"] {
        let path = results_dir.join(name);
        if path.exists() {
            env_files.push(path);
        }
    }
    env_files
}

/// How a deploy cycle should treat the Docker build cache and base images.
///
/// The routine path keeps `BuildPolicy::default()` (cache preserved, no pull):
/// a cached `docker compose build` rebuilds only the layers whose inputs
/// changed, and the image-ID comparison decides whether to recreate. The flags
/// are explicit escape hatches for inputs Docker cannot see locally (remote
/// `RUN` fetches, same-tag base-image updates).
#[derive(Debug, Clone, Copy, Default)]
pub(super) struct BuildPolicy {
    /// Force a full rebuild ignoring the layer cache (`--no-cache`).
    pub no_cache: bool,
    /// Always attempt to pull newer base images (`--pull`).
    pub pull: bool,
}

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
pub fn compose_up(watch: bool, debounce_ms: u64, no_cache: bool, pull: bool) -> Result<()> {
    let policy = BuildPolicy { no_cache, pull };
    let base_dir = find_manifest_dir()?;

    info!("Running compose up in: {}", base_dir.display());

    // Create Docker client (also checks Docker is available)
    let client = default_client()?;

    if watch {
        // In watch mode, a failed initial deploy is not fatal — print the
        // error and enter the watch loop so the user can fix & save.
        if let Err(e) = run_deploy_cycle(&base_dir, client.as_ref(), &policy) {
            eprintln!(
                "\n{} Initial deploy failed: {}\n       Fix the issue and save to retry.",
                "watch:".red().bold(),
                e
            );
        }
        super::watch::run_watch_loop(&base_dir, client.as_ref(), debounce_ms, policy)?;
    } else {
        run_deploy_cycle(&base_dir, client.as_ref(), &policy)?;
    }

    Ok(())
}

/// Execute the full deploy cycle: render, validate, compose up, health checks.
///
/// This is the core pipeline extracted so it can be called both for the initial
/// deploy and for each re-deploy triggered by the watch loop.
///
/// `policy` controls the Docker build cache and base-image pulling. The routine
/// path uses [`BuildPolicy::default`] (cache preserved); `--no-cache`/`--pull`
/// are only set from explicit CLI flags. Whether a container is recreated is
/// decided afterwards by comparing image IDs, not by the policy.
pub(super) fn run_deploy_cycle(
    base_dir: &std::path::Path,
    client: &dyn DockerClient,
    policy: &BuildPolicy,
) -> Result<()> {
    // Create render context
    let context = RenderContext::new(base_dir)?;

    // Fail early with a clear message if the project name is not a valid Docker
    // Compose project name — Compose rejects (does not normalize) such names,
    // and the synthesized default image tags depend on it being valid.
    validate_project_name(&context.manifest.project_name())?;

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

    // Run docker compose build + up
    run_docker_compose_up(client, &context, policy)?;

    // Run post-deployment health checks (waits for containers to become ready)
    run_post_deployment_checks(client, &context);

    // After containers have had time to start, guarantee each built service is
    // actually running the freshly built image (recreate it if not). Runs last
    // so the readiness window has elapsed and containers exist to inspect.
    verify_and_repair_images(client, &context)?;

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
/// The build keeps Docker's layer cache by default — BuildKit rebuilds only the
/// layers whose inputs changed. `policy.no_cache`/`policy.pull` (set only from
/// explicit CLI flags) force a full rebuild or a base-image pull. Container
/// recreation is handled separately by [`verify_and_repair_images`].
fn run_docker_compose_up(
    client: &dyn DockerClient,
    context: &RenderContext,
    policy: &BuildPolicy,
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

    // Collect env files (shared with the repair step in verify_and_repair_images).
    let env_files = deploy_env_files(&results_dir);
    let env_file_refs: Vec<&std::path::Path> = env_files.iter().map(|p| p.as_path()).collect();

    // Always run an explicit `docker compose build` before `docker compose up`.
    // Using `up --build` alone relies on Docker's inline build which may not
    // properly invalidate cache in all scenarios (e.g. multi-stage cargo-chef
    // builds). A separate build step is more reliable and gives clearer errors.
    // The cache is kept by default (BuildKit rebuilds only changed layers);
    // --no-cache/--pull are only applied when explicitly requested.
    let build_options = ComposeBuildOptions {
        project: &project_name,
        compose_file: &compose_file,
        project_dir: &results_dir,
        env_files: env_file_refs.clone(),
        working_dir: &context.base_dir,
        no_cache: policy.no_cache,
        pull: policy.pull,
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
        // Recreation is driven by the image-ID check, not forced here, so
        // unchanged services are not needlessly restarted.
        force_recreate: false,
        no_deps: false,
        pull: if policy.pull { Some(UP_PULL_ALWAYS) } else { None },
        services: vec![],
    };

    client.compose_up(&options)?;

    info!("Docker compose up completed successfully");
    Ok(())
}

/// Validate that a string is a usable Docker Compose project name.
///
/// Compose does not normalize project names — it rejects invalid ones — and the
/// default image tags we synthesize (`<project>-<service>:latest`) depend on the
/// name being valid. Surfacing a clear error here beats a cryptic `docker
/// compose` failure later.
fn validate_project_name(name: &str) -> Result<()> {
    let first_ok = name
        .chars()
        .next()
        .map(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        .unwrap_or(false);
    let rest_ok = name
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_');

    if first_ok && rest_ok {
        Ok(())
    } else {
        Err(crate::error::MowsError::Docker(format!(
            "Invalid project name '{}': Docker Compose project names must start with a \
             lowercase letter or digit and contain only lowercase letters, digits, '-' and '_'. \
             Rename it in mows-manifest.yaml (metadata.name).",
            name
        )))
    }
}

/// Collect the services in a rendered compose document that have a `build:`
/// section, together with their service definition (used to resolve the image
/// reference). Image-only services are excluded — there is nothing to rebuild.
fn build_services(compose: &serde_yaml_neo::Value) -> Vec<(String, serde_yaml_neo::Value)> {
    let mut out = Vec::new();
    if let Some(services) = compose.get("services").and_then(|s| s.as_mapping()) {
        for (name, svc) in services {
            // A null `build:` (e.g. `build:` with no value) is image-only — there
            // is nothing to rebuild, so it must not be treated as a build service.
            let has_build = svc.get("build").map(|b| !b.is_null()).unwrap_or(false);
            if has_build {
                if let Some(name_str) = name.as_str() {
                    out.push((name_str.to_string(), svc.clone()));
                }
            }
        }
    }
    out
}

/// Resolve the image reference Docker Compose will tag for a build service.
///
/// An explicit `image:` wins; otherwise Compose uses its default tag
/// `<project>-<service>:latest`. The bare form (no tag) is treated as `:latest`
/// by `docker image inspect`, so an explicit `image:` is passed through as-is.
///
/// `project_name` is expected to already be a valid (lowercase) Compose project
/// name (enforced by [`validate_project_name`]); the same string is used for the
/// `com.docker.compose.project` label filter, so both sides stay consistent.
fn image_ref_for_service(
    service: &serde_yaml_neo::Value,
    service_name: &str,
    project_name: &str,
) -> String {
    if let Some(image) = service.get("image").and_then(|v| v.as_str()) {
        return image.to_string();
    }
    format!("{}-{}:latest", project_name, service_name)
}

/// Return the image IDs (full `sha256:` digests) of the **running**, non-one-off
/// containers belonging to `service` in `project`.
///
/// Stopped/`exited` containers and one-off containers (from `docker compose run
/// <service>`, labelled `com.docker.compose.oneoff=True`) are excluded on
/// purpose: they carry stale image IDs but are NOT touched by
/// `up --force-recreate`, so counting them would wrongly flag a healthy service
/// as stale and hard-fail the deploy.
fn live_service_image_ids(
    client: &dyn DockerClient,
    project_name: &str,
    service_name: &str,
) -> Result<Vec<String>> {
    let project_filter = format!("com.docker.compose.project={}", project_name);
    let service_filter = format!("com.docker.compose.service={}", service_name);
    let filters = [
        ("label", project_filter.as_str()),
        ("label", service_filter.as_str()),
    ];

    let json = client.list_containers(&filters)?;
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| {
        crate::error::MowsError::Docker(format!("Failed to parse container list: {}", e))
    })?;

    let mut ids = Vec::new();
    if let Some(arr) = value.as_array() {
        for container in arr {
            // Only running containers reflect what `up --force-recreate` manages.
            // bollard serializes ContainerSummary.state lowercase ("running"/...).
            if container.get("State").and_then(|v| v.as_str()) != Some("running") {
                continue;
            }
            // Exclude one-off `docker compose run` containers: they share the
            // project+service labels but are never recreated by `up`.
            let is_oneoff = container
                .get("Labels")
                .and_then(|labels| labels.get("com.docker.compose.oneoff"))
                .and_then(|v| v.as_str())
                .map(|v| v.eq_ignore_ascii_case("true"))
                .unwrap_or(false);
            if is_oneoff {
                continue;
            }
            // bollard serializes the full digest under `ImageID`; `Image` is the
            // repo:tag string and must NOT be used for identity comparison.
            if let Some(id) = container.get("ImageID").and_then(|v| v.as_str()) {
                ids.push(id.to_string());
            }
        }
    }
    Ok(ids)
}

/// Determine which build services are running a different image than the one
/// just built, comparing against the freshly built image IDs in `built_ids`
/// (resolved once per deploy so the initial check and re-verify agree).
///
/// A service with no running containers (first deploy, profiled-out,
/// `replicas: 0`) is not stale; for replicas, a single mismatching container
/// marks the service stale. If a built service has running containers but its
/// built image could not be resolved, this is a hard error (a successful build
/// must have produced a local image) — never silently pass the gate.
fn collect_stale_services(
    client: &dyn DockerClient,
    services: &[(String, serde_yaml_neo::Value)],
    project_name: &str,
    built_ids: &HashMap<String, Option<String>>,
) -> Result<Vec<String>> {
    let mut stale = Vec::new();
    for (service_name, service_value) in services {
        let running = live_service_image_ids(client, project_name, service_name)?;
        if running.is_empty() {
            // No running container to compare against — nothing to recreate.
            continue;
        }

        let built = built_ids.get(service_name).and_then(|id| id.as_ref());
        match built {
            Some(built_id) => {
                if running.iter().any(|r| r != built_id) {
                    stale.push(service_name.clone());
                }
            }
            None => {
                let image_ref = image_ref_for_service(service_value, service_name, project_name);
                if image_ref.contains("${") {
                    // Unresolved Compose interpolation (e.g. `image: ${REG}/app:${TAG}`)
                    // survived into the rendered file; we cannot resolve the tag
                    // locally without `docker compose config`. Skip with a visible
                    // warning rather than hard-failing a legitimate configuration.
                    warn!(
                        "Image-id verification skipped for service '{}': image reference '{}' \
                         still contains unresolved Compose interpolation (${{...}})",
                        service_name, image_ref
                    );
                    continue;
                }
                // A successful `compose build` for this service must have produced
                // a local image; failing to resolve it is a real anomaly. Fail
                // loudly instead of leaving a possibly-stale container running.
                return Err(crate::error::MowsError::Docker(format!(
                    "Built image '{}' for service '{}' could not be resolved locally; \
                     cannot verify the running container is up to date",
                    image_ref, service_name
                )));
            }
        }
    }
    Ok(stale)
}

/// Guarantee every build service is running its freshly built image.
///
/// Compose's own `up -d` already recreates a service whose image ID changed,
/// but this is a deliberate safety net against version-specific recreate
/// regressions (docker/compose#9259, #9450): for any build service still
/// running a stale image, force-recreate exactly that service (`--no-deps`
/// keeps dependencies untouched). If a service is still stale afterwards, the
/// deploy fails loudly rather than silently leaving old code running.
fn verify_and_repair_images(client: &dyn DockerClient, context: &RenderContext) -> Result<()> {
    let project_name = context.manifest.project_name();
    let results_dir = context.base_dir.join(super::RESULTS_DIR_NAME);

    // Load the rendered compose. "No compose file" is fine (nothing to verify),
    // but a file that exists yet cannot be read/parsed must fail loudly rather
    // than silently skipping the whole image-verification safety net.
    let compose_file = match find_compose_file(&results_dir) {
        Some(path) => path,
        None => return Ok(()),
    };
    let compose: serde_yaml_neo::Value = {
        let content = fs::read_to_string(&compose_file).map_err(|e| {
            crate::error::MowsError::io("Failed to read docker-compose for image verification", e)
        })?;
        parse_yaml(&content, Some(&compose_file))?
    };

    let services = build_services(&compose);
    if services.is_empty() {
        return Ok(());
    }

    // Resolve each freshly built image ID ONCE, so the initial check and the
    // post-recreate re-verify compare against the same reference (and we don't
    // re-run `docker image inspect` on every pass). This also closes the narrow
    // window where a concurrent retag of `<project>-<svc>:latest` between passes
    // could flip the verdict.
    let mut built_ids: HashMap<String, Option<String>> = HashMap::new();
    for (service_name, service_value) in &services {
        let image_ref = image_ref_for_service(service_value, service_name, project_name);
        built_ids.insert(service_name.clone(), client.image_id(&image_ref)?);
    }

    let stale = collect_stale_services(client, &services, &project_name, &built_ids)?;
    if stale.is_empty() {
        return Ok(());
    }

    // Same env files as the build/up step.
    let env_files = deploy_env_files(&results_dir);
    let env_file_refs: Vec<&std::path::Path> = env_files.iter().map(|p| p.as_path()).collect();

    info!(
        "Recreating {} service(s) running a stale image: {:?}",
        stale.len(),
        stale
    );
    let service_refs: Vec<&str> = stale.iter().map(|s| s.as_str()).collect();
    let options = ComposeUpOptions {
        project: &project_name,
        compose_file: &compose_file,
        project_dir: &results_dir,
        env_files: env_file_refs,
        working_dir: &context.base_dir,
        build: false,
        detach: true,
        remove_orphans: false,
        force_recreate: true,
        no_deps: true,
        pull: None,
        services: service_refs,
    };
    client.compose_up(&options)?;

    // Re-verify against the same built IDs: a still-stale service means the
    // recreate did not take effect.
    let still_stale = collect_stale_services(client, &services, &project_name, &built_ids)?;
    if !still_stale.is_empty() {
        return Err(crate::error::MowsError::Docker(format!(
            "Services {:?} are still not running their freshly built image after --force-recreate",
            still_stale
        )));
    }

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
        let result = run_docker_compose_up(&client, &context, &BuildPolicy::default());

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

        let result = run_docker_compose_up(&client, &context, &BuildPolicy::default());

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
        let result = run_docker_compose_up(&client, &context, &BuildPolicy::default());

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
        let result = run_docker_compose_up(&client, &context, &BuildPolicy::default());

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
        let pull_used = Arc::new(AtomicBool::new(false));
        let bc = Arc::clone(&build_called);
        let nc = Arc::clone(&no_cache_used);
        let pu = Arc::clone(&pull_used);

        struct TrackingMock {
            build_called: Arc<AtomicBool>,
            no_cache_used: Arc<AtomicBool>,
            pull_used: Arc<AtomicBool>,
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
                assert!(!options.force_recreate, "routine up must not force-recreate");
                Ok(())
            }
            fn compose_build(&self, options: &ComposeBuildOptions) -> crate::error::Result<()> {
                self.build_called.store(true, Ordering::SeqCst);
                self.no_cache_used.store(options.no_cache, Ordering::SeqCst);
                self.pull_used.store(options.pull, Ordering::SeqCst);
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
            fn image_id(&self, _: &str) -> crate::error::Result<Option<String>> {
                Ok(None)
            }
        }

        // Routine deploy (default policy): build is always called, WITH cache.
        let client = TrackingMock {
            build_called: Arc::clone(&build_called),
            no_cache_used: Arc::clone(&no_cache_used),
            pull_used: Arc::clone(&pull_used),
        };
        let result = run_docker_compose_up(&client, &context, &BuildPolicy::default());
        assert!(result.is_ok());
        assert!(build_called.load(Ordering::SeqCst), "compose_build should always be called");
        assert!(!no_cache_used.load(Ordering::SeqCst), "no_cache must be false for routine deploys (cache preserved)");
        assert!(!pull_used.load(Ordering::SeqCst), "pull must be false by default");

        // Explicit override: --no-cache + --pull are forwarded to the build.
        build_called.store(false, Ordering::SeqCst);
        no_cache_used.store(false, Ordering::SeqCst);
        pull_used.store(false, Ordering::SeqCst);
        let client = TrackingMock { build_called: bc, no_cache_used: nc, pull_used: pu };
        let result = run_docker_compose_up(&client, &context, &BuildPolicy { no_cache: true, pull: true });
        assert!(result.is_ok());
        assert!(build_called.load(Ordering::SeqCst), "compose_build should be called");
        assert!(no_cache_used.load(Ordering::SeqCst), "no_cache should be true when explicitly requested");
        assert!(pull_used.load(Ordering::SeqCst), "pull should be true when explicitly requested");
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

        let result = run_docker_compose_up(&client, &context, &BuildPolicy::default());

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

    // =========================================================================
    // Image-ID verify-then-repair tests
    //
    // The contract: recreate a container ONLY when its image ID differs from
    // the freshly built image (rebuild-only-when-needed), but ALWAYS when it
    // differs (rebuild-when-needed), without ever using --no-cache.
    // =========================================================================

    use crate::package_manager::compose::docker::{CommandOutput, ComposePassthroughOptions};
    use std::sync::Mutex;

    /// Stateful mock reporting a freshly-built image id and the image id of the
    /// running container. A forced recreate optionally updates the running id
    /// to match the built id (simulating a successful recreate).
    struct VerifyMock {
        built: String,
        running: Mutex<Option<String>>,
        repair_fixes: bool,
        resolvable: bool,
        recreated: Mutex<Vec<Vec<String>>>,
    }

    impl VerifyMock {
        fn new(built: &str, running: Option<&str>, repair_fixes: bool) -> Self {
            Self {
                built: built.to_string(),
                running: Mutex::new(running.map(|s| s.to_string())),
                repair_fixes,
                resolvable: true,
                recreated: Mutex::new(Vec::new()),
            }
        }
        /// `image_id` returns `Ok(None)` — the built image cannot be resolved.
        fn unresolvable(mut self) -> Self {
            self.resolvable = false;
            self
        }
    }

    impl DockerClient for VerifyMock {
        fn check_daemon(&self) -> crate::error::Result<String> {
            Ok("mock".to_string())
        }
        fn compose_ps(&self, _: &str, _: &str) -> crate::error::Result<CommandOutput> {
            Ok(CommandOutput::success(""))
        }
        fn compose_logs(&self, _: &str, _: Option<&str>) -> crate::error::Result<CommandOutput> {
            Ok(CommandOutput::success(""))
        }
        fn compose_up(&self, options: &ComposeUpOptions) -> crate::error::Result<()> {
            if options.force_recreate {
                let svcs: Vec<String> = options.services.iter().map(|s| s.to_string()).collect();
                self.recreated.lock().unwrap().push(svcs);
                if self.repair_fixes {
                    *self.running.lock().unwrap() = Some(self.built.clone());
                }
            }
            Ok(())
        }
        fn compose_build(&self, _: &ComposeBuildOptions) -> crate::error::Result<()> {
            Ok(())
        }
        fn compose_passthrough(&self, _: &ComposePassthroughOptions) -> crate::error::Result<()> {
            Ok(())
        }
        fn inspect_container(&self, _: &str) -> crate::error::Result<String> {
            Ok("{}".to_string())
        }
        fn list_containers(&self, _: &[(&str, &str)]) -> crate::error::Result<String> {
            // Emit State (running), Image (repo:tag) and ImageID (digest) so tests
            // exercise the running-only filter and prove the code reads ImageID,
            // never Image.
            match &*self.running.lock().unwrap() {
                Some(id) => Ok(format!(
                    r#"[{{"State":"running","Image":"repo:tag","ImageID":"{}"}}]"#,
                    id
                )),
                None => Ok("[]".to_string()),
            }
        }
        fn image_id(&self, _: &str) -> crate::error::Result<Option<String>> {
            if self.resolvable {
                Ok(Some(self.built.clone()))
            } else {
                Ok(None)
            }
        }
    }

    fn create_build_project(dir: &std::path::Path) {
        fs::write(
            dir.join("mows-manifest.yaml"),
            "manifestVersion: \"0.1\"\nmetadata:\n  name: build-proj\nspec:\n  compose: {}\n",
        )
        .unwrap();
        fs::create_dir_all(dir.join("templates")).unwrap();
        fs::write(
            dir.join("templates/docker-compose.yaml"),
            "services:\n  web:\n    build: ./app\n    image: myapp:latest\n",
        )
        .unwrap();
    }

    #[test]
    fn test_verify_and_repair_no_change_does_not_recreate() {
        let dir = tempdir().unwrap();
        create_build_project(dir.path());
        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // Running image already matches the freshly built image.
        let mock = VerifyMock::new("sha256:same", Some("sha256:same"), false);
        assert!(verify_and_repair_images(&mock, &context).is_ok());
        assert!(
            mock.recreated.lock().unwrap().is_empty(),
            "unchanged image must NOT trigger a recreate (no needless restart)"
        );
    }

    #[test]
    fn test_verify_and_repair_recreates_stale_then_succeeds() {
        let dir = tempdir().unwrap();
        create_build_project(dir.path());
        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        let mock = VerifyMock::new("sha256:new", Some("sha256:old"), true);
        assert!(verify_and_repair_images(&mock, &context).is_ok());
        let recreated = mock.recreated.lock().unwrap();
        assert_eq!(recreated.len(), 1, "should force-recreate exactly once");
        assert_eq!(recreated[0], vec!["web".to_string()]);
    }

    #[test]
    fn test_verify_and_repair_hard_fails_when_recreate_ineffective() {
        let dir = tempdir().unwrap();
        create_build_project(dir.path());
        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // Recreate does not update the running image -> deploy must fail loudly.
        let mock = VerifyMock::new("sha256:new", Some("sha256:old"), false);
        let result = verify_and_repair_images(&mock, &context);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("still not running"));
    }

    #[test]
    fn test_verify_and_repair_hard_fails_when_built_image_unresolvable() {
        let dir = tempdir().unwrap();
        create_build_project(dir.path());
        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // A running container exists, but the freshly built image cannot be
        // resolved (non-interpolated ref) -> must fail loudly, never silently
        // leave the old container running.
        let mock = VerifyMock::new("sha256:new", Some("sha256:old"), false).unresolvable();
        let err = verify_and_repair_images(&mock, &context).unwrap_err().to_string();
        assert!(err.contains("could not be resolved locally"), "got: {err}");
        assert!(
            mock.recreated.lock().unwrap().is_empty(),
            "must not recreate when the built image cannot be verified"
        );
    }

    #[test]
    fn test_verify_and_repair_no_containers_is_noop() {
        let dir = tempdir().unwrap();
        create_build_project(dir.path());
        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        // First deploy / profiled-out / replicas=0: no container to compare.
        let mock = VerifyMock::new("sha256:new", None, false);
        assert!(verify_and_repair_images(&mock, &context).is_ok());
        assert!(mock.recreated.lock().unwrap().is_empty());
    }

    #[test]
    fn test_verify_and_repair_image_only_service_is_noop() {
        let dir = tempdir().unwrap();
        create_minimal_project(dir.path()); // nginx image-only service, no build
        let context = RenderContext::new(dir.path()).unwrap();
        run_render_pipeline(&context).unwrap();

        let mock = VerifyMock::new("sha256:x", Some("sha256:y"), false);
        assert!(
            verify_and_repair_images(&mock, &context).is_ok(),
            "image-only services have nothing to rebuild"
        );
        assert!(mock.recreated.lock().unwrap().is_empty());
    }

    fn web_build_services() -> Vec<(String, serde_yaml_neo::Value)> {
        let compose: serde_yaml_neo::Value =
            serde_yaml_neo::from_str("services:\n  web:\n    build: ./app\n    image: myapp:latest\n")
                .unwrap();
        build_services(&compose)
    }

    fn built_ids(pairs: &[(&str, Option<&str>)]) -> HashMap<String, Option<String>> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.map(|s| s.to_string())))
            .collect()
    }

    fn list_containers_mock(json: &str) -> ConfigurableMockClient {
        ConfigurableMockClient {
            list_containers: MockResponse::ok(json),
            ..Default::default()
        }
    }

    #[test]
    fn test_live_service_image_ids_uses_imageid_excludes_exited_and_oneoff() {
        // running non-one-off (counts), exited (ignored), running one-off (ignored).
        let mock = list_containers_mock(
            r#"[
                {"State":"running","Image":"repo:tag","ImageID":"sha256:new"},
                {"State":"exited","ImageID":"sha256:old"},
                {"State":"running","ImageID":"sha256:old","Labels":{"com.docker.compose.oneoff":"True"}}
            ]"#,
        );
        let ids = live_service_image_ids(&mock, "proj", "web").unwrap();
        assert_eq!(
            ids,
            vec!["sha256:new".to_string()],
            "only running, non-one-off containers count; exited + one-off excluded; reads ImageID not Image"
        );
    }

    #[test]
    fn test_collect_stale_services_match_vs_mismatch() {
        let services = web_build_services();

        // Running == built -> not stale.
        let m = VerifyMock::new("x", Some("sha256:A"), false);
        let b = built_ids(&[("web", Some("sha256:A"))]);
        assert!(collect_stale_services(&m, &services, "proj", &b).unwrap().is_empty());

        // Running != built -> stale.
        let m = VerifyMock::new("x", Some("sha256:B"), false);
        let b = built_ids(&[("web", Some("sha256:A"))]);
        assert_eq!(
            collect_stale_services(&m, &services, "proj", &b).unwrap(),
            vec!["web".to_string()]
        );

        // No running container -> not stale.
        let m = VerifyMock::new("x", None, false);
        let b = built_ids(&[("web", Some("sha256:A"))]);
        assert!(collect_stale_services(&m, &services, "proj", &b).unwrap().is_empty());
    }

    #[test]
    fn test_collect_stale_services_ignores_exited_and_oneoff() {
        // Healthy running container on the new image plus a leftover exited (old)
        // and a one-off (old) must NOT produce a false stale verdict.
        let mock = list_containers_mock(
            r#"[
                {"State":"running","ImageID":"sha256:new"},
                {"State":"exited","ImageID":"sha256:old"},
                {"State":"running","ImageID":"sha256:old","Labels":{"com.docker.compose.oneoff":"True"}}
            ]"#,
        );
        let b = built_ids(&[("web", Some("sha256:new"))]);
        assert!(
            collect_stale_services(&mock, &web_build_services(), "proj", &b)
                .unwrap()
                .is_empty(),
            "exited / one-off containers must not cause a false stale verdict (hard-fail regression)"
        );
    }

    #[test]
    fn test_collect_stale_services_replicas() {
        let services = web_build_services();
        let b = built_ids(&[("web", Some("sha256:new"))]);

        // All replicas on the new image -> not stale.
        let ok = list_containers_mock(
            r#"[{"State":"running","ImageID":"sha256:new"},{"State":"running","ImageID":"sha256:new"}]"#,
        );
        assert!(collect_stale_services(&ok, &services, "proj", &b).unwrap().is_empty());

        // One replica still on the old image -> stale.
        let stale = list_containers_mock(
            r#"[{"State":"running","ImageID":"sha256:new"},{"State":"running","ImageID":"sha256:old"}]"#,
        );
        assert_eq!(
            collect_stale_services(&stale, &services, "proj", &b).unwrap(),
            vec!["web".to_string()]
        );
    }

    #[test]
    fn test_collect_stale_services_unresolved_built_image_hard_fails() {
        // Containers run, but the built image id is unresolvable and the ref is
        // NOT interpolation -> must hard-fail rather than silently pass the gate.
        let mock = list_containers_mock(r#"[{"State":"running","ImageID":"sha256:old"}]"#);
        let b = built_ids(&[("web", None)]);
        let err = collect_stale_services(&mock, &web_build_services(), "proj", &b)
            .unwrap_err()
            .to_string();
        assert!(err.contains("could not be resolved locally"), "got: {err}");
    }

    #[test]
    fn test_collect_stale_services_interpolated_image_warns_and_skips() {
        // An unresolved ${...} image ref is a known limitation -> skip, not error.
        let mock = list_containers_mock(r#"[{"State":"running","ImageID":"sha256:old"}]"#);
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            "services:\n  web:\n    build: ./app\n    image: ${REGISTRY}/app:${TAG}\n",
        )
        .unwrap();
        let services = build_services(&compose);
        let b = built_ids(&[("web", None)]);
        assert!(
            collect_stale_services(&mock, &services, "proj", &b)
                .unwrap()
                .is_empty(),
            "interpolated image ref must be skipped (warned), not hard-fail"
        );
    }

    #[test]
    fn test_build_services_excludes_image_only_and_null_build() {
        // `web` is a real build service; `cache` is image-only; `nullbuild` has a
        // null `build:` (image-only) and must NOT be treated as a build service.
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            "services:\n  web:\n    build: ./app\n  cache:\n    image: redis:7\n  nullbuild:\n    build:\n    image: x\n",
        )
        .unwrap();
        let svcs = build_services(&compose);
        assert_eq!(svcs.len(), 1, "only the real build service is included");
        assert_eq!(svcs[0].0, "web");
    }

    #[test]
    fn test_image_ref_for_service_explicit_vs_default() {
        let explicit: serde_yaml_neo::Value =
            serde_yaml_neo::from_str("image: myapp:1.2\nbuild: ./app\n").unwrap();
        assert_eq!(image_ref_for_service(&explicit, "web", "proj"), "myapp:1.2");

        let no_image: serde_yaml_neo::Value =
            serde_yaml_neo::from_str("build: ./app\n").unwrap();
        assert_eq!(image_ref_for_service(&no_image, "web", "proj"), "proj-web:latest");
    }

    #[test]
    fn test_validate_project_name_accepts_valid() {
        for name in ["test-project", "abc_123", "a", "1app", "x-y_z"] {
            assert!(validate_project_name(name).is_ok(), "{} should be valid", name);
        }
    }

    #[test]
    fn test_validate_project_name_rejects_invalid() {
        for name in ["Test", "a.b", "", "-x", "My_Service", "app!"] {
            assert!(validate_project_name(name).is_err(), "{} should be invalid", name);
        }
    }
}
