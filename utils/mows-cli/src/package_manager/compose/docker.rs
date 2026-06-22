//! Docker client abstraction layer.
//!
//! This module provides a trait-based abstraction over Docker operations,
//! enabling testability and support for alternative container runtimes.
//!
//! ## Design
//!
//! The [`DockerClient`] trait abstracts Docker operations, allowing:
//! - Unit testing with mock implementations
//! - Alternative implementations (e.g., Podman)
//! - Pure-Rust Docker API via bollard for non-compose operations
//!
//! The [`BollardDockerClient`] implementation uses:
//! - `bollard` crate for native Docker API calls (inspect, version, ping)
//! - CLI for `docker compose` commands (not available in the bollard API)

use std::process::{Command, Output};
use tracing::debug;

use crate::error::{MowsError, Result};

/// Output from a Docker command execution.
#[derive(Debug, Clone)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

impl CommandOutput {
    /// Create a successful output with the given stdout.
    pub fn success(stdout: impl Into<String>) -> Self {
        Self {
            stdout: stdout.into(),
            stderr: String::new(),
            success: true,
        }
    }

}

impl From<Output> for CommandOutput {
    fn from(output: Output) -> Self {
        Self {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            success: output.status.success(),
        }
    }
}

/// Options for running docker compose up.
#[derive(Debug)]
pub struct ComposeUpOptions<'a> {
    /// Project name (-p)
    pub project: &'a str,
    /// Path to compose file (-f)
    pub compose_file: &'a std::path::Path,
    /// Project directory (--project-directory)
    pub project_dir: &'a std::path::Path,
    /// Environment files (--env-file)
    pub env_files: Vec<&'a std::path::Path>,
    /// Working directory for the command
    pub working_dir: &'a std::path::Path,
    /// Whether to build images (--build)
    pub build: bool,
    /// Whether to run detached (-d)
    pub detach: bool,
    /// Whether to remove orphans (--remove-orphans)
    pub remove_orphans: bool,
    /// Whether to force-recreate containers (--force-recreate)
    pub force_recreate: bool,
    /// Whether to leave dependencies untouched (--no-deps)
    pub no_deps: bool,
    /// Pull policy (`--pull <policy>`, e.g. "always"); `None` omits the flag.
    pub pull: Option<&'a str>,
    /// Limit the command to these services (positional args); empty = all services.
    pub services: Vec<&'a str>,
}

/// Options for running docker compose build.
#[derive(Debug)]
pub struct ComposeBuildOptions<'a> {
    /// Project name (-p)
    pub project: &'a str,
    /// Path to compose file (-f)
    pub compose_file: &'a std::path::Path,
    /// Project directory (--project-directory)
    pub project_dir: &'a std::path::Path,
    /// Environment files (--env-file)
    pub env_files: Vec<&'a std::path::Path>,
    /// Working directory for the command
    pub working_dir: &'a std::path::Path,
    /// Whether to skip the build cache (--no-cache)
    pub no_cache: bool,
    /// Whether to always attempt to pull newer base images (--pull)
    pub pull: bool,
}

/// Build the argument list that follows `docker compose ... up` for the given
/// options, in the exact order it is passed to Docker.
///
/// Positional service filters must come after every flag, so they are appended
/// last. Extracted as a pure function so the flag logic can be unit-tested
/// without spawning a Docker process.
fn compose_up_post_args(options: &ComposeUpOptions) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    if options.build {
        args.push("--build".to_string());
    }
    if options.force_recreate {
        args.push("--force-recreate".to_string());
    }
    if options.no_deps {
        args.push("--no-deps".to_string());
    }
    if let Some(pull) = options.pull {
        args.push("--pull".to_string());
        args.push(pull.to_string());
    }
    if options.detach {
        args.push("-d".to_string());
    }
    if options.remove_orphans {
        args.push("--remove-orphans".to_string());
    }
    // End-of-options separator so a service named like a flag (e.g. `--build`,
    // `-d`) is parsed as a SERVICE filter, not an option.
    if !options.services.is_empty() {
        args.push("--".to_string());
        for service in &options.services {
            args.push((*service).to_string());
        }
    }
    args
}

/// Build the argument list that follows `docker compose ... build` for the
/// given options. Extracted as a pure function for unit testing.
fn compose_build_post_args(options: &ComposeBuildOptions) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    if options.no_cache {
        args.push("--no-cache".to_string());
    }
    if options.pull {
        args.push("--pull".to_string());
    }
    args
}

/// Options for running docker compose passthrough.
#[derive(Debug)]
pub struct ComposePassthroughOptions<'a> {
    /// Project name (-p)
    pub project: &'a str,
    /// Path to compose file (-f)
    pub compose_file: &'a std::path::Path,
    /// Project directory (--project-directory)
    pub project_dir: &'a std::path::Path,
    /// Environment files (--env-file)
    pub env_files: Vec<&'a std::path::Path>,
    /// Working directory for the command
    pub working_dir: &'a std::path::Path,
    /// Arguments to pass through
    pub args: &'a [String],
}

/// Trait for Docker client operations.
///
/// This abstraction allows for:
/// - Unit testing with mock implementations
/// - Alternative container runtime support (e.g., Podman)
/// - Centralized error handling and logging
pub trait DockerClient: Send + Sync {
    /// Check if Docker daemon is running and return its version.
    fn check_daemon(&self) -> Result<String>;

    /// Run `docker compose ps` and return container status.
    fn compose_ps(&self, project: &str, format: &str) -> Result<CommandOutput>;

    /// Run `docker compose logs` with optional time filter.
    fn compose_logs(&self, project: &str, since: Option<&str>) -> Result<CommandOutput>;

    /// Run docker compose up with full options.
    fn compose_up(&self, options: &ComposeUpOptions) -> Result<()>;

    /// Run docker compose build with options.
    fn compose_build(&self, options: &ComposeBuildOptions) -> Result<()>;

    /// Run arbitrary docker compose command with inherited stdio (for interactive commands).
    fn compose_passthrough(&self, options: &ComposePassthroughOptions) -> Result<()>;

    /// Inspect a container and return JSON output.
    fn inspect_container(&self, container: &str) -> Result<String>;

    /// List containers with optional filters, returning JSON array.
    fn list_containers(&self, filters: &[(&str, &str)]) -> Result<String>;

    /// Resolve an image reference (tag or id) to its full image ID (`sha256:...`).
    ///
    /// Returns `Ok(None)` if the image does not exist locally. This is the
    /// ground-truth identity used to decide whether a freshly built image
    /// differs from the one a running container uses.
    fn image_id(&self, image_ref: &str) -> Result<Option<String>>;
}

/// Docker client using bollard for native API calls and CLI for compose.
pub struct BollardDockerClient {
    docker: bollard::Docker,
    runtime: tokio::runtime::Runtime,
}

impl std::fmt::Debug for BollardDockerClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BollardDockerClient").finish()
    }
}

impl BollardDockerClient {
    /// Create a new Docker client connecting to the local daemon.
    pub fn new() -> Result<Self> {
        let docker = bollard::Docker::connect_with_local_defaults().map_err(|e| {
            if e.to_string().contains("No such file") || e.to_string().contains("connection refused")
            {
                MowsError::Docker(format!(
                    r#"Cannot connect to Docker daemon. Is Docker running?
Try: sudo systemctl start docker
Or add your user to the docker group: sudo usermod -aG docker $USER
Error: {}"#,
                    e
                ))
            } else {
                MowsError::Docker(format!("Failed to connect to Docker: {}", e))
            }
        })?;

        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| MowsError::Docker(format!("Failed to create tokio runtime: {}", e)))?;

        Ok(Self { docker, runtime })
    }

    /// Execute a docker compose command with the given arguments.
    fn run_compose(&self, args: &[&str]) -> Result<CommandOutput> {
        let full_args: Vec<&str> = std::iter::once("compose").chain(args.iter().copied()).collect();
        debug!("Running: docker {}", full_args.join(" "));

        let output = Command::new("docker")
            .args(&full_args)
            .output()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    MowsError::Docker(
                        "Docker is not installed or not in PATH. Please install Docker first."
                            .to_string(),
                    )
                } else {
                    MowsError::command(&format!("docker {}", full_args.join(" ")), e.to_string())
                }
            })?;

        Ok(CommandOutput::from(output))
    }
}

impl DockerClient for BollardDockerClient {
    fn check_daemon(&self) -> Result<String> {
        debug!("Checking Docker daemon via bollard API");
        self.runtime.block_on(async {
            // Ping to verify connectivity
            self.docker.ping().await.map_err(|e| {
                let msg = e.to_string();
                if msg.contains("Cannot connect") || msg.contains("permission denied") {
                    MowsError::Docker(format!(
                        r#"Cannot connect to Docker daemon. Is Docker running?
Try: sudo systemctl start docker
Or add your user to the docker group: sudo usermod -aG docker $USER
Error: {}"#,
                        msg
                    ))
                } else {
                    MowsError::Docker(format!("Docker daemon check failed: {}", msg))
                }
            })?;

            // Get version
            let version = self.docker.version().await.map_err(|e| {
                MowsError::Docker(format!("Failed to get Docker version: {}", e))
            })?;

            Ok(version.version.unwrap_or_else(|| "unknown".to_string()))
        })
    }

    fn compose_ps(&self, project: &str, format: &str) -> Result<CommandOutput> {
        self.run_compose(&["-p", project, "ps", "--format", format])
    }

    fn compose_logs(&self, project: &str, since: Option<&str>) -> Result<CommandOutput> {
        let mut args = vec!["-p", project, "logs", "--no-color"];
        if let Some(s) = since {
            args.push("--since");
            args.push(s);
        }
        self.run_compose(&args)
    }

    fn compose_up(&self, options: &ComposeUpOptions) -> Result<()> {
        debug!("Running docker compose up for project: {}", options.project);

        let mut cmd = Command::new("docker");
        cmd.arg("compose")
            .arg("-p")
            .arg(options.project)
            .arg("--project-directory")
            .arg(options.project_dir)
            .arg("-f")
            .arg(options.compose_file);

        for env_file in &options.env_files {
            cmd.arg("--env-file").arg(env_file);
        }

        cmd.arg("up");
        for arg in compose_up_post_args(options) {
            cmd.arg(arg);
        }

        cmd.current_dir(options.working_dir);
        debug!("Executing: {:?}", cmd);

        let status = cmd
            .status()
            .map_err(|e| MowsError::command("docker compose up", e.to_string()))?;

        if !status.success() {
            return Err(MowsError::Docker(format!(
                "docker compose up failed with exit code {}",
                status.code().unwrap_or(-1),
            )));
        }

        Ok(())
    }

    fn compose_build(&self, options: &ComposeBuildOptions) -> Result<()> {
        debug!("Running docker compose build for project: {}", options.project);

        let mut cmd = Command::new("docker");
        cmd.arg("compose")
            .arg("-p")
            .arg(options.project)
            .arg("--project-directory")
            .arg(options.project_dir)
            .arg("-f")
            .arg(options.compose_file);

        for env_file in &options.env_files {
            cmd.arg("--env-file").arg(env_file);
        }

        cmd.arg("build");
        for arg in compose_build_post_args(options) {
            cmd.arg(arg);
        }

        cmd.current_dir(options.working_dir);
        debug!("Executing: {:?}", cmd);

        let status = cmd
            .status()
            .map_err(|e| MowsError::command("docker compose build", e.to_string()))?;

        if !status.success() {
            return Err(MowsError::Docker(format!(
                "docker compose build failed with exit code {}",
                status.code().unwrap_or(-1),
            )));
        }

        Ok(())
    }

    fn compose_passthrough(&self, options: &ComposePassthroughOptions) -> Result<()> {
        debug!("Running docker compose passthrough for project: {}", options.project);

        let mut cmd = Command::new("docker");
        cmd.arg("compose")
            .arg("-p")
            .arg(options.project)
            .arg("--project-directory")
            .arg(options.project_dir)
            .arg("-f")
            .arg(options.compose_file);

        for env_file in &options.env_files {
            cmd.arg("--env-file").arg(env_file);
        }

        for arg in options.args {
            cmd.arg(arg);
        }

        cmd.current_dir(options.working_dir);
        debug!("Executing: {:?}", cmd);

        // Execute with inherited stdio for interactive commands
        let status = cmd
            .status()
            .map_err(|e| MowsError::command("docker compose", e.to_string()))?;

        if !status.success() {
            return Err(MowsError::Docker(format!(
                "docker compose failed with exit code: {}",
                status.code().unwrap_or(-1)
            )));
        }

        Ok(())
    }

    fn inspect_container(&self, container: &str) -> Result<String> {
        debug!("Inspecting container via bollard: {}", container);
        self.runtime.block_on(async {
            let info = self
                .docker
                .inspect_container(container, None::<bollard::query_parameters::InspectContainerOptions>)
                .await
                .map_err(|e| MowsError::Docker(format!("Failed to inspect container '{}': {}", container, e)))?;

            serde_json::to_string(&info)
                .map_err(|e| MowsError::Docker(format!("Failed to serialize container info: {}", e)))
        })
    }

    fn list_containers(&self, filters: &[(&str, &str)]) -> Result<String> {
        debug!("Listing containers via bollard with {} filters", filters.len());
        self.runtime.block_on(async {
            use bollard::query_parameters::ListContainersOptionsBuilder;
            use std::collections::HashMap;

            let mut filter_map: HashMap<String, Vec<String>> = HashMap::new();
            for (key, value) in filters {
                filter_map
                    .entry(key.to_string())
                    .or_default()
                    .push(value.to_string());
            }

            let options = ListContainersOptionsBuilder::default()
                .all(true)
                .filters(&filter_map)
                .build();

            let containers = self
                .docker
                .list_containers(Some(options))
                .await
                .map_err(|e| MowsError::Docker(format!("Failed to list containers: {}", e)))?;

            serde_json::to_string(&containers)
                .map_err(|e| MowsError::Docker(format!("Failed to serialize container list: {}", e)))
        })
    }

    fn image_id(&self, image_ref: &str) -> Result<Option<String>> {
        debug!("Resolving image id for: {}", image_ref);
        // Use the CLI rather than the bollard inspect_image API: `docker image
        // inspect --format '{{.Id}}'` returns the full `sha256:` digest in the
        // exact same form as a container's `.ImageID` field, so the two can be
        // compared byte-for-byte without normalization.
        // `--` so an image ref that looks like a flag (e.g. `--format`) is treated
        // as the positional image argument, not an option.
        let output = Command::new("docker")
            .args(["image", "inspect", "--format", "{{.Id}}", "--", image_ref])
            .output()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    MowsError::Docker(
                        "Docker is not installed or not in PATH. Please install Docker first."
                            .to_string(),
                    )
                } else {
                    MowsError::command("docker image inspect", e.to_string())
                }
            })?;

        if !output.status.success() {
            // Distinguish "image absent locally" (the expected Ok(None) case) from
            // real failures (daemon down, permission denied, invalid reference).
            // Collapsing all of these to Ok(None) would let the verify gate pass
            // silently on a genuine error.
            let stderr = String::from_utf8_lossy(&output.stderr);
            let lower = stderr.to_ascii_lowercase();
            if lower.contains("no such image") || lower.contains("no such object") {
                return Ok(None);
            }
            return Err(MowsError::Docker(format!(
                "docker image inspect '{}' failed: {}",
                image_ref,
                stderr.trim()
            )));
        }

        let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if id.is_empty() {
            Ok(None)
        } else {
            Ok(Some(id))
        }
    }
}

/// Environment variable to enable mock Docker client.
///
/// When set to "1", `default_client()` returns a mock implementation that
/// simulates Docker operations without requiring a real Docker daemon.
/// This is useful for running e2e tests in CI environments without Docker.
///
/// # Example
/// ```bash
/// export MPM_MOCK_DOCKER=1
/// mows package-manager compose up  # Uses mock Docker client
/// ```
pub const ENV_MOCK_DOCKER: &str = "MPM_MOCK_DOCKER";

/// Test-only knob (effective only with `MPM_MOCK_DOCKER=1`): when set to "1", the
/// mock simulates a build service whose running container is on an OLD image —
/// `image_id` reports a fresh build id while `list_containers` reports a running
/// container with a different (stale) `ImageID`. This drives the image-id
/// verify/repair path end-to-end (force-recreate + the post-recreate hard-fail,
/// since the mock is stateless and stays stale) so the wiring is covered in E2E.
pub const ENV_MOCK_STALE: &str = "MPM_MOCK_STALE";

fn mock_stale_enabled() -> bool {
    std::env::var(ENV_MOCK_STALE).map(|v| v == "1").unwrap_or(false)
}

/// Create a default Docker client.
///
/// Returns a mock client if `MPM_MOCK_DOCKER=1` is set, otherwise returns
/// a real Docker client using bollard.
///
/// # Environment Variables
/// - `MPM_MOCK_DOCKER`: Set to "1" to use mock client (for testing without Docker)
pub fn default_client() -> Result<Box<dyn DockerClient>> {
    if std::env::var(ENV_MOCK_DOCKER).map(|v| v == "1").unwrap_or(false) {
        debug!("Using mock Docker client ({}=1)", ENV_MOCK_DOCKER);
        Ok(Box::new(MockDockerClient::default()))
    } else {
        Ok(Box::new(BollardDockerClient::new()?))
    }
}

// ============================================================================
// Mock Docker client - available for testing without Docker daemon
// ============================================================================

/// Mock Docker client for testing without a real Docker daemon.
///
/// This client simulates Docker operations by returning realistic mock responses.
/// It's enabled by setting `MPM_MOCK_DOCKER=1` environment variable.
///
/// The mock provides sensible defaults:
/// - `check_daemon`: Returns version "24.0.0 (mock)"
/// - `compose_ps`: Returns containers as running and healthy
/// - `compose_logs`: Returns empty logs
/// - `compose_up`: Succeeds immediately
/// - `compose_passthrough`: Succeeds immediately
/// - `inspect_container`: Returns minimal container info
/// - `list_containers`: Returns empty list (no conflicting containers)
#[derive(Debug, Clone, Default)]
pub struct MockDockerClient;

impl DockerClient for MockDockerClient {
    fn check_daemon(&self) -> Result<String> {
        debug!("Mock: check_daemon");
        Ok("24.0.0 (mock)".to_string())
    }

    fn compose_ps(&self, project: &str, format: &str) -> Result<CommandOutput> {
        debug!("Mock: compose_ps project={} format={}", project, format);
        // Return format depends on what was requested
        // Common formats: "{{.Name}}\t{{.Status}}\t{{.Health}}" or "{{.Status}}\t{{.Health}}"
        let output = if format.contains("{{.Name}}") {
            format!("{}-web-1\tUp 10 seconds\thealthy", project)
        } else {
            "Up 10 seconds\thealthy".to_string()
        };
        Ok(CommandOutput::success(output))
    }

    fn compose_logs(&self, project: &str, since: Option<&str>) -> Result<CommandOutput> {
        debug!("Mock: compose_logs project={} since={:?}", project, since);
        Ok(CommandOutput::success(""))
    }

    fn compose_up(&self, options: &ComposeUpOptions) -> Result<()> {
        debug!(
            "Mock: compose_up project={} build={} force_recreate={}",
            options.project, options.build, options.force_recreate
        );
        // Print to stdout so E2E tests can observe a forced recreate (the repair
        // step) without a real Docker daemon.
        if options.force_recreate {
            use std::io::Write;
            println!(
                "mock: compose_up project={} force_recreate=true services={:?}",
                options.project, options.services
            );
            let _ = std::io::stdout().flush();
        }
        Ok(())
    }

    fn compose_build(&self, options: &ComposeBuildOptions) -> Result<()> {
        debug!("Mock: compose_build project={} no_cache={}", options.project, options.no_cache);
        // Print to stdout so E2E tests can verify the flag was passed
        use std::io::Write;
        println!("mock: compose_build project={} no_cache={}", options.project, options.no_cache);
        let _ = std::io::stdout().flush();
        Ok(())
    }

    fn compose_passthrough(&self, options: &ComposePassthroughOptions) -> Result<()> {
        debug!("Mock: compose_passthrough project={} args={:?}", options.project, options.args);
        Ok(())
    }

    fn inspect_container(&self, container: &str) -> Result<String> {
        debug!("Mock: inspect_container {}", container);
        Ok(format!(r#"{{"Id": "mock-{}", "Name": "/{}", "State": {{"Running": true}}}}"#, container, container))
    }

    fn list_containers(&self, filters: &[(&str, &str)]) -> Result<String> {
        debug!("Mock: list_containers filters={:?}", filters);
        if mock_stale_enabled() {
            // One running, non-one-off container on a STALE image id, so the
            // image-id verify flags the service and exercises the repair path.
            return Ok(r#"[{"State":"running","Image":"mock:tag","ImageID":"sha256:stale-running-container"}]"#.to_string());
        }
        // Return empty list - no conflicting containers
        Ok("[]".to_string())
    }

    fn image_id(&self, image_ref: &str) -> Result<Option<String>> {
        debug!("Mock: image_id {}", image_ref);
        if mock_stale_enabled() {
            // Fresh build id, deliberately different from the stale running
            // container above, so every build service is detected as stale.
            return Ok(Some("sha256:fresh-built-image".to_string()));
        }
        // Deterministic fake digest. The image-id verify only compares this
        // against running containers, and the mock reports no containers
        // (`list_containers` => []), so the value is never actually matched.
        Ok(Some(format!("sha256:mock-{}", image_ref)))
    }
}

// ============================================================================
// Test utilities - configurable mock for unit tests
// ============================================================================

/// Mock response for Docker operations in unit tests.
#[cfg(test)]
#[derive(Clone, Default)]
pub struct MockResponse {
    /// If Some, return Ok with this value. If None, use error_msg.
    pub success_value: Option<String>,
    /// If Some and success_value is None, return Err with this message.
    pub error_msg: Option<String>,
}

#[cfg(test)]
impl MockResponse {
    pub fn ok(value: impl Into<String>) -> Self {
        Self {
            success_value: Some(value.into()),
            error_msg: None,
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self {
            success_value: None,
            error_msg: Some(msg.into()),
        }
    }

    pub fn to_result(&self, default: &str) -> Result<String> {
        if let Some(ref value) = self.success_value {
            Ok(value.clone())
        } else if let Some(ref message) = self.error_msg {
            Err(MowsError::Docker(message.clone()))
        } else {
            Ok(default.to_string())
        }
    }

    pub fn to_command_output(&self) -> Result<CommandOutput> {
        if let Some(ref value) = self.success_value {
            Ok(CommandOutput::success(value.clone()))
        } else if let Some(ref message) = self.error_msg {
            Err(MowsError::Docker(message.clone()))
        } else {
            Ok(CommandOutput::success(""))
        }
    }

    /// Convert to a Result<()> for operations that don't return data
    pub fn to_unit_result(&self) -> Result<()> {
        if let Some(ref message) = self.error_msg {
            Err(MowsError::Docker(message.clone()))
        } else {
            Ok(())
        }
    }
}

/// Configurable mock Docker client for unit tests.
///
/// Unlike `MockDockerClient` which provides sensible defaults for e2e tests,
/// this client allows configuring specific responses for each operation.
#[cfg(test)]
#[derive(Clone, Default)]
pub struct ConfigurableMockClient {
    pub daemon: MockResponse,
    pub compose_ps: MockResponse,
    pub compose_logs: MockResponse,
    pub compose_up: MockResponse,
    pub compose_build: MockResponse,
    pub compose_passthrough: MockResponse,
    pub inspect_container: MockResponse,
    pub list_containers: MockResponse,
    /// Response for `image_id`: `success_value` => `Some(id)`, `error_msg` =>
    /// `Err`, neither (the default) => `Ok(None)` (image not found).
    pub image_id: MockResponse,
}

#[cfg(test)]
impl DockerClient for ConfigurableMockClient {
    fn check_daemon(&self) -> Result<String> {
        self.daemon.to_result("24.0.0")
    }

    fn compose_ps(&self, _project: &str, _format: &str) -> Result<CommandOutput> {
        self.compose_ps.to_command_output()
    }

    fn compose_logs(&self, _project: &str, _since: Option<&str>) -> Result<CommandOutput> {
        self.compose_logs.to_command_output()
    }

    fn compose_up(&self, _options: &ComposeUpOptions) -> Result<()> {
        self.compose_up.to_unit_result()
    }

    fn compose_build(&self, _options: &ComposeBuildOptions) -> Result<()> {
        self.compose_build.to_unit_result()
    }

    fn compose_passthrough(&self, _options: &ComposePassthroughOptions) -> Result<()> {
        self.compose_passthrough.to_unit_result()
    }

    fn inspect_container(&self, _container: &str) -> Result<String> {
        self.inspect_container.to_result("{}")
    }

    fn list_containers(&self, _filters: &[(&str, &str)]) -> Result<String> {
        self.list_containers.to_result("[]")
    }

    fn image_id(&self, _image_ref: &str) -> Result<Option<String>> {
        match (&self.image_id.success_value, &self.image_id.error_msg) {
            (Some(value), _) => Ok(Some(value.clone())),
            (None, Some(message)) => Err(MowsError::Docker(message.clone())),
            (None, None) => Ok(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn test_command_output_success() {
        let output = CommandOutput::success("hello");
        assert!(output.success);
        assert_eq!(output.stdout, "hello");
        assert!(output.stderr.is_empty());
    }

    #[test]
    fn test_mock_docker_client() {
        let mock = MockDockerClient::default();
        let result = mock.check_daemon();
        assert!(result.is_ok());
        assert!(result.unwrap().contains("mock"));
    }

    #[test]
    fn test_configurable_mock_client() {
        let mock = ConfigurableMockClient {
            daemon: MockResponse::ok("25.0.0"),
            ..Default::default()
        };

        let result = mock.check_daemon();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "25.0.0");
    }

    #[test]
    fn test_configurable_mock_client_failure() {
        let mock = ConfigurableMockClient {
            daemon: MockResponse::err("Not running"),
            ..Default::default()
        };

        let result = mock.check_daemon();
        assert!(result.is_err());
    }

    #[test]
    fn test_docker_client_trait_object() {
        // Verify the trait can be used as a trait object
        let client: Arc<dyn DockerClient> = Arc::new(MockDockerClient::default());
        assert!(client.check_daemon().is_ok());
    }

    #[test]
    fn test_configurable_mock_inspect_container() {
        let mock = ConfigurableMockClient {
            inspect_container: MockResponse::ok(r#"{"Id": "abc123"}"#),
            ..Default::default()
        };

        let result = mock.inspect_container("test-container");
        assert!(result.is_ok());
        assert!(result.unwrap().contains("abc123"));
    }

    #[test]
    fn test_configurable_mock_list_containers() {
        let mock = ConfigurableMockClient {
            list_containers: MockResponse::ok(r#"[{"Id": "container1"}]"#),
            ..Default::default()
        };

        let result = mock.list_containers(&[("label", "app=test")]);
        assert!(result.is_ok());
        assert!(result.unwrap().contains("container1"));
    }

    #[test]
    fn test_default_client_returns_mock_when_env_set() {
        std::env::set_var(ENV_MOCK_DOCKER, "1");
        let client = default_client();
        assert!(client.is_ok());
        let version = client.unwrap().check_daemon().unwrap();
        assert!(version.contains("mock"));
        std::env::remove_var(ENV_MOCK_DOCKER);
    }

    // =========================================================================
    // Error Scenario Tests (#9) - Testing error paths with configurable mock
    // =========================================================================

    #[test]
    fn test_daemon_connection_failure() {
        let mock = ConfigurableMockClient {
            daemon: MockResponse::err("Cannot connect to the Docker daemon"),
            ..Default::default()
        };

        let result = mock.check_daemon();
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Cannot connect"));
    }

    #[test]
    fn test_compose_ps_failure() {
        let mock = ConfigurableMockClient {
            compose_ps: MockResponse::err("no configuration file provided"),
            ..Default::default()
        };

        let result = mock.compose_ps("test-project", "{{.Name}}");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("no configuration"));
    }

    #[test]
    fn test_compose_logs_failure() {
        let mock = ConfigurableMockClient {
            compose_logs: MockResponse::err("service not found"),
            ..Default::default()
        };

        let result = mock.compose_logs("test-project", Some("5m"));
        assert!(result.is_err());
    }

    #[test]
    fn test_inspect_container_not_found() {
        let mock = ConfigurableMockClient {
            inspect_container: MockResponse::err("Error: No such container: nonexistent"),
            ..Default::default()
        };

        let result = mock.inspect_container("nonexistent");
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No such container"));
    }

    #[test]
    fn test_list_containers_permission_denied() {
        let mock = ConfigurableMockClient {
            list_containers: MockResponse::err("permission denied while trying to connect"),
            ..Default::default()
        };

        let result = mock.list_containers(&[]);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("permission denied"));
    }

    #[test]
    fn test_all_operations_fail_when_daemon_down() {
        let mock = ConfigurableMockClient {
            daemon: MockResponse::err("Cannot connect to the Docker daemon"),
            compose_ps: MockResponse::err("Cannot connect to the Docker daemon"),
            compose_logs: MockResponse::err("Cannot connect to the Docker daemon"),
            compose_up: MockResponse::err("Cannot connect to the Docker daemon"),
            compose_build: MockResponse::err("Cannot connect to the Docker daemon"),
            compose_passthrough: MockResponse::err("Cannot connect to the Docker daemon"),
            inspect_container: MockResponse::err("Cannot connect to the Docker daemon"),
            list_containers: MockResponse::err("Cannot connect to the Docker daemon"),
            image_id: MockResponse::err("Cannot connect to the Docker daemon"),
        };

        assert!(mock.check_daemon().is_err());
        assert!(mock.compose_ps("test", "{{.Name}}").is_err());
        assert!(mock.compose_logs("test", None).is_err());
        assert!(mock.inspect_container("test").is_err());
        assert!(mock.list_containers(&[]).is_err());
        assert!(mock.image_id("test:latest").is_err());
    }

    #[test]
    fn test_compose_up_failure() {
        let mock = ConfigurableMockClient {
            compose_up: MockResponse::err("no configuration file provided"),
            ..Default::default()
        };

        let options = ComposeUpOptions {
            project: "test",
            compose_file: std::path::Path::new("/nonexistent/docker-compose.yaml"),
            project_dir: std::path::Path::new("/nonexistent"),
            env_files: vec![],
            working_dir: std::path::Path::new("/nonexistent"),
            build: false,
            detach: true,
            remove_orphans: false,
            force_recreate: false,
            no_deps: false,
            pull: None,
            services: vec![],
        };

        let result = mock.compose_up(&options);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("no configuration file"));
    }

    #[test]
    fn test_compose_passthrough_failure() {
        let mock = ConfigurableMockClient {
            compose_passthrough: MockResponse::err("unknown command"),
            ..Default::default()
        };

        let args = vec!["invalid-command".to_string()];
        let options = ComposePassthroughOptions {
            project: "test",
            compose_file: std::path::Path::new("/nonexistent/docker-compose.yaml"),
            project_dir: std::path::Path::new("/nonexistent"),
            env_files: vec![],
            working_dir: std::path::Path::new("/nonexistent"),
            args: &args,
        };

        let result = mock.compose_passthrough(&options);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("unknown command"));
    }

    #[test]
    fn test_partial_failure_scenario() {
        // Simulate daemon up but compose project not found
        let mock = ConfigurableMockClient {
            daemon: MockResponse::ok("24.0.0"),
            compose_ps: MockResponse::err("no containers found for project test"),
            compose_logs: MockResponse::err("no containers found for project test"),
            ..Default::default()
        };

        assert!(mock.check_daemon().is_ok());
        assert!(mock.compose_ps("test", "{{.Name}}").is_err());
        assert!(mock.compose_logs("test", None).is_err());
    }

    #[test]
    fn test_empty_response_handling() {
        let mock = ConfigurableMockClient {
            compose_ps: MockResponse::ok(""),
            list_containers: MockResponse::ok("[]"),
            ..Default::default()
        };

        let ps_result = mock.compose_ps("test", "{{.Name}}");
        assert!(ps_result.is_ok());
        assert!(ps_result.unwrap().stdout.is_empty());

        let list_result = mock.list_containers(&[]);
        assert!(list_result.is_ok());
        assert_eq!(list_result.unwrap(), "[]");
    }

    #[test]
    fn test_malformed_json_response() {
        let mock = ConfigurableMockClient {
            inspect_container: MockResponse::ok("not valid json"),
            list_containers: MockResponse::ok("also not json"),
            ..Default::default()
        };

        // The mock just returns the string - JSON parsing happens at the call site
        let result = mock.inspect_container("test");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "not valid json");
    }

    // =========================================================================
    // Argument assembly tests for the rebuild/recreate flags
    // =========================================================================

    fn up_options(working: &std::path::Path) -> ComposeUpOptions<'_> {
        ComposeUpOptions {
            project: "proj",
            compose_file: std::path::Path::new("/tmp/docker-compose.yaml"),
            project_dir: std::path::Path::new("/tmp/.results"),
            env_files: vec![],
            working_dir: working,
            build: false,
            detach: true,
            remove_orphans: true,
            force_recreate: false,
            no_deps: false,
            pull: None,
            services: vec![],
        }
    }

    #[test]
    fn test_compose_up_post_args_default_deploy() {
        let opts = up_options(std::path::Path::new("/tmp"));
        // Routine deploy: detached + remove-orphans, no recreate, no build.
        assert_eq!(compose_up_post_args(&opts), vec!["-d", "--remove-orphans"]);
    }

    #[test]
    fn test_compose_up_post_args_repair_invocation() {
        let mut opts = up_options(std::path::Path::new("/tmp"));
        opts.force_recreate = true;
        opts.no_deps = true;
        opts.services = vec!["web", "api"];
        let args = compose_up_post_args(&opts);
        // Flags precede the `--` end-of-options separator and the positional services.
        assert_eq!(
            args,
            vec!["--force-recreate", "--no-deps", "-d", "--remove-orphans", "--", "web", "api"]
        );
        // Services come last, right after the `--` separator.
        assert_eq!(&args[args.len() - 3..], &["--".to_string(), "web".to_string(), "api".to_string()]);
        assert!(!args.contains(&"--build".to_string()), "repair must not pass --build");
    }

    #[test]
    fn test_compose_up_post_args_pull_policy() {
        let mut opts = up_options(std::path::Path::new("/tmp"));
        opts.pull = Some("always");
        let args = compose_up_post_args(&opts);
        let pos = args.iter().position(|a| a == "--pull").expect("--pull present");
        assert_eq!(args[pos + 1], "always", "--pull takes a policy value");
    }

    #[test]
    fn test_compose_build_post_args_cached_vs_no_cache_and_pull() {
        let base = ComposeBuildOptions {
            project: "proj",
            compose_file: std::path::Path::new("/tmp/docker-compose.yaml"),
            project_dir: std::path::Path::new("/tmp/.results"),
            env_files: vec![],
            working_dir: std::path::Path::new("/tmp"),
            no_cache: false,
            pull: false,
        };
        // Routine build keeps the cache: no flags appended.
        assert!(compose_build_post_args(&base).is_empty());

        let no_cache = ComposeBuildOptions { no_cache: true, ..base_clone(&base) };
        assert_eq!(compose_build_post_args(&no_cache), vec!["--no-cache"]);

        let pull = ComposeBuildOptions { pull: true, ..base_clone(&base) };
        assert_eq!(compose_build_post_args(&pull), vec!["--pull"]);
    }

    fn base_clone<'a>(b: &ComposeBuildOptions<'a>) -> ComposeBuildOptions<'a> {
        ComposeBuildOptions {
            project: b.project,
            compose_file: b.compose_file,
            project_dir: b.project_dir,
            env_files: b.env_files.clone(),
            working_dir: b.working_dir,
            no_cache: b.no_cache,
            pull: b.pull,
        }
    }

    #[test]
    fn test_configurable_mock_image_id_mapping() {
        // Default (neither value set) => image not found.
        let none = ConfigurableMockClient::default();
        assert_eq!(none.image_id("x:latest").unwrap(), None);

        // success_value => Some(id)
        let some = ConfigurableMockClient {
            image_id: MockResponse::ok("sha256:abc"),
            ..Default::default()
        };
        assert_eq!(some.image_id("x:latest").unwrap(), Some("sha256:abc".to_string()));

        // error_msg => Err
        let err = ConfigurableMockClient {
            image_id: MockResponse::err("daemon down"),
            ..Default::default()
        };
        assert!(err.image_id("x:latest").is_err());
    }
}
