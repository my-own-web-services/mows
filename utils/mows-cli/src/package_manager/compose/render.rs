use gtmpl_ng::{self as gtmpl};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info, trace, warn};

use super::manifest::MowsManifest;
use super::secrets::{load_secrets_as_map, merge_generated_secrets, write_secret_file};
use crate::error::{IoResultExt, MowsError, Result};
use crate::template::error::format_template_error;
use crate::template::render_template_string;
use crate::template::variables::load_variable_file;
use crate::tools::{flatten_labels_in_compose, FlattenLabelsError};
use crate::utils::parse_yaml;

/// Directory permission mode: owner full, group/others read+execute (rwxr-xr-x).
/// Standard permission for directories that need to be traversable.
const DIRECTORY_MODE: u32 = 0o755;

/// Context for rendering templates
pub struct RenderContext {
    /// The manifest loaded from mows-manifest.yaml
    pub manifest: MowsManifest,
    /// Variables from values.yaml
    pub values: gtmpl::Value,
    /// The base directory (where mows-manifest.yaml is located)
    pub base_dir: std::path::PathBuf,
    /// The directory where rendered output is written.
    /// Defaults to `base_dir/.results` but can be overridden to a staging dir.
    pub results_dir: std::path::PathBuf,
}

impl RenderContext {
    /// Create a new render context from a directory
    pub fn new(dir: &Path) -> Result<Self> {
        let manifest = MowsManifest::load(dir)?;

        // Load values.yaml (or custom path from manifest)
        let values = load_values(dir, &manifest)?;

        Ok(RenderContext {
            manifest,
            values,
            results_dir: dir.join(super::RESULTS_DIR_NAME),
            base_dir: dir.to_path_buf(),
        })
    }

    /// Create a copy of this context that renders into a different output directory.
    fn with_results_dir(&self, results_dir: PathBuf) -> Self {
        RenderContext {
            manifest: self.manifest.clone(),
            values: self.values.clone(),
            base_dir: self.base_dir.clone(),
            results_dir,
        }
    }

    /// Get combined variables for template rendering
    /// Includes $chart (manifest metadata) and values at root
    pub fn get_template_variables(&self) -> gtmpl::Value {
        let mut root: HashMap<String, gtmpl::Value> = HashMap::new();

        // Add chart metadata
        let mut chart_map: HashMap<String, gtmpl::Value> = HashMap::new();
        chart_map.insert(
            "projectName".to_string(),
            gtmpl::Value::String(self.manifest.metadata.name.clone()),
        );
        if let Some(ref desc) = self.manifest.metadata.description {
            chart_map.insert("description".to_string(), gtmpl::Value::String(desc.clone()));
        }
        if let Some(ref version) = self.manifest.metadata.version {
            chart_map.insert("version".to_string(), gtmpl::Value::String(version.clone()));
        }
        root.insert("chart".to_string(), gtmpl::Value::Object(chart_map));

        // Merge values at root level
        if let gtmpl::Value::Object(values_map) = &self.values {
            for (k, v) in values_map {
                root.insert(k.clone(), v.clone());
            }
        }

        gtmpl::Value::Object(root)
    }

    /// Get template variables with secrets included
    pub fn get_template_variables_with_secrets(
        &self,
        generated_secrets: &HashMap<String, String>,
        provided_secrets: &HashMap<String, String>,
    ) -> gtmpl::Value {
        let mut root = match self.get_template_variables() {
            gtmpl::Value::Object(m) => m,
            _ => HashMap::new(),
        };

        // Add generatedSecrets
        let gen_map: HashMap<String, gtmpl::Value> = generated_secrets
            .iter()
            .map(|(k, v)| (k.clone(), gtmpl::Value::String(v.clone())))
            .collect();
        root.insert("generatedSecrets".to_string(), gtmpl::Value::Object(gen_map));

        // Add providedSecrets
        let prov_map: HashMap<String, gtmpl::Value> = provided_secrets
            .iter()
            .map(|(k, v)| (k.clone(), gtmpl::Value::String(v.clone())))
            .collect();
        root.insert("providedSecrets".to_string(), gtmpl::Value::Object(prov_map));

        gtmpl::Value::Object(root)
    }
}

/// Load values.yaml from a directory
fn load_values(dir: &Path, _manifest: &MowsManifest) -> Result<gtmpl::Value> {
    // Search for standard values files
    let candidates = ["values.yaml", "values.yml", "values.json"];

    for name in candidates {
        let path = dir.join(name);
        if path.is_file() {
            debug!("Loading values from: {}", path.display());
            return Ok(load_variable_file(&path)?);
        }
    }

    debug!("No values file found, using empty values");
    Ok(gtmpl::Value::Object(HashMap::new()))
}

/// Render a single template file
fn render_template_file(
    input: &Path,
    output: &Path,
    variables: &gtmpl::Value,
) -> Result<()> {
    trace!("Rendering: {} -> {}", input.display(), output.display());

    let template_content = fs::read_to_string(input)
        .io_context(format!("Failed to read template '{}'", input.display()))?;

    let rendered = render_template_string(&template_content, variables).map_err(|(error, preamble_lines)| {
        MowsError::Template(format_template_error(
            input,
            &template_content,
            &error,
            preamble_lines,
            6,
            Some(variables),
        ))
    })?;

    // Create parent directories
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .io_context("Failed to create output directory")?;
    }

    fs::write(output, rendered)
        .io_context(format!("Failed to write output '{}'", output.display()))?;

    Ok(())
}

/// Maximum directory depth to prevent infinite recursion from symlink loops
const MAX_DIRECTORY_DEPTH: usize = 50;

/// Maximum number of directories to track for symlink loop detection.
/// This prevents unbounded memory growth in very large directory trees.
const MAX_VISITED_DIRECTORIES: usize = 10_000;

/// Render a directory of templates with symlink loop detection
fn render_template_directory(
    input: &Path,
    output: &Path,
    variables: &gtmpl::Value,
) -> Result<()> {
    let mut visited = HashSet::new();
    render_template_directory_inner(input, output, variables, &mut visited, 0)
}

/// Inner function with visited set for loop detection
fn render_template_directory_inner(
    input: &Path,
    output: &Path,
    variables: &gtmpl::Value,
    visited: &mut HashSet<PathBuf>,
    depth: usize,
) -> Result<()> {
    debug!("Rendering directory: {} -> {}", input.display(), output.display());

    // Check depth limit
    if depth > MAX_DIRECTORY_DEPTH {
        return Err(MowsError::Path {
            path: input.to_path_buf(),
            message: format!(
                "Maximum directory depth ({}) exceeded. Possible symlink loop?",
                MAX_DIRECTORY_DEPTH
            ),
        });
    }

    // Check visited set size limit to prevent unbounded memory growth
    if visited.len() >= MAX_VISITED_DIRECTORIES {
        return Err(MowsError::Path {
            path: input.to_path_buf(),
            message: format!(
                "Too many directories visited ({}). Directory tree may be too large or contain many symlinks.",
                MAX_VISITED_DIRECTORIES
            ),
        });
    }

    if !input.is_dir() {
        return Err(MowsError::Path {
            path: input.to_path_buf(),
            message: "Not a directory".to_string(),
        });
    }

    // Get canonical path for loop detection
    let canonical = input.canonicalize()
        .io_context(format!("Failed to resolve path '{}'", input.display()))?;

    // Check for symlink loops
    if !visited.insert(canonical.clone()) {
        return Err(MowsError::Path {
            path: input.to_path_buf(),
            message: "Symlink loop detected: path was already visited".to_string(),
        });
    }

    fs::create_dir_all(output)
        .io_context("Failed to create output directory")?;

    for entry in fs::read_dir(input)
        .io_context(format!("Failed to read directory '{}'", input.display()))?
    {
        let entry = entry.io_context("Failed to read directory entry")?;
        let path = entry.path();
        let file_name = entry.file_name();
        let output_path = output.join(&file_name);

        // Skip hidden files
        if file_name.to_string_lossy().starts_with('.') {
            trace!("Skipping hidden file: {}", path.display());
            continue;
        }

        // Get metadata without following symlinks to detect special files
        let metadata = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) => {
                warn!("Failed to read metadata for '{}': {}", path.display(), e);
                continue;
            }
        };

        // Skip special files (devices, sockets, pipes)
        let file_type = metadata.file_type();
        if !file_type.is_file() && !file_type.is_dir() && !file_type.is_symlink() {
            trace!("Skipping special file: {}", path.display());
            continue;
        }

        if path.is_dir() {
            render_template_directory_inner(&path, &output_path, variables, visited, depth + 1)?;
        } else if path.is_file() {
            render_template_file(&path, &output_path, variables)?;
        }
        // Note: broken symlinks will fail is_file() and is_dir(), so they're skipped
    }

    Ok(())
}

/// Render generated-secrets.env with merge logic
pub fn render_generated_secrets(context: &RenderContext) -> Result<()> {
    let template_path = context.base_dir.join("templates/generated-secrets.env");
    let results_dir = &context.results_dir;
    let output_path = results_dir.join("generated-secrets.env");

    if !template_path.exists() {
        debug!("No generated-secrets.env template found");
        return Ok(());
    }

    info!("Rendering generated-secrets.env");

    // Read existing content if present
    let existing_content = if output_path.exists() {
        Some(fs::read_to_string(&output_path)
            .io_context("Failed to read existing generated-secrets.env")?)
    } else {
        None
    };

    // Render the template
    let template_content = fs::read_to_string(&template_path)
        .io_context("Failed to read generated-secrets template")?;

    let variables = context.get_template_variables();

    let rendered = render_template_string(&template_content, &variables).map_err(|(error, preamble_lines)| {
        MowsError::Template(format_template_error(
            &template_path,
            &template_content,
            &error,
            preamble_lines,
            6,
            Some(&variables),
        ))
    })?;

    // Merge with existing content
    let merged = merge_generated_secrets(existing_content.as_deref(), &rendered);

    // Ensure results directory exists
    fs::create_dir_all(&results_dir)
        .io_context("Failed to create results directory")?;

    // Write with restricted permissions (600) to protect secrets
    write_secret_file(&output_path, &merged)?;

    Ok(())
}

/// Copy provided-secrets.env to results with secure permissions
pub fn copy_provided_secrets(context: &RenderContext) -> Result<()> {
    let source_path = context.base_dir.join("provided-secrets.env");
    let results_dir = &context.results_dir;
    let output_path = results_dir.join("provided-secrets.env");

    if !source_path.exists() {
        debug!("No provided-secrets.env found");
        return Ok(());
    }

    info!("Copying provided-secrets.env");

    fs::create_dir_all(&results_dir)
        .io_context("Failed to create results directory")?;

    // Read and write with secure permissions instead of copy
    // to ensure the destination has restricted permissions (600)
    let content = fs::read_to_string(&source_path)
        .io_context("Failed to read provided-secrets.env")?;

    write_secret_file(&output_path, &content)?;

    Ok(())
}

/// Render the templates/config directory
pub fn render_config_templates(context: &RenderContext) -> Result<()> {
    let config_dir = context.base_dir.join("templates/config");
    let output_dir = context.results_dir.join("config");

    if !config_dir.exists() {
        debug!("No templates/config directory found");
        return Ok(());
    }

    info!("Rendering templates/config directory");

    let variables = context.get_template_variables();
    render_template_directory(&config_dir, &output_dir, &variables)
}

/// Render docker-compose.yaml with label flattening
pub fn render_docker_compose(context: &RenderContext) -> Result<()> {
    let templates_dir = context.base_dir.join("templates");

    // Find docker-compose template
    let template_path = if templates_dir.join("docker-compose.yaml").exists() {
        templates_dir.join("docker-compose.yaml")
    } else if templates_dir.join("docker-compose.yml").exists() {
        templates_dir.join("docker-compose.yml")
    } else {
        return Err(MowsError::Path {
            path: templates_dir,
            message: "No docker-compose.yaml or docker-compose.yml template found".to_string(),
        });
    };

    let output_path = context.results_dir.join(
        template_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    );

    info!("Rendering docker-compose template");

    // First render the template
    let variables = context.get_template_variables();
    render_template_file(&template_path, &output_path, &variables)?;

    // Then flatten labels if present
    let content = fs::read_to_string(&output_path)
        .io_context("Failed to read rendered docker-compose")?;

    let yaml_value: serde_yaml_neo::Value = parse_yaml(&content, Some(&output_path))?;

    // Check if this looks like a docker-compose file with services
    if yaml_value.get("services").is_some() {
        debug!("Flattening labels in docker-compose file");
        match flatten_labels_in_compose(yaml_value) {
            Ok(flattened) => {
                // Detect indentation from rendered template, default to 4 spaces
                let indent = serde_yaml_neo::detect_indentation(&content)
                    .ok()
                    .flatten()
                    .map(|i| i.spaces())
                    .unwrap_or(4);
                let yaml = serde_yaml_neo::to_string_with_indent(&flattened, indent)?;
                fs::write(&output_path, yaml)
                    .io_context("Failed to write docker-compose")?;
            }
            Err(FlattenLabelsError::NoLabels) => {
                debug!("No labels to flatten in docker-compose");
            }
            Err(e) => {
                warn!("Failed to flatten labels: {}", e);
            }
        }
    }

    Ok(())
}

/// Setup the data directory symlink
pub fn setup_data_directory(context: &RenderContext) -> Result<()> {
    let data_dir = context.base_dir.join("data");
    let results_dir = &context.results_dir;
    let symlink_path = results_dir.join("data");

    // Create data directory if it doesn't exist
    if !data_dir.exists() {
        info!("Creating data directory");
        fs::create_dir_all(&data_dir)
            .io_context("Failed to create data directory")?;
    }

    // Directories need execute bit for users to enter them
    debug!("Setting data directory permissions");
    let permissions = fs::Permissions::from_mode(DIRECTORY_MODE);
    fs::set_permissions(&data_dir, permissions)
        .io_context("Failed to set data directory permissions")?;

    // Create results directory if needed
    fs::create_dir_all(&results_dir)
        .io_context("Failed to create results directory")?;

    // Remove existing symlink/file/directory if present
    // Use symlink_metadata to check without following symlinks
    match fs::symlink_metadata(&symlink_path) {
        Ok(metadata) => {
            debug!("Removing existing path at symlink location");
            if metadata.is_symlink() || metadata.is_file() {
                fs::remove_file(&symlink_path)
                    .io_context("Failed to remove existing file/symlink")?;
            } else if metadata.is_dir() {
                // Only remove if it's an empty directory, otherwise error
                fs::remove_dir(&symlink_path).io_context(format!(
                    "Failed to remove existing directory at '{}'. \
                     If it contains files, please remove it manually",
                    symlink_path.display()
                ))?;
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Path doesn't exist, which is fine
        }
        Err(e) => {
            return Err(MowsError::io(
                format!("Failed to check existing path '{}'", symlink_path.display()),
                e,
            ));
        }
    }

    // Create symlink using absolute path to avoid resolution issues
    let absolute_data_dir = if data_dir.is_absolute() {
        data_dir.clone()
    } else {
        context.base_dir.join(&data_dir)
    };

    info!("Creating data directory symlink");
    std::os::unix::fs::symlink(&absolute_data_dir, &symlink_path)
        .io_context("Failed to create data symlink")?;

    Ok(())
}

/// Render admin-infos.yaml with secrets variables
pub fn render_admin_infos(context: &RenderContext) -> Result<()> {
    let template_path = context.base_dir.join("templates/admin-infos.yaml");
    let output_path = context.base_dir.join("admin-infos.yaml");

    if !template_path.exists() {
        debug!("No admin-infos.yaml template found");
        return Ok(());
    }

    info!("Rendering admin-infos.yaml");

    // Load secrets from the results directory (may be staging)
    let generated_secrets = load_secrets_as_map(&context.results_dir.join("generated-secrets.env"))?;
    let provided_secrets = load_secrets_as_map(&context.results_dir.join("provided-secrets.env"))?;

    let variables = context.get_template_variables_with_secrets(&generated_secrets, &provided_secrets);
    render_template_file(&template_path, &output_path, &variables)
}

/// Guard that cleans up the staging directory on drop (unless committed).
struct StagingGuard {
    staging_dir: PathBuf,
    committed: bool,
}

impl Drop for StagingGuard {
    fn drop(&mut self) {
        if !self.committed {
            if self.staging_dir.exists() {
                debug!("Cleaning up staging directory: {}", self.staging_dir.display());
                if let Err(e) = fs::remove_dir_all(&self.staging_dir) {
                    warn!("Failed to clean up staging directory: {}", e);
                }
            }
        }
    }
}

/// Run the full render pipeline using a staging directory.
///
/// Renders into a temporary `.results-staging` directory first.
/// On success, deletes the results dir and renames staging into its place.
/// On failure, the staging dir is removed and the results dir is untouched.
///
/// The `data` symlink inside results points to the real data directory
/// and is recreated by the pipeline — `remove_dir_all` only removes
/// the symlink, not its target.
pub fn run_render_pipeline(context: &RenderContext) -> Result<()> {
    let results_dir = &context.results_dir;
    let staging_dir = results_dir.with_file_name(".results-staging");

    info!(
        "Starting render pipeline for project: {}",
        context.manifest.project_name()
    );

    // Clean up any leftover staging directory from a previous crash
    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)
            .io_context("Failed to remove leftover staging directory")?;
    }

    fs::create_dir_all(&staging_dir)
        .io_context("Failed to create staging directory")?;

    let mut guard = StagingGuard {
        staging_dir: staging_dir.clone(),
        committed: false,
    };

    // Copy existing generated-secrets.env into staging for merge logic
    let existing_secrets = results_dir.join("generated-secrets.env");
    if existing_secrets.exists() {
        fs::copy(&existing_secrets, staging_dir.join("generated-secrets.env"))
            .io_context("Failed to copy generated-secrets.env into staging")?;
    }

    // Create a context that renders into the staging directory
    let staging_context = context.with_results_dir(staging_dir.clone());

    // Run the pipeline into staging
    run_render_pipeline_inner(&staging_context)?;

    // Success — replace results with staging.
    // Try the clean path first: delete results entirely, rename staging in.
    // If that fails (e.g. root-owned files from Docker bind mounts), fall
    // back to clearing what we can and moving entries individually.
    guard.committed = true;
    if results_dir.exists() {
        if fs::remove_dir_all(results_dir).is_ok() {
            // Clean path: directory gone, just rename staging
            fs::rename(&staging_dir, results_dir)
                .io_context("Failed to move staged results into place")?;
        } else {
            // Fallback: some entries couldn't be deleted (permission denied).
            // Remove what we can, then move staging entries over.
            warn!("Could not fully delete results dir (likely root-owned files from Docker), using fallback sync");
            if let Ok(entries) = fs::read_dir(results_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let removed = if path.is_dir() && !path.is_symlink() {
                        fs::remove_dir_all(&path)
                    } else {
                        fs::remove_file(&path)
                    };
                    if let Err(e) = removed {
                        debug!("Skipping undeletable entry '{}': {}", path.display(), e);
                    }
                }
            }
            // Move each staging entry into results
            for entry in fs::read_dir(&staging_dir)
                .io_context("Failed to read staging directory")?
            {
                let entry = entry.io_context("Failed to read staging entry")?;
                let dst = results_dir.join(entry.file_name());
                // Remove dst if it still exists (might be an undeletable dir)
                if dst.exists() || dst.symlink_metadata().is_ok() {
                    let _ = if dst.is_dir() && !dst.is_symlink() {
                        fs::remove_dir_all(&dst)
                    } else {
                        fs::remove_file(&dst)
                    };
                }
                fs::rename(entry.path(), &dst).io_context(format!(
                    "Failed to move '{}' into results",
                    entry.file_name().to_string_lossy()
                ))?;
            }
            // Clean up empty staging dir
            let _ = fs::remove_dir(&staging_dir);
        }
    } else {
        fs::rename(&staging_dir, results_dir)
            .io_context("Failed to move staged results into place")?;
    }

    info!("Render pipeline completed successfully");
    Ok(())
}

/// Inner pipeline implementation
fn run_render_pipeline_inner(context: &RenderContext) -> Result<()> {
    // Ensure results directory exists
    if !context.results_dir.exists() {
        fs::create_dir_all(&context.results_dir)
            .io_context("Failed to create results directory")?;
    }

    // Step 1: Render generated-secrets.env with merge logic
    render_generated_secrets(context)?;

    // Step 2: Copy provided-secrets.env
    copy_provided_secrets(context)?;

    // Step 3: Render templates/config directory
    render_config_templates(context)?;

    // Step 4: Render docker-compose.yaml with label flattening
    render_docker_compose(context)?;

    // Step 5: Setup data directory symlink
    setup_data_directory(context)?;

    // Step 6: Render admin-infos.yaml
    render_admin_infos(context)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_project(dir: &Path) {
        // Create manifest
        let manifest_content = r#"manifestVersion: "0.1"
metadata:
  name: test-project
  description: "Test project"
  version: "1.0.0"
spec:
  compose: {}
"#;
        fs::write(dir.join("mows-manifest.yaml"), manifest_content).unwrap();

        // Create values
        fs::write(dir.join("values.yaml"), "hostname: example.com\nport: 8080").unwrap();

        // Create templates directory
        fs::create_dir_all(dir.join("templates/config")).unwrap();
    }

    #[test]
    fn test_render_context_creation() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        assert_eq!(context.manifest.project_name(), "test-project");
    }

    #[test]
    fn test_get_template_variables() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());

        let context = RenderContext::new(dir.path()).unwrap();
        let vars = context.get_template_variables();

        if let gtmpl::Value::Object(map) = vars {
            assert!(map.contains_key("chart"));
            assert!(map.contains_key("hostname"));
            assert!(map.contains_key("port"));
        } else {
            panic!("Expected object");
        }
    }

    #[test]
    fn test_staging_guard_cleans_up_on_drop() {
        let dir = tempdir().unwrap();
        let staging = dir.path().join(".results.staging");
        fs::create_dir_all(&staging).unwrap();
        fs::write(staging.join("file.txt"), "content").unwrap();

        {
            let _guard = StagingGuard {
                staging_dir: staging.clone(),
                committed: false,
            };
        }

        assert!(!staging.exists(), "Staging dir should be cleaned up on drop");
    }

    #[test]
    fn test_staging_guard_skips_cleanup_when_committed() {
        let dir = tempdir().unwrap();
        let staging = dir.path().join(".results.staging");
        fs::create_dir_all(&staging).unwrap();

        {
            let _guard = StagingGuard {
                staging_dir: staging.clone(),
                committed: true,
            };
        }

        assert!(staging.exists(), "Committed staging dir should not be deleted");
    }

    #[test]
    fn test_staging_replaces_results_on_success() {
        let dir = tempdir().unwrap();
        let results = dir.path().join("results");
        let staging = dir.path().join(".results.staging");
        fs::create_dir_all(&results).unwrap();
        fs::create_dir_all(&staging).unwrap();

        fs::write(results.join("old.txt"), "stale").unwrap();
        fs::write(staging.join("new.txt"), "fresh").unwrap();

        // Simulate the commit: delete results, rename staging
        fs::remove_dir_all(&results).unwrap();
        fs::rename(&staging, &results).unwrap();

        assert!(!results.join("old.txt").exists(), "Stale file should be gone");
        assert_eq!(
            fs::read_to_string(results.join("new.txt")).unwrap(),
            "fresh"
        );
    }

    #[test]
    fn test_staging_data_symlink_target_survives() {
        let dir = tempdir().unwrap();
        let results = dir.path().join("results");
        let data_dir = dir.path().join("data");
        fs::create_dir_all(&results).unwrap();
        fs::create_dir_all(&data_dir).unwrap();
        fs::write(data_dir.join("important.bin"), "keep me").unwrap();

        // Create symlink inside results pointing to data
        std::os::unix::fs::symlink(&data_dir, results.join("data")).unwrap();

        // remove_dir_all removes the symlink, not the target
        fs::remove_dir_all(&results).unwrap();

        assert!(data_dir.exists(), "Data directory should survive");
        assert_eq!(
            fs::read_to_string(data_dir.join("important.bin")).unwrap(),
            "keep me"
        );
    }

}
