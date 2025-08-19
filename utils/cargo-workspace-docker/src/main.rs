use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use toml::Value;

extern crate toml;

const MAX_DEPTH: usize = 5;

const EXCLUDE_DIRS: [&str; 1] = ["/mows/manager/temp/"];

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <root_directory>", args[0]);
        std::process::exit(1);
    }
    let root_dir = Path::new(&args[1]);
    process_workspace(root_dir)?;
    Ok(())
}

fn process_workspace(root_dir: &Path) -> Result<(), Box<dyn Error>> {
    let root_cargo_toml = root_dir.join("Cargo.toml");
    let root_toml_str = fs::read_to_string(&root_cargo_toml)?;

    let root_toml: toml::Value = toml::de::from_str(&root_toml_str)?;
    let root_deps = parse_root_dependencies(&root_toml, &root_dir)?;

    let mut child_crates_to_be_deduplicated = HashMap::new();

    process_workspace_recursive(
        root_dir,
        0,
        &root_deps,
        root_dir,
        &root_toml,
        &mut child_crates_to_be_deduplicated,
    )?;

    // print all child crates that have more than one distinct path
    for (crate_name, paths) in &child_crates_to_be_deduplicated {
        if paths.len() > 1 {
            let joined_paths = paths
                .iter()
                .map(|p| format!("\n - {}/Cargo.toml", p))
                .collect::<Vec<_>>()
                .join(", ");

            println!(
                "Crate '{}' is in multiple workspace child crates but not configured to be a workspace crate: {}",
                crate_name, joined_paths
            );
            println!("\n");
        }
    }

    // crates template for copying into the workspace data-encoding = { version = "2.9.0", default-features = false }
    println!("\n\n");

    for (crate_name, paths) in &child_crates_to_be_deduplicated {
        if paths.len() > 1 {
            println!(r#"{crate_name} = {{ version = "0.1.0", default-features = false }}"#);
        }
    }

    //process_workspace_recursive(root_dir, 0, &root_deps, root_dir)?;
    Ok(())
}

#[derive(Debug)]
enum DepLocator {
    Path(PathBuf),
    Version(String),
}

fn parse_root_dependencies(
    root_toml: &toml::Value,
    root_dir: &Path,
) -> Result<HashMap<String, DepLocator>, Box<dyn Error>> {
    // Parse root Cargo.toml to get dependency versions.

    let mut deps = HashMap::new();

    if let Some(workspace) = root_toml.get("workspace") {
        if let Some(dependencies) = workspace.get("dependencies") {
            if let Some(deps_table) = dependencies.as_table() {
                for (key, value) in deps_table.iter() {
                    if let Some(path) = value.get("path") {
                        if let Some(path_str) = path.as_str() {
                            let full_path = root_dir.join(path_str.replace("./", ""));

                            deps.insert(key.clone(), DepLocator::Path(full_path));
                        }
                    } else if let Some(version) = value.as_str() {
                        deps.insert(key.clone(), DepLocator::Version(version.to_string()));
                    } else if let Some(version) = value.get("version") {
                        if let Some(version_str) = version.as_str() {
                            deps.insert(key.clone(), DepLocator::Version(version_str.to_string()));
                        }
                    } else {
                        eprintln!("Unknown dependency format for key: {}", key);
                    }
                }
            }
        }
    }
    Ok(deps)
}

// recursive search for Cargo.toml files in subdirectories
fn process_workspace_recursive(
    dir: &Path,
    depth: usize,
    root_deps: &HashMap<String, DepLocator>,
    root_dir: &Path,
    root_toml: &toml::Value,
    child_crates_to_be_deduplicated: &mut HashMap<String, HashSet<String>>,
) -> Result<(), Box<dyn Error>> {
    if depth > MAX_DEPTH {
        return Ok(());
    }

    let entries = fs::read_dir(dir)?;
    println!("Processing directory: {}", dir.display());
    for entry in entries {
        if EXCLUDE_DIRS
            .iter()
            .any(|&ex| dir.to_str().unwrap_or("").contains(ex))
        {
            continue; // Skip excluded directories
        }
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            if path.join("Cargo.toml").exists()
                && (path.join("docker-compose.yml").exists()
                    || path.join("docker-compose.yaml").exists())
            {
                // Process the Cargo.toml file
                //let deps = parse_subdir_dependencies(&path)?;

                let mut new_workspace_deps = toml::value::Table::new();

                resolve_workspace_dependencies_recursive(
                    &path,
                    &mut new_workspace_deps,
                    root_deps,
                    child_crates_to_be_deduplicated,
                )?;

                let mut workspace_section = toml::value::Table::new();
                workspace_section.insert("dependencies".to_string(), new_workspace_deps.into());

                // copy the workspace section from the root Cargo.toml into the new workspace section
                if let Some(root_workspace) = root_toml.get("workspace") {
                    if let Some(root_workspace_table) = root_workspace.as_table() {
                        for (key, value) in root_workspace_table.iter() {
                            if key != "dependencies" {
                                workspace_section.insert(key.clone(), value.clone());
                            }
                        }
                    }
                }

                // override members and exclude
                workspace_section.insert(
                    "members".to_string(),
                    toml::Value::Array(vec![toml::Value::String("app".to_string())]),
                );
                workspace_section.insert(
                    "exclude".to_string(),
                    toml::Value::Array(vec![toml::Value::String("target".to_string())]),
                );

                // delete the original packages section
                workspace_section.remove("packages");

                let mut top_level_section = toml::value::Table::new();
                top_level_section.insert("workspace".to_string(), workspace_section.into());

                // copy the profiles section from the root Cargo.toml
                if let Some(profile) = root_toml.get("profile") {
                    top_level_section.insert("profile".to_string(), profile.clone());
                }

                // new table

                let content = format!(
                    r#"# This file is generated by cargo-workspace-docker. Do not edit manually.
{}"#,
                    toml::ser::to_string(&top_level_section)?
                );

                fs::write(path.join("cargo-workspace-docker.toml"), content)?;
            }
            process_workspace_recursive(
                &path,
                depth + 1,
                root_deps,
                root_dir,
                &root_toml,
                child_crates_to_be_deduplicated,
            )?;
        }
    }
    Ok(())
}

fn resolve_workspace_dependencies_recursive(
    path: &PathBuf,
    new_workspace_deps: &mut toml::value::Table,
    root_deps: &HashMap<String, DepLocator>,
    child_crates_to_be_deduplicated: &mut HashMap<String, HashSet<String>>,
) -> Result<(), Box<dyn Error>> {
    let path_dep_file_str = fs::read_to_string(path.join("Cargo.toml"))?;
    let path_dep_file = toml::de::from_str::<toml::Value>(&path_dep_file_str)?;
    let path_deps = path_dep_file.get("dependencies").unwrap();

    for (crate_name, value) in path_deps.as_table().unwrap().iter() {
        if let Some(true) = value.get("workspace").and_then(|v| v.as_bool()) {
            let mut single_dep_table = toml::value::Table::new();
            single_dep_table.extend(value.as_table().unwrap().clone());
            single_dep_table.remove("workspace");
            single_dep_table.remove("optional");
            // disable the default features
            single_dep_table.insert("default-features".to_string(), Value::Boolean(false));

            match root_deps.get(crate_name) {
                Some(DepLocator::Path(path)) => {
                    single_dep_table.insert("path".to_string(), format!("./{crate_name}").into());
                    resolve_workspace_dependencies_recursive(
                        path,
                        new_workspace_deps,
                        root_deps,
                        child_crates_to_be_deduplicated,
                    )?;
                }
                Some(DepLocator::Version(version)) => {
                    single_dep_table.insert("version".to_string(), Value::String(version.clone()));
                }
                None => {
                    println!("Dependency {} not found in root dependencies", crate_name);
                }
            }
            new_workspace_deps.insert(crate_name.clone(), single_dep_table.clone().into());
        } else {
            insert_child_crate(
                child_crates_to_be_deduplicated,
                crate_name.clone(),
                path.to_str().unwrap().to_string(),
            );
        }
    }

    Ok(())
}

pub fn insert_child_crate(
    child_crates_to_be_deduplicated: &mut HashMap<String, HashSet<String>>,
    crate_name: String,
    dep_path: String,
) {
    child_crates_to_be_deduplicated
        .entry(crate_name)
        .or_default()
        .insert(dep_path);
}
