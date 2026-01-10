use gtmpl_ng::{self as gtmpl};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use tracing::{debug, info, trace, warn};

use super::manifest::MowsManifest;
use super::secrets::{load_secrets_as_map, merge_generated_secrets};
use crate::template::error::format_template_error;
use crate::template::variables::load_variable_file;
use crate::tools::{flatten_labels_in_compose, FlattenLabelsError};
use crate::utils::parse_yaml;

/// Write a file with restricted permissions (600 - owner read/write only)
/// Used for secrets files to prevent world-readable credentials
pub fn write_secret_file(path: &Path, content: &str) -> Result<(), String> {
    let mut file = File::create(path)
        .map_err(|e| format!("Failed to create file '{}': {}", path.display(), e))?;

    // Set permissions to 600 (rw-------) before writing content
    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, permissions)
        .map_err(|e| format!("Failed to set permissions on '{}': {}", path.display(), e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write to '{}': {}", path.display(), e))?;

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
    pub fn new(dir: &Path) -> Result<Self, String> {
        let manifest = MowsManifest::load(dir)?;

        // Load values.yaml
        let values = load_values(dir)?;

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

/// Load values.yaml from a directory
fn load_values(dir: &Path) -> Result<gtmpl::Value, String> {
    let candidates = ["values.yaml", "values.yml", "values.json"];

    for name in candidates {
        let path = dir.join(name);
        if path.is_file() {
            debug!("Loading values from: {}", path.display());
            return load_variable_file(&path);
        }
    }

    debug!("No values file found, using empty values");
    Ok(gtmpl::Value::Object(HashMap::new()))
}

/// Clear the results directory, but preserve generated-secrets.env
pub fn clear_results_directory(results_dir: &Path) -> Result<(), String> {
    if !results_dir.exists() {
        debug!("Results directory does not exist, nothing to clear");
        return Ok(());
    }

    let generated_secrets_path = results_dir.join("generated-secrets.env");
    let generated_secrets_backup = if generated_secrets_path.exists() {
        debug!("Backing up generated-secrets.env");
        Some(fs::read_to_string(&generated_secrets_path).map_err(|e| {
            format!(
                "Failed to read generated-secrets.env for backup: {}",
                e
            )
        })?)
    } else {
        None
    };

    // Remove the results directory
    debug!("Removing results directory: {}", results_dir.display());
    fs::remove_dir_all(results_dir)
        .map_err(|e| format!("Failed to remove results directory: {}", e))?;

    // Recreate the directory
    fs::create_dir_all(results_dir)
        .map_err(|e| format!("Failed to create results directory: {}", e))?;

    // Restore generated-secrets.env if it existed
    if let Some(content) = generated_secrets_backup {
        debug!("Restoring generated-secrets.env");
        fs::write(&generated_secrets_path, content)
            .map_err(|e| format!("Failed to restore generated-secrets.env: {}", e))?;
    }

    Ok(())
}

/// Render a single template file
fn render_template_file(
    input: &Path,
    output: &Path,
    variables: &gtmpl::Value,
) -> Result<(), String> {
    use gtmpl_ng::all_functions::all_functions;

    trace!("Rendering: {} -> {}", input.display(), output.display());

    let template_content = fs::read_to_string(input)
        .map_err(|e| format!("Failed to read template '{}': {}", input.display(), e))?;

    let mut template = gtmpl::Template::default();

    // Add all template functions
    for (name, func) in all_functions() {
        template.add_func(name, func);
    }

    // Generate variable definitions preamble
    let full_template = if let gtmpl::Value::Object(map) = variables {
        if map.is_empty() {
            template_content.clone()
        } else {
            let preamble: String = map
                .keys()
                .map(|k| format!("{{{{- ${k} := .{k} }}}}\n"))
                .collect();
            format!("{}{}", preamble, template_content)
        }
    } else {
        template_content.clone()
    };

    template
        .parse(&full_template)
        .map_err(|e| format!("Failed to parse template '{}': {}", input.display(), e))?;

    let context = gtmpl::Context::from(variables.clone());
    let rendered = template
        .render(&context)
        .map_err(|e| format!("Failed to render template '{}': {}", input.display(), e))?;

    // Create parent directories
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    fs::write(output, rendered)
        .map_err(|e| format!("Failed to write output '{}': {}", output.display(), e))?;

    Ok(())
}

/// Maximum directory depth to prevent infinite recursion from symlink loops
const MAX_DIRECTORY_DEPTH: usize = 50;

/// Render a directory of templates with symlink loop detection
fn render_template_directory(
    input: &Path,
    output: &Path,
    variables: &gtmpl::Value,
) -> Result<(), String> {
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
) -> Result<(), String> {
    debug!("Rendering directory: {} -> {}", input.display(), output.display());

    // Check depth limit
    if depth > MAX_DIRECTORY_DEPTH {
        return Err(format!(
            "Maximum directory depth ({}) exceeded at '{}'. Possible symlink loop?",
            MAX_DIRECTORY_DEPTH,
            input.display()
        ));
    }

    if !input.is_dir() {
        return Err(format!("{} is not a directory", input.display()));
    }

    // Get canonical path for loop detection
    let canonical = input.canonicalize().map_err(|e| {
        format!(
            "Failed to resolve path '{}': {}",
            input.display(),
            e
        )
    })?;

    // Check for symlink loops
    if !visited.insert(canonical.clone()) {
        return Err(format!(
            "Symlink loop detected: '{}' was already visited",
            input.display()
        ));
    }

    fs::create_dir_all(output)
        .map_err(|e| format!("Failed to create output directory: {}", e))?;

    for entry in fs::read_dir(input)
        .map_err(|e| format!("Failed to read directory '{}': {}", input.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
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
pub fn render_generated_secrets(ctx: &RenderContext) -> Result<(), String> {
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
        Some(fs::read_to_string(&output_path).map_err(|e| {
            format!("Failed to read existing generated-secrets.env: {}", e)
        })?)
    } else {
        None
    };

    // Render the template
    let template_content = fs::read_to_string(&template_path)
        .map_err(|e| format!("Failed to read generated-secrets template: {}", e))?;

    let variables = ctx.get_template_variables();

    use gtmpl_ng::all_functions::all_functions;
    let mut template = gtmpl::Template::default();
    for (name, func) in all_functions() {
        template.add_func(name, func);
    }

    // Generate variable definitions preamble
    let (full_template, preamble_lines) = if let gtmpl::Value::Object(map) = &variables {
        if map.is_empty() {
            (template_content.clone(), 0)
        } else {
            let preamble: String = map
                .keys()
                .map(|k| format!("{{{{- ${k} := .{k} }}}}\n"))
                .collect();
            let preamble_line_count = preamble.lines().count();
            (format!("{}{}", preamble, template_content), preamble_line_count)
        }
    } else {
        (template_content.clone(), 0)
    };

    template.parse(&full_template).map_err(|e| {
        format_template_error(
            &template_path,
            &template_content,
            &gtmpl::TemplateError::ParseError(e),
            preamble_lines,
            5,
            Some(&variables),
        )
    })?;

    let context = gtmpl::Context::from(variables.clone());
    let rendered = template.render(&context).map_err(|e| {
        format_template_error(
            &template_path,
            &template_content,
            &gtmpl::TemplateError::ExecError(e),
            preamble_lines,
            5,
            Some(&variables),
        )
    })?;

    // Merge with existing content
    let merged = merge_generated_secrets(existing_content.as_deref(), &rendered);

    // Ensure results directory exists
    fs::create_dir_all(&results_dir)
        .map_err(|e| format!("Failed to create results directory: {}", e))?;

    // Write with restricted permissions (600) to protect secrets
    write_secret_file(&output_path, &merged)?;

    Ok(())
}

/// Copy provided-secrets.env to results with secure permissions
pub fn copy_provided_secrets(ctx: &RenderContext) -> Result<(), String> {
    let source_path = ctx.base_dir.join("provided-secrets.env");
    let results_dir = ctx.base_dir.join("results");
    let output_path = results_dir.join("provided-secrets.env");

    if !source_path.exists() {
        debug!("No provided-secrets.env found");
        return Ok(());
    }

    info!("Copying provided-secrets.env");

    fs::create_dir_all(&results_dir)
        .map_err(|e| format!("Failed to create results directory: {}", e))?;

    // Read and write with secure permissions instead of copy
    // to ensure the destination has restricted permissions (600)
    let content = fs::read_to_string(&source_path)
        .map_err(|e| format!("Failed to read provided-secrets.env: {}", e))?;

    write_secret_file(&output_path, &content)?;

    Ok(())
}

/// Render the templates/config directory
pub fn render_config_templates(ctx: &RenderContext) -> Result<(), String> {
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
pub fn render_docker_compose(ctx: &RenderContext) -> Result<(), String> {
    let templates_dir = ctx.base_dir.join("templates");

    // Find docker-compose template
    let template_path = if templates_dir.join("docker-compose.yaml").exists() {
        templates_dir.join("docker-compose.yaml")
    } else if templates_dir.join("docker-compose.yml").exists() {
        templates_dir.join("docker-compose.yml")
    } else {
        return Err("No docker-compose.yaml or docker-compose.yml template found".to_string());
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
        .map_err(|e| format!("Failed to read rendered docker-compose: {}", e))?;

    let yaml_value: serde_yaml::Value = parse_yaml(&content, Some(&output_path))?;

    // Check if this looks like a docker-compose file with services
    if yaml_value.get("services").is_some() {
        debug!("Flattening labels in docker-compose file");
        match flatten_labels_in_compose(yaml_value) {
            Ok(flattened) => {
                let output = serde_yaml::to_string(&flattened)
                    .map_err(|e| format!("Failed to serialize docker-compose: {}", e))?;
                fs::write(&output_path, output)
                    .map_err(|e| format!("Failed to write docker-compose: {}", e))?;
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
pub fn setup_data_directory(ctx: &RenderContext) -> Result<(), String> {
    let data_dir = ctx.base_dir.join("data");
    let results_dir = ctx.base_dir.join("results");
    let symlink_path = results_dir.join("data");

    // Create data directory if it doesn't exist
    if !data_dir.exists() {
        info!("Creating data directory");
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    // Set permissions to 755 (rwxr-xr-x) - standard directory permissions
    // Directories need execute bit for users to enter them
    debug!("Setting data directory permissions to 755");
    let permissions = fs::Permissions::from_mode(0o755);
    fs::set_permissions(&data_dir, permissions)
        .map_err(|e| format!("Failed to set data directory permissions: {}", e))?;

    // Create results directory if needed
    fs::create_dir_all(&results_dir)
        .map_err(|e| format!("Failed to create results directory: {}", e))?;

    // Remove existing symlink/file/directory if present
    // Use symlink_metadata to check without following symlinks
    match fs::symlink_metadata(&symlink_path) {
        Ok(metadata) => {
            debug!("Removing existing path at symlink location");
            if metadata.is_symlink() || metadata.is_file() {
                fs::remove_file(&symlink_path)
                    .map_err(|e| format!("Failed to remove existing file/symlink: {}", e))?;
            } else if metadata.is_dir() {
                // Only remove if it's an empty directory, otherwise error
                fs::remove_dir(&symlink_path).map_err(|e| {
                    format!(
                        "Failed to remove existing directory at '{}'. \
                         If it contains files, please remove it manually: {}",
                        symlink_path.display(),
                        e
                    )
                })?;
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Path doesn't exist, which is fine
        }
        Err(e) => {
            return Err(format!(
                "Failed to check existing path '{}': {}",
                symlink_path.display(),
                e
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
        .map_err(|e| format!("Failed to create data symlink: {}", e))?;

    Ok(())
}

/// Render admin-infos.yaml with secrets variables
pub fn render_admin_infos(ctx: &RenderContext) -> Result<(), String> {
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

/// Backup state for rollback on pipeline failure
struct PipelineBackup {
    /// Backup of generated-secrets.env content
    generated_secrets_backup: Option<String>,
    /// Whether we had a results directory before
    had_results_dir: bool,
    /// Path to results directory
    results_dir: PathBuf,
}

impl PipelineBackup {
    /// Create a backup of the current state
    fn create(results_dir: &Path) -> Self {
        let generated_secrets_path = results_dir.join("generated-secrets.env");
        let generated_secrets_backup = if generated_secrets_path.exists() {
            fs::read_to_string(&generated_secrets_path).ok()
        } else {
            None
        };

        PipelineBackup {
            generated_secrets_backup,
            had_results_dir: results_dir.exists(),
            results_dir: results_dir.to_path_buf(),
        }
    }

    /// Restore from backup on failure
    fn restore(self) -> Result<(), String> {
        warn!("Pipeline failed, attempting to restore previous state");

        // If we didn't have a results directory before, remove it entirely
        if !self.had_results_dir {
            if self.results_dir.exists() {
                debug!("Removing results directory created during failed pipeline");
                fs::remove_dir_all(&self.results_dir).map_err(|e| {
                    format!(
                        "Failed to cleanup results directory after pipeline failure: {}",
                        e
                    )
                })?;
            }
            return Ok(());
        }

        // If we had results directory, restore generated-secrets.env if we had a backup
        if let Some(content) = self.generated_secrets_backup {
            let secrets_path = self.results_dir.join("generated-secrets.env");
            debug!("Restoring generated-secrets.env from backup");
            // Ensure results directory exists for restoration
            if !self.results_dir.exists() {
                fs::create_dir_all(&self.results_dir).map_err(|e| {
                    format!("Failed to recreate results directory for restoration: {}", e)
                })?;
            }
            write_secret_file(&secrets_path, &content)?;
        }

        Ok(())
    }
}

/// Run the full render pipeline with cleanup on failure
pub fn run_render_pipeline(ctx: &RenderContext) -> Result<(), String> {
    let results_dir = ctx.base_dir.join("results");

    info!(
        "Starting render pipeline for project: {}",
        ctx.manifest.project_name()
    );

    // Create backup for potential rollback
    let backup = PipelineBackup::create(&results_dir);

    // Run the pipeline, rolling back on failure
    match run_render_pipeline_inner(ctx, &results_dir) {
        Ok(()) => {
            info!("Render pipeline completed successfully");
            Ok(())
        }
        Err(e) => {
            // Attempt to restore previous state
            if let Err(restore_err) = backup.restore() {
                // If restoration also fails, report both errors
                return Err(format!(
                    "Pipeline failed: {}\nAdditionally, failed to restore previous state: {}",
                    e, restore_err
                ));
            }
            Err(e)
        }
    }
}

/// Inner pipeline implementation
fn run_render_pipeline_inner(ctx: &RenderContext, results_dir: &Path) -> Result<(), String> {
    // Step 1: Clear results directory (preserving generated-secrets.env)
    clear_results_directory(results_dir)?;

    // Step 2: Render generated-secrets.env with merge logic
    render_generated_secrets(ctx)?;

    // Step 3: Copy provided-secrets.env
    copy_provided_secrets(ctx)?;

    // Step 4: Render templates/config directory
    render_config_templates(ctx)?;

    // Step 5: Render docker-compose.yaml with label flattening
    render_docker_compose(ctx)?;

    // Step 6: Setup data directory symlink
    setup_data_directory(ctx)?;

    // Step 7: Render admin-infos.yaml
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
spec: {}
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
    fn test_clear_results_preserves_generated_secrets() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        fs::create_dir_all(&results_dir).unwrap();

        // Create generated-secrets.env
        fs::write(
            results_dir.join("generated-secrets.env"),
            "SECRET=preserved",
        )
        .unwrap();

        // Create another file that should be deleted
        fs::write(results_dir.join("other.txt"), "delete me").unwrap();

        clear_results_directory(&results_dir).unwrap();

        // Verify generated-secrets.env is preserved
        assert!(results_dir.join("generated-secrets.env").exists());
        let content = fs::read_to_string(results_dir.join("generated-secrets.env")).unwrap();
        assert_eq!(content, "SECRET=preserved");

        // Verify other files are deleted
        assert!(!results_dir.join("other.txt").exists());
    }

    #[test]
    fn test_pipeline_backup_restore_with_existing_secrets() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        fs::create_dir_all(&results_dir).unwrap();

        // Create generated-secrets.env
        let secrets_path = results_dir.join("generated-secrets.env");
        fs::write(&secrets_path, "SECRET=original_value").unwrap();

        // Create backup
        let backup = PipelineBackup::create(&results_dir);

        // Simulate pipeline modifying the secrets
        fs::write(&secrets_path, "SECRET=modified_value").unwrap();

        // Restore backup
        backup.restore().unwrap();

        // Verify original value is restored
        let content = fs::read_to_string(&secrets_path).unwrap();
        assert_eq!(content, "SECRET=original_value");
    }

    #[test]
    fn test_pipeline_backup_restore_removes_new_results() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");

        // No results directory initially
        assert!(!results_dir.exists());

        // Create backup (notes that results didn't exist)
        let backup = PipelineBackup::create(&results_dir);

        // Simulate pipeline creating results
        fs::create_dir_all(&results_dir).unwrap();
        fs::write(results_dir.join("docker-compose.yaml"), "services: {}").unwrap();

        // Restore backup
        backup.restore().unwrap();

        // Verify results directory is removed
        assert!(!results_dir.exists());
    }

}
