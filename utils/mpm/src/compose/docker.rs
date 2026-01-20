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
//! - CLI fallback for `docker compose` commands (not supported by bollard)

use std::process::{Command, Output};
use tracing::debug;

use crate::error::{MpmError, Result};

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

    /// Create a failed output with the given stderr.
    pub fn failure(stderr: impl Into<String>) -> Self {
        Self {
            stdout: String::new(),
            stderr: stderr.into(),
            success: false,
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

    /// Run arbitrary docker compose command with inherited stdio (for interactive commands).
    fn compose_passthrough(&self, options: &ComposePassthroughOptions) -> Result<()>;

    /// Inspect a container and return JSON output.
    fn inspect_container(&self, container: &str) -> Result<String>;

    /// Get network information as JSON.
    fn inspect_network(&self, network: &str) -> Result<String>;

    /// List containers with optional filters, returning JSON array.
    fn list_containers(&self, filters: &[(&str, &str)]) -> Result<String>;
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
                MpmError::Docker(format!(
                    r#"Cannot connect to Docker daemon. Is Docker running?
Try: sudo systemctl start docker
Or add your user to the docker group: sudo usermod -aG docker $USER
Error: {}"#,
                    e
                ))
            } else {
                MpmError::Docker(format!("Failed to connect to Docker: {}", e))
            }
        })?;

        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| MpmError::Docker(format!("Failed to create tokio runtime: {}", e)))?;

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
                    MpmError::Docker(
                        "Docker is not installed or not in PATH. Please install Docker first."
                            .to_string(),
                    )
                } else {
                    MpmError::command(&format!("docker {}", full_args.join(" ")), e.to_string())
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
                    MpmError::Docker(format!(
                        r#"Cannot connect to Docker daemon. Is Docker running?
Try: sudo systemctl start docker
Or add your user to the docker group: sudo usermod -aG docker $USER
Error: {}"#,
                        msg
                    ))
                } else {
                    MpmError::Docker(format!("Docker daemon check failed: {}", msg))
                }
            })?;

            // Get version
            let version = self.docker.version().await.map_err(|e| {
                MpmError::Docker(format!("Failed to get Docker version: {}", e))
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

        if options.build {
            cmd.arg("--build");
        }
        if options.detach {
            cmd.arg("-d");
        }
        if options.remove_orphans {
            cmd.arg("--remove-orphans");
        }

        cmd.current_dir(options.working_dir);
        debug!("Executing: {:?}", cmd);

        let status = cmd
            .status()
            .map_err(|e| MpmError::command("docker compose up", e.to_string()))?;

        if !status.success() {
            return Err(MpmError::Docker(format!(
                "docker compose up failed with exit code: {}",
                status.code().unwrap_or(-1)
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
            .map_err(|e| MpmError::command("docker compose", e.to_string()))?;

        if !status.success() {
            return Err(MpmError::Docker(format!(
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
                .map_err(|e| MpmError::Docker(format!("Failed to inspect container '{}': {}", container, e)))?;

            serde_json::to_string(&info)
                .map_err(|e| MpmError::Docker(format!("Failed to serialize container info: {}", e)))
        })
    }

    fn inspect_network(&self, network: &str) -> Result<String> {
        debug!("Inspecting network via bollard: {}", network);
        self.runtime.block_on(async {
            let info = self
                .docker
                .inspect_network(network, None::<bollard::query_parameters::InspectNetworkOptions>)
                .await
                .map_err(|e| MpmError::Docker(format!("Failed to inspect network '{}': {}", network, e)))?;

            serde_json::to_string(&info)
                .map_err(|e| MpmError::Docker(format!("Failed to serialize network info: {}", e)))
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
                .map_err(|e| MpmError::Docker(format!("Failed to list containers: {}", e)))?;

            serde_json::to_string(&containers)
                .map_err(|e| MpmError::Docker(format!("Failed to serialize container list: {}", e)))
        })
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
/// mpm compose up  # Uses mock Docker client
/// ```
pub const ENV_MOCK_DOCKER: &str = "MPM_MOCK_DOCKER";

/// Check if Docker is available and the daemon is running.
/// Convenience function using the default client.
pub fn check_docker_available() -> Result<()> {
    let client = default_client()?;
    let version = client.check_daemon()?;
    debug!("Docker daemon version: {}", version);
    Ok(())
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
        debug!("Mock: compose_up project={}", options.project);
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

    fn inspect_network(&self, network: &str) -> Result<String> {
        debug!("Mock: inspect_network {}", network);
        Ok(format!(r#"{{"Name": "{}", "Driver": "bridge"}}"#, network))
    }

    fn list_containers(&self, filters: &[(&str, &str)]) -> Result<String> {
        debug!("Mock: list_containers filters={:?}", filters);
        // Return empty list - no conflicting containers
        Ok("[]".to_string())
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
        if let Some(ref val) = self.success_value {
            Ok(val.clone())
        } else if let Some(ref msg) = self.error_msg {
            Err(MpmError::Docker(msg.clone()))
        } else {
            Ok(default.to_string())
        }
    }

    pub fn to_command_output(&self) -> Result<CommandOutput> {
        if let Some(ref val) = self.success_value {
            Ok(CommandOutput::success(val.clone()))
        } else if let Some(ref msg) = self.error_msg {
            Err(MpmError::Docker(msg.clone()))
        } else {
            Ok(CommandOutput::success(""))
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
    pub inspect_container: MockResponse,
    pub inspect_network: MockResponse,
    pub list_containers: MockResponse,
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
        Ok(())
    }

    fn compose_passthrough(&self, _options: &ComposePassthroughOptions) -> Result<()> {
        Ok(())
    }

    fn inspect_container(&self, _container: &str) -> Result<String> {
        self.inspect_container.to_result("{}")
    }

    fn inspect_network(&self, _network: &str) -> Result<String> {
        self.inspect_network.to_result("{}")
    }

    fn list_containers(&self, _filters: &[(&str, &str)]) -> Result<String> {
        self.list_containers.to_result("[]")
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
    fn test_command_output_failure() {
        let output = CommandOutput::failure("error message");
        assert!(!output.success);
        assert!(output.stdout.is_empty());
        assert_eq!(output.stderr, "error message");
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
}
