use crate::error::{MpmError, Result};
use super::config::MpmConfig;

/// Navigate to a project directory (prints the path for shell integration)
pub fn compose_cd(project: &str, instance: Option<&str>) -> Result<()> {
    let config = MpmConfig::load()?;

    // Find matching projects
    let projects = config.find_projects(project);

    if projects.is_empty() {
        return Err(MpmError::Config(format!(
            r#"No project found with name '{}'
Use 'mpm compose install' to add a project."#,
            project
        )));
    }

    // If instance is specified, find exact match
    if let Some(instance_name) = instance {
        let project_entry = config.find_project(project, Some(instance_name)).ok_or_else(|| {
            MpmError::Config(format!(
                r#"No instance '{}' found for project '{}'
Available instances: {}"#,
                instance_name,
                project,
                projects
                    .iter()
                    .filter_map(|p| p.instance_name.as_ref())
                    .map(|s| s.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ))
        })?;

        let manifest_dir = project_entry.manifest_dir();
        if !manifest_dir.exists() {
            return Err(MpmError::path(&manifest_dir, format!(
                r#"Project directory no longer exists
The project may have been moved or deleted."#,
            )));
        }

        println!("{}", manifest_dir.display());
        return Ok(());
    }

    // If only one project (no instances), use it
    if projects.len() == 1 {
        let project_entry = projects[0];
        let manifest_dir = project_entry.manifest_dir();

        if !manifest_dir.exists() {
            return Err(MpmError::path(&manifest_dir, format!(
                r#"Project directory no longer exists
The project may have been moved or deleted."#,
            )));
        }

        println!("{}", manifest_dir.display());
        return Ok(());
    }

    // Multiple instances - ask user to specify
    let mut options = Vec::new();
    for p in &projects {
        let instance_str = p
            .instance_name
            .as_ref()
            .map(|s| format!(" (instance: {})", s))
            .unwrap_or_default();
        options.push(format!(
            "  {}{}: {}",
            p.project_name,
            instance_str,
            p.manifest_dir().display()
        ));
    }

    Err(MpmError::Config(format!(
        r#"Multiple instances of '{}' found. Please specify an instance with --instance:

{}

Example: mpm compose cd {} --instance <name>"#,
        project,
        options.join("\n"),
        project
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::config::{ComposeConfig, ProjectEntry};
    use std::path::PathBuf;

    fn create_test_config() -> MpmConfig {
        MpmConfig {
            compose: ComposeConfig {
                projects: vec![
                    ProjectEntry {
                        project_name: "test-project".to_string(),
                        instance_name: None,
                        repo_path: PathBuf::from("/tmp/test"),
                        manifest_path: PathBuf::from("."),
                    },
                    ProjectEntry {
                        project_name: "multi-instance".to_string(),
                        instance_name: None,
                        repo_path: PathBuf::from("/tmp/multi"),
                        manifest_path: PathBuf::from("."),
                    },
                    ProjectEntry {
                        project_name: "multi-instance".to_string(),
                        instance_name: Some("staging".to_string()),
                        repo_path: PathBuf::from("/tmp/multi-staging"),
                        manifest_path: PathBuf::from("."),
                    },
                ],
            },
            update: None,
        }
    }

    #[test]
    fn test_find_single_project() {
        let config = create_test_config();
        let projects = config.find_projects("test-project");
        assert_eq!(projects.len(), 1);
    }

    #[test]
    fn test_find_multiple_instances() {
        let config = create_test_config();
        let projects = config.find_projects("multi-instance");
        assert_eq!(projects.len(), 2);
    }

    #[test]
    fn test_find_specific_instance() {
        let config = create_test_config();
        let project = config.find_project("multi-instance", Some("staging"));
        assert!(project.is_some());
        assert_eq!(
            project.unwrap().repo_path,
            PathBuf::from("/tmp/multi-staging")
        );
    }
}
