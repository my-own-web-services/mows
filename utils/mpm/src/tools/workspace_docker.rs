use serde::Deserialize;
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::debug;
use walkdir::WalkDir;

/// Main entry point for the workspace-docker command
pub fn workspace_docker_command(all: bool, path: &Option<PathBuf>) -> Result<(), String> {
    let start_path = match path {
        Some(p) => p.clone(),
        None => std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?,
    };
    let start_path = fs::canonicalize(&start_path)
        .map_err(|e| format!("Failed to resolve path '{}': {}", start_path.display(), e))?;

    // Find workspace root
    let workspace_root = find_workspace_root(&start_path)?;
    debug!("Found workspace root: {}", workspace_root.display());

    // Parse root workspace
    let workspace_toml_path = workspace_root.join("Cargo.toml");
    let workspace_config = parse_workspace_toml(&workspace_toml_path)?;

    // Find packages to process
    let packages = if all {
        find_docker_packages(&workspace_root)?
    } else {
        let package_path = find_nearest_docker_package(&start_path, &workspace_root)?;
        vec![package_path]
    };

    if packages.is_empty() {
        return Err("No packages with docker-compose files found".to_string());
    }

    // Process each package
    for package_path in &packages {
        debug!("Processing package: {}", package_path.display());
        generate_for_package(&workspace_root, package_path, &workspace_config)?;
        println!(
            "Generated: {}",
            package_path.join("cargo-workspace-docker.toml").display()
        );
    }

    Ok(())
}

/// Find the workspace root by traversing up from start path
fn find_workspace_root(start: &Path) -> Result<PathBuf, String> {
    let mut current = start.to_path_buf();

    loop {
        let cargo_toml = current.join("Cargo.toml");
        if cargo_toml.exists() {
            let content = fs::read_to_string(&cargo_toml)
                .map_err(|e| format!("Failed to read {}: {}", cargo_toml.display(), e))?;

            // Check if this is a workspace root
            if content.contains("[workspace]") {
                return Ok(current);
            }
        }

        if !current.pop() {
            break;
        }
    }

    Err(format!(
        "Could not find workspace root from {}",
        start.display()
    ))
}

/// Find the nearest package directory with docker-compose
fn find_nearest_docker_package(start: &Path, workspace_root: &Path) -> Result<PathBuf, String> {
    let mut current = start.to_path_buf();

    loop {
        if has_docker_compose(&current) && current.join("Cargo.toml").exists() {
            return Ok(current);
        }

        // Don't go above workspace root
        if current == workspace_root {
            break;
        }

        if !current.pop() {
            break;
        }
    }

    Err(format!(
        "No package with docker-compose found at or above {}",
        start.display()
    ))
}

/// Check if a directory has docker-compose files
fn has_docker_compose(path: &Path) -> bool {
    path.join("docker-compose.yml").exists() || path.join("docker-compose.yaml").exists()
}

/// Find all packages with docker-compose files in the workspace
fn find_docker_packages(workspace_root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut packages = Vec::new();
    let exclude_dirs = ["target", ".git", "node_modules", "temp", "tmp", ".cache"];

    for entry in WalkDir::new(workspace_root)
        .max_depth(10)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !exclude_dirs.contains(&name.as_ref())
        })
        .filter_map(|e| e.ok()) // Skip entries with permission errors
    {
        let path = entry.path();

        if path.is_dir() && has_docker_compose(path) && path.join("Cargo.toml").exists() {
            packages.push(path.to_path_buf());
        }
    }

    Ok(packages)
}

// ============================================================================
// TOML Parsing Structures
// ============================================================================

#[derive(Debug, Deserialize)]
struct CargoToml {
    package: Option<Package>,
    workspace: Option<Workspace>,
    dependencies: Option<BTreeMap<String, toml::Value>>,
    #[serde(rename = "dev-dependencies")]
    dev_dependencies: Option<BTreeMap<String, toml::Value>>,
    #[serde(rename = "build-dependencies")]
    build_dependencies: Option<BTreeMap<String, toml::Value>>,
    profile: Option<toml::Value>,
}

#[derive(Debug, Deserialize)]
struct Package {
    #[allow(dead_code)]
    name: Option<String>,
    version: Option<toml::Value>,
}

#[derive(Debug, Deserialize)]
struct Workspace {
    members: Option<Vec<String>>,
    dependencies: Option<BTreeMap<String, toml::Value>>,
    lints: Option<toml::Value>,
    package: Option<WorkspacePackage>,
}

#[derive(Debug, Deserialize, Clone)]
struct WorkspacePackage {
    edition: Option<String>,
    version: Option<String>,
}

/// Parsed workspace configuration
#[derive(Debug)]
struct WorkspaceConfig {
    dependencies: BTreeMap<String, WorkspaceDep>,
    lints: Option<toml::Value>,
    package: Option<WorkspacePackage>,
    profile: Option<toml::Value>,
}

#[derive(Debug, Clone)]
struct WorkspaceDep {
    version: Option<String>,
    path: Option<String>,
    features: Option<Vec<String>>,
    default_features: Option<bool>,
    optional: Option<bool>,
    raw: toml::Value,
}

/// Parse the root workspace Cargo.toml
fn parse_workspace_toml(path: &Path) -> Result<WorkspaceConfig, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    let cargo: CargoToml =
        toml::from_str(&content).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;

    let workspace = cargo
        .workspace
        .ok_or_else(|| format!("{} is not a workspace root", path.display()))?;

    let mut dependencies = BTreeMap::new();

    if let Some(deps) = workspace.dependencies {
        for (name, value) in deps {
            let dep = parse_workspace_dep(&value);
            dependencies.insert(name, dep);
        }
    }

    Ok(WorkspaceConfig {
        dependencies,
        lints: workspace.lints,
        package: workspace.package,
        profile: cargo.profile,
    })
}

fn parse_workspace_dep(value: &toml::Value) -> WorkspaceDep {
    match value {
        toml::Value::String(version) => WorkspaceDep {
            version: Some(version.clone()),
            path: None,
            features: None,
            default_features: None,
            optional: None,
            raw: value.clone(),
        },
        toml::Value::Table(table) => WorkspaceDep {
            version: table.get("version").and_then(|v| v.as_str()).map(String::from),
            path: table.get("path").and_then(|v| v.as_str()).map(String::from),
            features: table.get("features").and_then(|v| {
                v.as_array()
                    .map(|arr| arr.iter().filter_map(|f| f.as_str().map(String::from)).collect())
            }),
            default_features: table.get("default-features").and_then(|v| v.as_bool()),
            optional: table.get("optional").and_then(|v| v.as_bool()),
            raw: value.clone(),
        },
        _ => WorkspaceDep {
            version: None,
            path: None,
            features: None,
            default_features: None,
            optional: None,
            raw: value.clone(),
        },
    }
}

/// Package dependency info including features specified locally
#[derive(Debug, Clone)]
struct PackageDepInfo {
    features: Option<Vec<String>>,
}

/// Parse a package's Cargo.toml and extract workspace dependencies with their local features
fn parse_package_deps(path: &Path) -> Result<(Option<String>, BTreeMap<String, PackageDepInfo>), String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    let cargo: CargoToml =
        toml::from_str(&content).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;

    // version can be either a string ("0.1.0") or a table ({ workspace = true })
    let version = cargo
        .package
        .and_then(|p| p.version)
        .and_then(|v| v.as_str().map(String::from));

    let mut workspace_deps = BTreeMap::new();

    // Check all dependency sections
    for deps in [cargo.dependencies, cargo.dev_dependencies, cargo.build_dependencies]
        .into_iter()
        .flatten()
    {
        for (name, value) in deps {
            if is_workspace_dep(&value) {
                let features = extract_local_features(&value);
                // Merge features if dependency appears in multiple sections
                workspace_deps
                    .entry(name)
                    .and_modify(|existing: &mut PackageDepInfo| {
                        if let Some(new_features) = &features {
                            if let Some(ref mut existing_features) = existing.features {
                                for f in new_features {
                                    if !existing_features.contains(f) {
                                        existing_features.push(f.clone());
                                    }
                                }
                            } else {
                                existing.features = Some(new_features.clone());
                            }
                        }
                    })
                    .or_insert(PackageDepInfo { features });
            }
        }
    }

    Ok((version, workspace_deps))
}

/// Extract features specified locally on a workspace dependency
fn extract_local_features(value: &toml::Value) -> Option<Vec<String>> {
    match value {
        toml::Value::Table(table) => table.get("features").and_then(|v| {
            v.as_array()
                .map(|arr| arr.iter().filter_map(|f| f.as_str().map(String::from)).collect())
        }),
        _ => None,
    }
}

fn is_workspace_dep(value: &toml::Value) -> bool {
    match value {
        toml::Value::Table(table) => table
            .get("workspace")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        _ => false,
    }
}

/// Recursively collect all workspace dependencies including transitive ones
/// Returns a map of dependency name -> PackageDepInfo with merged features
fn collect_all_deps(
    workspace_root: &Path,
    workspace_config: &WorkspaceConfig,
    initial_deps: &BTreeMap<String, PackageDepInfo>,
) -> Result<BTreeMap<String, PackageDepInfo>, String> {
    let mut all_deps = initial_deps.clone();
    let mut to_process: Vec<String> = initial_deps.keys().cloned().collect();
    let mut processed = HashSet::new();

    while let Some(dep_name) = to_process.pop() {
        if processed.contains(&dep_name) {
            continue;
        }
        processed.insert(dep_name.clone());

        // Check if this is a path dependency
        if let Some(ws_dep) = workspace_config.dependencies.get(&dep_name) {
            if let Some(rel_path) = &ws_dep.path {
                let dep_path = workspace_root.join(rel_path).join("Cargo.toml");
                if dep_path.exists() {
                    debug!("Processing transitive deps from: {}", dep_path.display());
                    let (_, transitive_deps) = parse_package_deps(&dep_path)?;
                    for (td_name, td_info) in transitive_deps {
                        if !all_deps.contains_key(&td_name) {
                            all_deps.insert(td_name.clone(), td_info);
                            to_process.push(td_name);
                        }
                    }
                }
            }
        }
    }

    Ok(all_deps)
}

// ============================================================================
// TOML Generation
// ============================================================================

/// Generate cargo-workspace-docker.toml for a package
fn generate_for_package(
    workspace_root: &Path,
    package_path: &Path,
    workspace_config: &WorkspaceConfig,
) -> Result<(), String> {
    let package_toml_path = package_path.join("Cargo.toml");
    let (package_version, direct_deps) = parse_package_deps(&package_toml_path)?;

    // Collect all deps including transitive
    let all_deps = collect_all_deps(workspace_root, workspace_config, &direct_deps)?;

    debug!("Direct deps: {:?}", direct_deps);
    debug!("All deps (including transitive): {:?}", all_deps);

    // Generate TOML content
    let content = generate_toml_content(workspace_config, &all_deps, package_version.as_deref())?;

    // Write to file
    let output_path = package_path.join("cargo-workspace-docker.toml");
    fs::write(&output_path, content)
        .map_err(|e| format!("Failed to write {}: {}", output_path.display(), e))?;

    Ok(())
}

fn generate_toml_content(
    workspace_config: &WorkspaceConfig,
    deps: &BTreeMap<String, PackageDepInfo>,
    package_version: Option<&str>,
) -> Result<String, String> {
    let mut output = String::new();

    output.push_str("# This file is generated by mpm. Do not edit manually.\n");

    // Profile section
    if let Some(profile) = &workspace_config.profile {
        output.push_str(&format_toml_section("profile", profile)?);
    }

    // Workspace section
    output.push_str("\n[workspace]\n");
    output.push_str("exclude = [\"target\"]\n");
    output.push_str("members = [\"app\"]\n");
    output.push_str("resolver = \"2\"\n");

    // Lints section (before dependencies)
    if let Some(lints) = &workspace_config.lints {
        output.push_str(&format_toml_section("workspace.lints", lints)?);
    }

    // Workspace package section (before dependencies)
    output.push_str("\n[workspace.package]\n");
    if let Some(ws_pkg) = &workspace_config.package {
        if let Some(edition) = &ws_pkg.edition {
            output.push_str(&format!("edition = \"{}\"\n", edition));
        }
    }
    // Use package version if available, otherwise use workspace default
    if let Some(version) = package_version {
        output.push_str(&format!("version = \"{}\"\n", version));
    } else if let Some(ws_pkg) = &workspace_config.package {
        if let Some(version) = &ws_pkg.version {
            output.push_str(&format!("version = \"{}\"\n", version));
        }
    }

    // Workspace dependencies last (already sorted by BTreeMap)
    for (dep_name, pkg_dep_info) in deps {
        if let Some(ws_dep) = workspace_config.dependencies.get(dep_name.as_str()) {
            output.push_str(&format_workspace_dep(dep_name, ws_dep, pkg_dep_info)?);
        }
    }

    Ok(output)
}

/// Validate that a dependency name is safe for TOML output
fn validate_dependency_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Dependency name cannot be empty".to_string());
    }
    // Cargo crate names: alphanumeric, dash, underscore (must start with letter)
    if !name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(format!(
            "Invalid dependency name '{}': contains invalid characters (only alphanumeric, dash, underscore allowed)",
            name
        ));
    }
    // Check for TOML injection attempts
    if name.contains('[') || name.contains(']') || name.contains('"') || name.contains('\n') {
        return Err(format!(
            "Invalid dependency name '{}': contains TOML metacharacters",
            name
        ));
    }
    Ok(())
}

fn format_workspace_dep(name: &str, dep: &WorkspaceDep, pkg_info: &PackageDepInfo) -> Result<String, String> {
    validate_dependency_name(name)?;
    let mut output = format!("\n[workspace.dependencies.{}]\n", name);

    // Default features - always false for Docker builds (like the old implementation)
    output.push_str("default-features = false\n");

    // Merge features from workspace definition and package-level overrides
    let mut all_features: Vec<String> = Vec::new();

    // Add workspace-level features first
    if let Some(ws_features) = &dep.features {
        for f in ws_features {
            if !all_features.contains(f) {
                all_features.push(f.clone());
            }
        }
    }

    // Add package-level features (these take precedence / get merged)
    if let Some(pkg_features) = &pkg_info.features {
        for f in pkg_features {
            if !all_features.contains(f) {
                all_features.push(f.clone());
            }
        }
    }

    // Output merged features
    if !all_features.is_empty() {
        all_features.sort(); // Deterministic output
        let features_str: Vec<String> = all_features.iter().map(|f| format!("\"{}\"", f)).collect();
        output.push_str(&format!("features = [{}]\n", features_str.join(", ")));
    }

    // Path or version
    // For Docker builds, path dependencies use the crate name as the directory
    // (e.g., "./mows-common-rust" instead of the actual relative path)
    if dep.path.is_some() {
        output.push_str(&format!("path = \"./{}\"\n", name));
    } else if let Some(version) = &dep.version {
        output.push_str(&format!("version = \"{}\"\n", version));
    }

    Ok(output)
}

fn format_toml_section(prefix: &str, value: &toml::Value) -> Result<String, String> {
    let mut output = String::new();

    match value {
        toml::Value::Table(table) => {
            for (key, val) in table {
                let section_name = format!("{}.{}", prefix, key);
                match val {
                    toml::Value::Table(inner) => {
                        output.push_str(&format!("\n[{}]\n", section_name));
                        for (k, v) in inner {
                            output.push_str(&format_value(k, v));
                        }
                    }
                    _ => {
                        output.push_str(&format!("[{}]\n", section_name));
                        output.push_str(&format_value(key, val));
                    }
                }
            }
        }
        _ => {}
    }

    Ok(output)
}

fn format_value(key: &str, value: &toml::Value) -> String {
    match value {
        toml::Value::String(s) => format!("{} = \"{}\"\n", key, s),
        toml::Value::Boolean(b) => format!("{} = {}\n", key, b),
        toml::Value::Integer(i) => format!("{} = {}\n", key, i),
        toml::Value::Float(f) => format!("{} = {}\n", key, f),
        toml::Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(|v| format_array_item(v)).collect();
            format!("{} = [{}]\n", key, items.join(", "))
        }
        _ => String::new(),
    }
}

fn format_array_item(value: &toml::Value) -> String {
    match value {
        toml::Value::String(s) => format!("\"{}\"", s),
        toml::Value::Boolean(b) => format!("{}", b),
        toml::Value::Integer(i) => format!("{}", i),
        toml::Value::Float(f) => format!("{}", f),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_workspace_dep() {
        let ws_dep = toml::toml! {
            workspace = true
            features = ["default"]
        };
        assert!(is_workspace_dep(&toml::Value::Table(ws_dep)));

        let non_ws_dep = toml::toml! {
            version = "1.0"
        };
        assert!(!is_workspace_dep(&toml::Value::Table(non_ws_dep)));

        let string_dep = toml::Value::String("1.0".to_string());
        assert!(!is_workspace_dep(&string_dep));
    }

    #[test]
    fn test_parse_workspace_dep_string() {
        let value = toml::Value::String("1.2.3".to_string());
        let dep = parse_workspace_dep(&value);
        assert_eq!(dep.version, Some("1.2.3".to_string()));
        assert!(dep.path.is_none());
    }

    #[test]
    fn test_parse_workspace_dep_table() {
        let value = toml::Value::Table(toml::toml! {
            version = "1.0.0"
            features = ["serde", "json"]
            default-features = false
        });
        let dep = parse_workspace_dep(&value);
        assert_eq!(dep.version, Some("1.0.0".to_string()));
        assert_eq!(dep.features, Some(vec!["serde".to_string(), "json".to_string()]));
        assert_eq!(dep.default_features, Some(false));
    }

    #[test]
    fn test_parse_workspace_dep_path() {
        let value = toml::Value::Table(toml::toml! {
            path = "./libs/mylib"
            default-features = false
        });
        let dep = parse_workspace_dep(&value);
        assert_eq!(dep.path, Some("./libs/mylib".to_string()));
        assert!(dep.version.is_none());
    }
}
