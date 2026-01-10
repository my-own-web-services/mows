use std::fs;
use std::process::Command;
use tracing::{debug, info};

use super::checks::{print_check_results, run_debug_checks, run_health_checks};
use super::find_manifest_dir;
use super::render::{run_render_pipeline, RenderContext};
use crate::utils::parse_yaml;

/// Check if Docker daemon is available and running
fn check_docker_available() -> Result<(), String> {
    // First check if docker command exists
    let output = Command::new("docker")
        .arg("--version")
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                "Docker is not installed or not in PATH. Please install Docker first.".to_string()
            } else {
                format!("Failed to check Docker version: {}", e)
            }
        })?;

    if !output.status.success() {
        return Err("Docker command failed. Is Docker installed correctly?".to_string());
    }

    // Check if Docker daemon is running by pinging it
    let output = Command::new("docker")
        .args(["info", "--format", "{{.ServerVersion}}"])
        .output()
        .map_err(|e| format!("Failed to check Docker daemon: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("Cannot connect") || stderr.contains("permission denied") {
            return Err(format!(
                "Cannot connect to Docker daemon. Is Docker running?\n\
                 Try: sudo systemctl start docker\n\
                 Or add your user to the docker group: sudo usermod -aG docker $USER\n\
                 Error: {}",
                stderr.trim()
            ));
        }
        return Err(format!("Docker daemon check failed: {}", stderr.trim()));
    }

    let version = String::from_utf8_lossy(&output.stdout);
    debug!("Docker daemon version: {}", version.trim());

    Ok(())
}

/// Run compose up: render templates and run docker compose up
pub fn compose_up() -> Result<(), String> {
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

    let compose_value: serde_yaml::Value = match parse_yaml(&content, Some(&compose_path)) {
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

/// Run post-deployment health checks
fn run_post_deployment_checks(ctx: &RenderContext) {
    let project_name = ctx.manifest.project_name();

    // Wait a moment for containers to start
    std::thread::sleep(std::time::Duration::from_secs(2));

    let results = run_health_checks(&project_name);

    if !results.is_empty() {
        print_check_results(&results);
    }
}

/// Execute docker compose up with the project configuration
fn run_docker_compose_up(ctx: &RenderContext) -> Result<(), String> {
    let project_name = ctx.manifest.project_name();
    let results_dir = ctx.base_dir.join("results");

    // Find the docker-compose file
    let compose_file = if results_dir.join("docker-compose.yaml").exists() {
        "docker-compose.yaml"
    } else if results_dir.join("docker-compose.yml").exists() {
        "docker-compose.yml"
    } else {
        return Err("No docker-compose.yaml or docker-compose.yml found in results directory".to_string());
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
        .map_err(|e| format!("Failed to execute docker compose: {}", e))?;

    if !status.success() {
        return Err(format!(
            "docker compose up failed with exit code: {}",
            status.code().unwrap_or(-1)
        ));
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
spec: {}
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
