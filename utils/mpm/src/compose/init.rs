use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{debug, info};

use super::config::{MpmConfig, ProjectEntry};
use crate::utils::find_git_root;

/// Information about a detected Dockerfile
#[derive(Debug)]
struct DockerfileInfo {
    /// Service name (parent directory name)
    service_name: String,
    /// Relative path to Dockerfile from git root
    dockerfile_path: PathBuf,
    /// Relative path to build context from deployment folder
    context_path: String,
}

/// Get the git repository name from the current directory
fn get_git_repo_name() -> Result<String, String> {
    // Try to get the remote URL first
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // Extract repo name from URL (handles both HTTPS and SSH)
            if let Some(name) = extract_repo_name_from_url(&url) {
                return Ok(name);
            }
        }
    }

    // Fallback: use the directory name
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .map_err(|e| format!("Failed to get git root: {}", e))?;

    if !output.status.success() {
        return Err("Not in a git repository".to_string());
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Could not determine repository name".to_string())
}

/// Extract repository name from a git URL
fn extract_repo_name_from_url(url: &str) -> Option<String> {
    // Handle SSH format: git@github.com:user/repo.git
    // Handle HTTPS format: https://github.com/user/repo.git
    let name = url
        .trim_end_matches(".git")
        .rsplit('/')
        .next()
        .or_else(|| url.rsplit(':').next())?;

    Some(name.to_string())
}

/// Find all Dockerfiles in the repository
fn find_dockerfiles(git_root: &Path) -> Vec<DockerfileInfo> {
    let mut dockerfiles = Vec::new();

    fn walk_dir(dir: &Path, git_root: &Path, dockerfiles: &mut Vec<DockerfileInfo>) {
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            // Skip hidden directories and common non-source directories
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.')
                    || name == "node_modules"
                    || name == "target"
                    || name == "vendor"
                    || name == "dist"
                    || name == "build"
                    || name == "deployment"
                {
                    continue;
                }
            }

            if path.is_dir() {
                walk_dir(&path, git_root, dockerfiles);
            } else if path.file_name().and_then(|n| n.to_str()) == Some("Dockerfile") {
                // Get the parent directory name as service name
                if let Some(parent) = path.parent() {
                    if let Some(service_name) = parent.file_name().and_then(|n| n.to_str()) {
                        // Calculate relative path from git root
                        if let Ok(rel_path) = path.strip_prefix(git_root) {
                            // Calculate context path relative to results/ folder
                            // docker-compose.yaml is in results/, so we need to go up
                            // two levels (results/ -> deployment/ -> git_root)
                            let context = if let Ok(parent_rel) = parent.strip_prefix(git_root) {
                                // Use Path to build the relative path properly
                                let results_to_root = Path::new("..").join("..");
                                results_to_root.join(parent_rel).display().to_string()
                            } else {
                                Path::new("..").join("..").join(service_name).display().to_string()
                            };

                            dockerfiles.push(DockerfileInfo {
                                service_name: service_name.to_string(),
                                dockerfile_path: rel_path.to_path_buf(),
                                context_path: context,
                            });
                        }
                    }
                }
            }
        }
    }

    walk_dir(git_root, git_root, &mut dockerfiles);

    // Sort by service name for consistent output
    dockerfiles.sort_by(|a, b| a.service_name.cmp(&b.service_name));

    dockerfiles
}

/// Generate the docker-compose.yaml content
fn generate_docker_compose(dockerfiles: &[DockerfileInfo]) -> String {
    let mut content = String::from("services:\n");

    if dockerfiles.is_empty() {
        // Add a placeholder service
        content.push_str("    # Add your services here\n");
        content.push_str("    # example:\n");
        content.push_str("    #     image: nginx:alpine\n");
        content.push_str("    #     restart: unless-stopped\n");
    } else {
        for dockerfile in dockerfiles {
            content.push_str(&format!("    {}:\n", dockerfile.service_name));
            content.push_str(&format!(
                "        {{{{- if eq .services.{}.build.enabled true }}}}\n",
                dockerfile.service_name
            ));
            content.push_str("        build:\n");
            content.push_str(&format!(
                "            context: \"{{{{ .services.{}.build.context }}}}\"\n",
                dockerfile.service_name
            ));
            content.push_str(&format!(
                "            dockerfile: \"{{{{ .services.{}.build.dockerfile }}}}\"\n",
                dockerfile.service_name
            ));
            content.push_str("        {{- else }}\n");
            content.push_str(&format!(
                "        image: \"{{{{ .services.{}.image }}}}\"\n",
                dockerfile.service_name
            ));
            content.push_str("        {{- end }}\n");
            content.push_str("        restart: unless-stopped\n");
            content.push_str("\n");
        }
    }

    content
}

/// Generate the values.yaml content
fn generate_values(dockerfiles: &[DockerfileInfo]) -> String {
    let mut content = String::new();

    if dockerfiles.is_empty() {
        content.push_str("# Add your configuration values here\n");
        content.push_str("# Example:\n");
        content.push_str("# hostname: example.com\n");
        content.push_str("# port: 8080\n");
    } else {
        content.push_str("services:\n");
        for dockerfile in dockerfiles {
            content.push_str(&format!("    {}:\n", dockerfile.service_name));
            content.push_str("        build:\n");
            content.push_str("            enabled: true\n");
            content.push_str(&format!("            context: {}\n", dockerfile.context_path));
            content.push_str("            dockerfile: Dockerfile\n");
            content.push_str(&format!(
                "        # image: your-registry/{}\n",
                dockerfile.service_name
            ));
        }
    }

    content
}

/// Generate the mows-manifest.yaml content
fn generate_manifest(project_name: &str) -> String {
    format!(
        r#"manifestVersion: "0.1"
metadata:
    name: {}
    description: ""
    version: "0.1"
spec: {{}}
"#,
        project_name
    )
}

/// Generate the .gitignore content
fn generate_gitignore() -> &'static str {
    "admin-infos.yaml\nresults\nprovided-secrets.env\n"
}

/// Generate the provided-secrets.env content
fn generate_provided_secrets() -> &'static str {
    "# User-provided secrets\n\
     # Add secrets here that should not be auto-generated\n\
     # Example:\n\
     # API_KEY=\n"
}

/// Generate the generated-secrets.env template content
fn generate_generated_secrets_template() -> &'static str {
    "# Auto-generated secrets template\n\
     # Use template functions to generate secrets:\n\
     #   {{ randAlphaNum 32 }} - random alphanumeric string\n\
     #   {{ uuidv4 }} - random UUID\n\
     #\n\
     # Example:\n\
     # DB_USERNAME={{ randAlphaNum 16 }}\n\
     # DB_PASSWORD={{ randAlphaNum 24 }}\n"
}

/// Initialize a new mpm compose project
pub fn compose_init(name: Option<&str>) -> Result<(), String> {
    // Determine project name
    let project_name = match name {
        Some(n) => n.to_string(),
        None => get_git_repo_name()?,
    };

    info!("Initializing mpm compose project: {}", project_name);

    // Get git root to find Dockerfiles
    let git_root = find_git_root()?;
    debug!("Git root: {}", git_root.display());

    // Find Dockerfiles
    let dockerfiles = find_dockerfiles(&git_root);
    if dockerfiles.is_empty() {
        debug!("No Dockerfiles found");
    } else {
        info!("Found {} Dockerfile(s):", dockerfiles.len());
        for df in &dockerfiles {
            info!("  - {} ({})", df.service_name, df.dockerfile_path.display());
        }
    }

    // Create deployment directory structure
    let deployment_dir = PathBuf::from("deployment");

    // Check if deployment directory already exists
    if deployment_dir.exists() {
        return Err("deployment directory already exists".to_string());
    }

    let templates_dir = deployment_dir.join("templates");
    let config_dir = templates_dir.join("config");
    let data_dir = deployment_dir.join("data");
    let results_dir = deployment_dir.join("results");

    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create deployment/templates/config: {}", e))?;
    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create deployment/data: {}", e))?;
    fs::create_dir_all(&results_dir)
        .map_err(|e| format!("Failed to create deployment/results: {}", e))?;

    // Generate and write mows-manifest.yaml
    let manifest_path = deployment_dir.join("mows-manifest.yaml");
    if !manifest_path.exists() {
        fs::write(&manifest_path, generate_manifest(&project_name))
            .map_err(|e| format!("Failed to write mows-manifest.yaml: {}", e))?;
        info!("Created: {}", manifest_path.display());
    } else {
        debug!("Skipping existing: {}", manifest_path.display());
    }

    // Generate and write values.yaml
    let values_path = deployment_dir.join("values.yaml");
    if !values_path.exists() {
        fs::write(&values_path, generate_values(&dockerfiles))
            .map_err(|e| format!("Failed to write values.yaml: {}", e))?;
        info!("Created: {}", values_path.display());
    } else {
        debug!("Skipping existing: {}", values_path.display());
    }

    // Generate and write templates/docker-compose.yaml
    let compose_path = templates_dir.join("docker-compose.yaml");
    if !compose_path.exists() {
        fs::write(&compose_path, generate_docker_compose(&dockerfiles))
            .map_err(|e| format!("Failed to write docker-compose.yaml: {}", e))?;
        info!("Created: {}", compose_path.display());
    } else {
        debug!("Skipping existing: {}", compose_path.display());
    }

    // Generate and write .gitignore
    let gitignore_path = deployment_dir.join(".gitignore");
    if !gitignore_path.exists() {
        fs::write(&gitignore_path, generate_gitignore())
            .map_err(|e| format!("Failed to write .gitignore: {}", e))?;
        info!("Created: {}", gitignore_path.display());
    } else {
        debug!("Skipping existing: {}", gitignore_path.display());
    }

    // Generate and write provided-secrets.env
    let provided_secrets_path = deployment_dir.join("provided-secrets.env");
    if !provided_secrets_path.exists() {
        fs::write(&provided_secrets_path, generate_provided_secrets())
            .map_err(|e| format!("Failed to write provided-secrets.env: {}", e))?;
        info!("Created: {}", provided_secrets_path.display());
    } else {
        debug!("Skipping existing: {}", provided_secrets_path.display());
    }

    // Generate and write templates/generated-secrets.env
    let generated_secrets_path = templates_dir.join("generated-secrets.env");
    if !generated_secrets_path.exists() {
        fs::write(&generated_secrets_path, generate_generated_secrets_template())
            .map_err(|e| format!("Failed to write generated-secrets.env: {}", e))?;
        info!("Created: {}", generated_secrets_path.display());
    } else {
        debug!("Skipping existing: {}", generated_secrets_path.display());
    }

    // Register project in global config
    let mut config = MpmConfig::load()?;
    let repo_path = git_root.canonicalize().map_err(|e| {
        format!("Failed to get absolute path for repo: {}", e)
    })?;
    config.upsert_project(ProjectEntry {
        project_name: project_name.clone(),
        instance_name: None,
        repo_path,
        manifest_path: PathBuf::from("deployment"),
    });
    config.save()?;

    info!("Project initialized successfully!");
    info!("Next steps:");
    info!("  1. cd deployment");
    info!("  2. Edit values.yaml with your configuration");
    info!("  3. Edit templates/docker-compose.yaml as needed");
    info!("  4. Run: mpm compose up");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_repo_name_https() {
        assert_eq!(
            extract_repo_name_from_url("https://github.com/user/my-repo.git"),
            Some("my-repo".to_string())
        );
    }

    #[test]
    fn test_extract_repo_name_ssh() {
        assert_eq!(
            extract_repo_name_from_url("git@github.com:user/my-repo.git"),
            Some("my-repo".to_string())
        );
    }

    #[test]
    fn test_extract_repo_name_no_git_suffix() {
        assert_eq!(
            extract_repo_name_from_url("https://github.com/user/my-repo"),
            Some("my-repo".to_string())
        );
    }

    #[test]
    fn test_generate_manifest() {
        let manifest = generate_manifest("test-project");
        assert!(manifest.contains("name: test-project"));
        assert!(manifest.contains("manifestVersion: \"0.1\""));
    }

    #[test]
    fn test_generate_gitignore() {
        let gitignore = generate_gitignore();
        assert!(gitignore.contains("admin-infos.yaml"));
        assert!(gitignore.contains("results"));
        assert!(gitignore.contains("provided-secrets.env"));
    }

    #[test]
    fn test_generate_docker_compose_empty() {
        let compose = generate_docker_compose(&[]);
        assert!(compose.contains("services:"));
        assert!(compose.contains("# Add your services here"));
    }

    #[test]
    fn test_generate_docker_compose_with_services() {
        let dockerfiles = vec![
            DockerfileInfo {
                service_name: "web".to_string(),
                dockerfile_path: PathBuf::from("web/Dockerfile"),
                context_path: "../../web".to_string(),
            },
            DockerfileInfo {
                service_name: "api".to_string(),
                dockerfile_path: PathBuf::from("api/Dockerfile"),
                context_path: "../../api".to_string(),
            },
        ];

        let compose = generate_docker_compose(&dockerfiles);
        assert!(compose.contains("web:"));
        assert!(compose.contains("api:"));
        assert!(compose.contains(".services.web.build.enabled"));
        assert!(compose.contains(".services.api.build.enabled"));
    }

    #[test]
    fn test_generate_values_with_services() {
        let dockerfiles = vec![DockerfileInfo {
            service_name: "server".to_string(),
            dockerfile_path: PathBuf::from("server/Dockerfile"),
            context_path: "../../server".to_string(),
        }];

        let values = generate_values(&dockerfiles);
        assert!(values.contains("services:"));
        assert!(values.contains("server:"));
        assert!(values.contains("context: ../../server"));
    }
}
