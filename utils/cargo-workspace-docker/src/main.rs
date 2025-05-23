use std::collections::HashMap;
use std::error::Error;
use std::fmt::format;
use std::fs;
use std::path::{Path, PathBuf};

use toml::map::Map;
use toml::Value;

extern crate toml;

const MAX_DEPTH: usize = 3;

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
    let root_deps = parse_root_dependencies(&root_dir)?;
    dbg!(&root_deps);
    for (dep_name, dep_locator) in &root_deps {
        match dep_locator {
            DepLocator::Path(path) => {}
            DepLocator::Version(version) => {}
        }
    }
    process_workspace_recursive(root_dir, 0, &root_deps, root_dir)?;

    //process_workspace_recursive(root_dir, 0, &root_deps, root_dir)?;
    Ok(())
}

#[derive(Debug)]
enum DepLocator {
    Path(PathBuf),
    Version(String),
}

fn parse_root_dependencies(root_dir: &Path) -> Result<HashMap<String, DepLocator>, Box<dyn Error>> {
    // Parse root Cargo.toml to get dependency versions.
    let root_cargo_toml = root_dir.join("Cargo.toml");
    let root_toml_str = fs::read_to_string(&root_cargo_toml)?;

    let mut deps = HashMap::new();
    let value = toml::de::from_str::<toml::Value>(&root_toml_str)?;
    if let Some(workspace) = value.get("workspace") {
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
) -> Result<(), Box<dyn Error>> {
    if depth > MAX_DEPTH {
        return Ok(());
    }

    let entries = fs::read_dir(dir)?;
    for entry in entries {
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
                )?;

                let mut deps_section = toml::value::Table::new();
                deps_section.insert("dependencies".to_string(), new_workspace_deps.into());

                let mut workspace_section = toml::value::Table::new();
                workspace_section.insert("workspace".to_string(), deps_section.into());

                // new table

                let content = format!(
                    r#"# This file is generated by cargo-workspace-docker. Do not edit manually.
[workspace]
resolver = "2"
members = ["app"]
exclude = ["target"]

{}"#,
                    toml::ser::to_string(&workspace_section)?
                );

                fs::write(path.join("cargo-workspace-docker.toml"), content)?;
            }
            process_workspace_recursive(&path, depth + 1, root_deps, root_dir)?;
        }
    }
    Ok(())
}

fn resolve_workspace_dependencies_recursive(
    path: &PathBuf,
    new_workspace_deps: &mut toml::value::Table,
    root_deps: &HashMap<String, DepLocator>,
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

            match root_deps.get(crate_name) {
                Some(DepLocator::Path(path)) => {
                    single_dep_table.insert("path".to_string(), format!("./{crate_name}").into());
                    resolve_workspace_dependencies_recursive(path, new_workspace_deps, root_deps)?;
                }
                Some(DepLocator::Version(version)) => {
                    single_dep_table.insert("version".to_string(), Value::String(version.clone()));
                }
                None => {
                    println!("Dependency {} not found in root dependencies", crate_name);
                }
            }
            new_workspace_deps.insert(crate_name.clone(), single_dep_table.clone().into());
        }
    }

    Ok(())
}
