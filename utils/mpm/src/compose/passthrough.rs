use std::process::Command;
use tracing::{debug, info};

use super::find_manifest_dir;
use super::manifest::MowsManifest;

/// Pass through commands to docker compose with project context
pub fn compose_passthrough(args: &[String]) -> Result<(), String> {
    let base_dir = find_manifest_dir()?;

    // Load manifest to get project name
    let manifest = MowsManifest::load(&base_dir)?;
    let project_name = manifest.project_name();
    let results_dir = base_dir.join("results");

    // Find docker-compose file
    let compose_file = if results_dir.join("docker-compose.yaml").exists() {
        results_dir.join("docker-compose.yaml")
    } else if results_dir.join("docker-compose.yml").exists() {
        results_dir.join("docker-compose.yml")
    } else {
        return Err(
            "No docker-compose.yaml found in results/. Run 'mpm compose up' first.".to_string(),
        );
    };

    info!(
        "Running docker compose {} for project: {}",
        args.first().map(|s| s.as_str()).unwrap_or(""),
        project_name
    );

    // Build the command with our context
    let mut cmd = Command::new("docker");
    cmd.arg("compose")
        .arg("-p")
        .arg(&project_name)
        .arg("--project-directory")
        .arg(&results_dir)
        .arg("-f")
        .arg(&compose_file);

    // Add env files if they exist
    let generated_secrets = results_dir.join("generated-secrets.env");
    let provided_secrets = results_dir.join("provided-secrets.env");

    if generated_secrets.exists() {
        cmd.arg("--env-file").arg(&generated_secrets);
    }
    if provided_secrets.exists() {
        cmd.arg("--env-file").arg(&provided_secrets);
    }

    // Add the passthrough arguments
    for arg in args {
        cmd.arg(arg);
    }

    debug!("Executing: {:?}", cmd);
    cmd.current_dir(&base_dir);

    // Execute with inherited stdio for interactive commands
    let status = cmd
        .status()
        .map_err(|e| format!("Failed to execute docker compose: {}", e))?;

    if !status.success() {
        return Err(format!(
            "docker compose failed with exit code: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    // Passthrough tests would require Docker, so we mainly test in integration tests
}
