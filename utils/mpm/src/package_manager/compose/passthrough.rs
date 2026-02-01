use tracing::info;

use crate::error::{MowsError, Result};
use super::docker::{default_client, ComposePassthroughOptions};
use super::find_manifest_dir;
use super::manifest::MowsManifest;

/// Pass through commands to docker compose with project context
pub fn compose_passthrough(args: &[String]) -> Result<()> {
    let base_dir = find_manifest_dir()?;

    // Create Docker client (also checks Docker is available)
    let client = default_client()?;

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
        return Err(MowsError::Docker(
            "No docker-compose.yaml found in results/. Run 'mows package-manager compose up' (or 'mpm compose up') first.".to_string(),
        ));
    };

    info!(
        "Running docker compose {} for project: {}",
        args.first().map(|s| s.as_str()).unwrap_or(""),
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

    let options = ComposePassthroughOptions {
        project: &project_name,
        compose_file: &compose_file,
        project_dir: &results_dir,
        env_files: env_files.iter().map(|p| p.as_path()).collect(),
        working_dir: &base_dir,
        args,
    };

    client.compose_passthrough(&options)?;

    Ok(())
}
