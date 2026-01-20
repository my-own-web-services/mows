use gtmpl_ng::{self as gtmpl};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Path, PathBuf};
use tracing::{debug, info, trace, warn};

use super::manifest::MowsManifest;
use super::secrets::{load_secrets_as_map, merge_generated_secrets};
use crate::error::{IoResultExt, MpmError, Result};
use crate::template::error::format_template_error;
use crate::template::render_template_string;
use crate::template::variables::load_variable_file;
use crate::tools::{flatten_labels_in_compose, FlattenLabelsError};
use crate::utils::parse_yaml;

/// File permission mode for secrets files: owner read/write only (rw-------).
/// Prevents world-readable credentials.
const SECRET_FILE_MODE: u32 = 0o600;

/// Directory permission mode: owner full, group/others read+execute (rwxr-xr-x).
/// Standard permission for directories that need to be traversable.
const DIRECTORY_MODE: u32 = 0o755;

/// Write a file with restricted permissions (600 - owner read/write only)
/// Used for secrets files to prevent world-readable credentials.
/// Permissions are set atomically at file creation to avoid race conditions.
pub fn write_secret_file(path: &Path, content: &str) -> Result<()> {
    // Set permissions at creation time to avoid race condition where file
    // exists briefly with default (potentially world-readable) permissions
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(SECRET_FILE_MODE)
        .open(path)
        .io_context(format!("Failed to create file '{}'", path.display()))?;

    file.write_all(content.as_bytes())
        .io_context(format!("Failed to write to '{}'", path.display()))?;

    Ok(())
}

/// Context for rendering templates
pub struct RenderContext {
    /// The manifest loaded from mows-manifest.yaml
    pub manifest: MowsManifest,
    /// Variables from values.yaml
    pub values: gtmpl::Value,
    /// The base directory (where mows-manifest.yaml is located)
    pub base_dir: std::path::PathBuf,
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
            base_dir: dir.to_path_buf(),
        })
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

/// Validate that a path is safely within a base directory.
/// Uses canonical path resolution to prevent path traversal attacks.
fn validate_path_within_dir(base_dir: &Path, relative_path: &str) -> Result<PathBuf> {
    // Reject absolute paths early
    if Path::new(relative_path).is_absolute() {
        return Err(MpmError::Path {
            path: relative_path.into(),
            message: "absolute paths not allowed".to_string(),
        });
    }

    // Construct the full path
    let full_path = base_dir.join(relative_path);

    // Canonicalize both paths to resolve symlinks and normalize
    // Note: canonicalize requires the path to exist, so we check the parent for new files
    let canonical_base = base_dir.canonicalize().map_err(|e| MpmError::Path {
        path: base_dir.to_path_buf(),
        message: format!("failed to resolve base directory: {}", e),
    })?;

    let canonical_full = full_path.canonicalize().map_err(|e| MpmError::Path {
        path: full_path.clone(),
        message: format!("failed to resolve path: {}", e),
    })?;

    // Verify the resolved path is within the base directory
    if !canonical_full.starts_with(&canonical_base) {
        return Err(MpmError::Path {
            path: relative_path.into(),
            message: "path traversal not allowed: resolved path is outside base directory"
                .to_string(),
        });
    }

    Ok(canonical_full)
}

/// Load values.yaml from a directory
fn load_values(dir: &Path, manifest: &MowsManifest) -> Result<gtmpl::Value> {
    // Check if custom values file path is specified in manifest
    if let Some(compose_config) = &manifest.spec.compose {
        if let Some(custom_path) = &compose_config.values_file_path {
            // Validate path is safely within the manifest directory
            let path = validate_path_within_dir(dir, custom_path).map_err(|e| MpmError::Path {
                path: custom_path.into(),
                message: format!("invalid valuesFilePath: {}", e),
            })?;

            debug!(
                "Loading values from custom path (manifest): {}",
                path.display()
            );
            return Ok(load_variable_file(&path)?);
        }
    }

    // Default behavior: search for standard values files
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
        MpmError::Template(format_template_error(
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
        return Err(MpmError::Path {
            path: input.to_path_buf(),
            message: format!(
                "Maximum directory depth ({}) exceeded. Possible symlink loop?",
                MAX_DIRECTORY_DEPTH
            ),
        });
    }

    // Check visited set size limit to prevent unbounded memory growth
    if visited.len() >= MAX_VISITED_DIRECTORIES {
        return Err(MpmError::Path {
            path: input.to_path_buf(),
            message: format!(
                "Too many directories visited ({}). Directory tree may be too large or contain many symlinks.",
                MAX_VISITED_DIRECTORIES
            ),
        });
    }

    if !input.is_dir() {
        return Err(MpmError::Path {
            path: input.to_path_buf(),
            message: "Not a directory".to_string(),
        });
    }

    // Get canonical path for loop detection
    let canonical = input.canonicalize()
        .io_context(format!("Failed to resolve path '{}'", input.display()))?;

    // Check for symlink loops
    if !visited.insert(canonical.clone()) {
        return Err(MpmError::Path {
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
pub fn render_generated_secrets(ctx: &RenderContext) -> Result<()> {
    let template_path = ctx.base_dir.join("templates/generated-secrets.env");
    let results_dir = ctx.base_dir.join("results");
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

    let variables = ctx.get_template_variables();

    let rendered = render_template_string(&template_content, &variables).map_err(|(error, preamble_lines)| {
        MpmError::Template(format_template_error(
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
pub fn copy_provided_secrets(ctx: &RenderContext) -> Result<()> {
    let source_path = ctx.base_dir.join("provided-secrets.env");
    let results_dir = ctx.base_dir.join("results");
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
pub fn render_config_templates(ctx: &RenderContext) -> Result<()> {
    let config_dir = ctx.base_dir.join("templates/config");
    let output_dir = ctx.base_dir.join("results/config");

    if !config_dir.exists() {
        debug!("No templates/config directory found");
        return Ok(());
    }

    info!("Rendering templates/config directory");

    let variables = ctx.get_template_variables();
    render_template_directory(&config_dir, &output_dir, &variables)
}

/// Render docker-compose.yaml with label flattening
pub fn render_docker_compose(ctx: &RenderContext) -> Result<()> {
    let templates_dir = ctx.base_dir.join("templates");

    // Find docker-compose template
    let template_path = if templates_dir.join("docker-compose.yaml").exists() {
        templates_dir.join("docker-compose.yaml")
    } else if templates_dir.join("docker-compose.yml").exists() {
        templates_dir.join("docker-compose.yml")
    } else {
        return Err(MpmError::Path {
            path: templates_dir,
            message: "No docker-compose.yaml or docker-compose.yml template found".to_string(),
        });
    };

    let output_path = ctx.base_dir.join("results").join(
        template_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
    );

    info!("Rendering docker-compose template");

    // First render the template
    let variables = ctx.get_template_variables();
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
pub fn setup_data_directory(ctx: &RenderContext) -> Result<()> {
    let data_dir = ctx.base_dir.join("data");
    let results_dir = ctx.base_dir.join("results");
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
            return Err(MpmError::io(
                format!("Failed to check existing path '{}'", symlink_path.display()),
                e,
            ));
        }
    }

    // Create symlink using absolute path to avoid resolution issues
    let absolute_data_dir = if data_dir.is_absolute() {
        data_dir.clone()
    } else {
        ctx.base_dir.join(&data_dir)
    };

    info!("Creating data directory symlink");
    std::os::unix::fs::symlink(&absolute_data_dir, &symlink_path)
        .io_context("Failed to create data symlink")?;

    Ok(())
}

/// Render admin-infos.yaml with secrets variables
pub fn render_admin_infos(ctx: &RenderContext) -> Result<()> {
    let template_path = ctx.base_dir.join("templates/admin-infos.yaml");
    let output_path = ctx.base_dir.join("admin-infos.yaml");

    if !template_path.exists() {
        debug!("No admin-infos.yaml template found");
        return Ok(());
    }

    info!("Rendering admin-infos.yaml");

    // Load secrets
    let generated_secrets = load_secrets_as_map(&ctx.base_dir.join("results/generated-secrets.env"))?;
    let provided_secrets = load_secrets_as_map(&ctx.base_dir.join("results/provided-secrets.env"))?;

    let variables = ctx.get_template_variables_with_secrets(&generated_secrets, &provided_secrets);
    render_template_file(&template_path, &output_path, &variables)
}

/// Backup state for rollback on pipeline failure.
///
/// Implements `Drop` to auto-restore on panic, ensuring the backup directory
/// is not leaked even if the pipeline fails unexpectedly.
struct PipelineBackup {
    /// Path to backup directory (if results existed)
    backup_dir: Option<PathBuf>,
    /// Path to results directory
    results_dir: PathBuf,
    /// Whether the backup has been finalized (committed or restored)
    finalized: bool,
}

impl PipelineBackup {
    /// Create a backup of the current state by renaming results to a backup location
    fn create(results_dir: &Path) -> Result<Self> {
        let backup_dir = if results_dir.exists() {
            let backup_path = results_dir.with_file_name(".results.backup");
            // Remove any existing backup
            if backup_path.exists() {
                fs::remove_dir_all(&backup_path)
                    .io_context("Failed to remove old backup directory")?;
            }
            // Rename results to backup
            debug!("Backing up results directory to {}", backup_path.display());
            fs::rename(results_dir, &backup_path)
                .io_context("Failed to backup results directory")?;

            // Create fresh results directory
            fs::create_dir_all(results_dir)
                .io_context("Failed to create fresh results directory")?;

            // Copy generated-secrets.env back for merge logic
            let backup_secrets = backup_path.join("generated-secrets.env");
            if backup_secrets.exists() {
                let new_secrets = results_dir.join("generated-secrets.env");
                fs::copy(&backup_secrets, &new_secrets)
                    .io_context("Failed to copy generated-secrets.env for merge")?;
            }

            Some(backup_path)
        } else {
            None
        };

        Ok(PipelineBackup {
            backup_dir,
            results_dir: results_dir.to_path_buf(),
            finalized: false,
        })
    }

    /// Restore from backup on failure
    fn restore(mut self) -> Result<()> {
        self.finalized = true;
        self.do_restore()
    }

    /// Internal restore logic (used by both restore() and Drop)
    fn do_restore(&self) -> Result<()> {
        warn!("Pipeline failed, attempting to restore previous state");

        // Remove the partially-created results directory
        if self.results_dir.exists() {
            debug!("Removing partial results directory");
            fs::remove_dir_all(&self.results_dir)
                .io_context("Failed to remove partial results directory")?;
        }

        // Restore from backup if we had one
        if let Some(ref backup_path) = self.backup_dir {
            debug!("Restoring results from backup");
            fs::rename(backup_path, &self.results_dir)
                .io_context("Failed to restore results from backup")?;
        }

        Ok(())
    }

    /// Commit the changes by removing the backup (called on success)
    fn commit(mut self) -> Result<()> {
        self.finalized = true;
        if let Some(ref backup_path) = self.backup_dir {
            debug!("Removing backup directory after successful pipeline");
            fs::remove_dir_all(backup_path)
                .io_context("Failed to remove backup directory")?;
        }
        Ok(())
    }
}

impl Drop for PipelineBackup {
    fn drop(&mut self) {
        // If not finalized (panic occurred), attempt to restore
        if !self.finalized {
            warn!("PipelineBackup dropped without finalization, attempting auto-restore");
            // Ignore errors in Drop - we can't do much about them
            if let Err(e) = self.do_restore() {
                warn!("Failed to auto-restore on drop: {}", e);
            }
        }
    }
}

/// Run the full render pipeline with cleanup on failure
pub fn run_render_pipeline(ctx: &RenderContext) -> Result<()> {
    let results_dir = ctx.base_dir.join("results");

    info!(
        "Starting render pipeline for project: {}",
        ctx.manifest.project_name()
    );

    // Create backup for potential rollback
    let backup = PipelineBackup::create(&results_dir)?;

    // Run the pipeline, rolling back on failure
    match run_render_pipeline_inner(ctx, &results_dir) {
        Ok(()) => {
            info!("Render pipeline completed successfully");
            // Remove backup on success
            backup.commit()?;
            Ok(())
        }
        Err(e) => {
            // Attempt to restore previous state
            if let Err(restore_err) = backup.restore() {
                // If restoration also fails, report both errors
                return Err(MpmError::Message(format!(
                    "Pipeline failed: {}\nAdditionally, failed to restore previous state: {}",
                    e, restore_err
                )));
            }
            Err(e)
        }
    }
}

/// Inner pipeline implementation
fn run_render_pipeline_inner(ctx: &RenderContext, results_dir: &Path) -> Result<()> {
    // Ensure results directory exists (backup creates it if results existed before,
    // but we need to create it if this is a fresh project)
    if !results_dir.exists() {
        fs::create_dir_all(results_dir)
            .io_context("Failed to create results directory")?;
    }

    // Step 1: Render generated-secrets.env with merge logic
    render_generated_secrets(ctx)?;

    // Step 2: Copy provided-secrets.env
    copy_provided_secrets(ctx)?;

    // Step 3: Render templates/config directory
    render_config_templates(ctx)?;

    // Step 4: Render docker-compose.yaml with label flattening
    render_docker_compose(ctx)?;

    // Step 5: Setup data directory symlink
    setup_data_directory(ctx)?;

    // Step 6: Render admin-infos.yaml
    render_admin_infos(ctx)?;

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

        let ctx = RenderContext::new(dir.path()).unwrap();
        assert_eq!(ctx.manifest.project_name(), "test-project");
    }

    #[test]
    fn test_get_template_variables() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());

        let ctx = RenderContext::new(dir.path()).unwrap();
        let vars = ctx.get_template_variables();

        if let gtmpl::Value::Object(map) = vars {
            assert!(map.contains_key("chart"));
            assert!(map.contains_key("hostname"));
            assert!(map.contains_key("port"));
        } else {
            panic!("Expected object");
        }
    }

    #[test]
    fn test_pipeline_backup_restore_with_existing_results() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        fs::create_dir_all(&results_dir).unwrap();

        // Create files in results
        let secrets_path = results_dir.join("generated-secrets.env");
        let compose_path = results_dir.join("docker-compose.yaml");
        fs::write(&secrets_path, "SECRET=original_value").unwrap();
        fs::write(&compose_path, "services: {}").unwrap();

        // Create backup (moves results to .results.backup, creates fresh results with secrets)
        let backup = PipelineBackup::create(&results_dir).unwrap();

        // Results directory should exist with only generated-secrets.env copied back
        assert!(results_dir.exists());
        assert!(secrets_path.exists());
        assert!(!compose_path.exists()); // compose was not copied back

        // Simulate pipeline creating new results
        fs::write(&secrets_path, "SECRET=modified_value").unwrap();
        fs::write(&compose_path, "services: {new: true}").unwrap();

        // Restore backup
        backup.restore().unwrap();

        // Verify original values are restored
        let secrets_content = fs::read_to_string(&secrets_path).unwrap();
        assert_eq!(secrets_content, "SECRET=original_value");
        let compose_content = fs::read_to_string(&compose_path).unwrap();
        assert_eq!(compose_content, "services: {}");
    }

    #[test]
    fn test_pipeline_backup_restore_removes_new_results() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");

        // No results directory initially
        assert!(!results_dir.exists());

        // Create backup (notes that results didn't exist)
        let backup = PipelineBackup::create(&results_dir).unwrap();

        // Simulate pipeline creating results
        fs::create_dir_all(&results_dir).unwrap();
        fs::write(results_dir.join("docker-compose.yaml"), "services: {}").unwrap();

        // Restore backup
        backup.restore().unwrap();

        // Verify results directory is removed
        assert!(!results_dir.exists());
    }

    #[test]
    fn test_pipeline_backup_commit_removes_backup() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        let backup_dir = dir.path().join(".results.backup");
        fs::create_dir_all(&results_dir).unwrap();
        fs::write(results_dir.join("test.txt"), "original").unwrap();

        // Create backup
        let backup = PipelineBackup::create(&results_dir).unwrap();

        // Backup directory should exist
        assert!(backup_dir.exists());
        // Results directory should exist (created fresh by backup)
        assert!(results_dir.exists());

        // Simulate successful pipeline writing new content
        fs::write(results_dir.join("test.txt"), "new").unwrap();

        // Commit (removes backup)
        backup.commit().unwrap();

        // Backup should be gone, new results should remain
        assert!(!backup_dir.exists());
        assert!(results_dir.exists());
        let content = fs::read_to_string(results_dir.join("test.txt")).unwrap();
        assert_eq!(content, "new");
    }

    #[test]
    fn test_validate_path_within_dir_allows_valid_paths() {
        let dir = tempdir().unwrap();
        let subdir = dir.path().join("subdir");
        fs::create_dir_all(&subdir).unwrap();
        let file = subdir.join("file.txt");
        fs::write(&file, "test").unwrap();

        // Valid relative path should succeed
        let result = validate_path_within_dir(dir.path(), "subdir/file.txt");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), file.canonicalize().unwrap());
    }

    #[test]
    fn test_validate_path_within_dir_rejects_absolute_path() {
        let dir = tempdir().unwrap();

        let result = validate_path_within_dir(dir.path(), "/etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("absolute paths not allowed"));
    }

    #[test]
    fn test_validate_path_within_dir_rejects_traversal() {
        let dir = tempdir().unwrap();
        let subdir = dir.path().join("subdir");
        fs::create_dir_all(&subdir).unwrap();

        // Create a file outside the base directory to traverse to
        let outside_file = dir.path().join("outside.txt");
        fs::write(&outside_file, "outside").unwrap();

        // Attempt path traversal from subdir
        let result = validate_path_within_dir(&subdir, "../outside.txt");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("outside base directory"));
    }

    #[test]
    fn test_validate_path_within_dir_rejects_symlink_traversal() {
        let dir = tempdir().unwrap();
        let base = dir.path().join("base");
        fs::create_dir_all(&base).unwrap();

        // Create a symlink pointing outside the base directory
        let outside_file = dir.path().join("secret.txt");
        fs::write(&outside_file, "secret").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            let link = base.join("link");
            symlink(&outside_file, &link).unwrap();

            // Symlink traversal should be detected
            let result = validate_path_within_dir(&base, "link");
            assert!(result.is_err());
            assert!(result.unwrap_err().to_string().contains("outside base directory"));
        }
    }

}
