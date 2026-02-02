use crate::error::{MowsError, Result};
use super::config::MowsConfig;

/// Navigate to a project directory (prints the path for shell integration)
pub fn compose_cd(project: &str, instance: Option<&str>) -> Result<()> {
    let config = MowsConfig::load()?;

    // Find matching projects
    let projects = config.find_projects(project);

    if projects.is_empty() {
        return Err(MowsError::Config(format!(
            r#"No project found with name '{}'
Use 'mows package-manager compose install' (or 'mpm compose install') to add a project."#,
            project
        )));
    }

    // If instance is specified, find exact match
    if let Some(instance_name) = instance {
        let project_entry = config.find_project(project, Some(instance_name)).ok_or_else(|| {
            MowsError::Config(format!(
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
            return Err(MowsError::path(&manifest_dir, format!(
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
            return Err(MowsError::path(&manifest_dir, format!(
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

    Err(MowsError::Config(format!(
        r#"Multiple instances of '{}' found. Please specify an instance with --instance:

{}

Example: mows package-manager compose cd {} --instance <name>"#,
        project,
        options.join("\n"),
        project
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::config::{test_utils::TestConfigGuard, ComposeConfig, ProjectEntry};
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn create_test_config() -> MowsConfig {
        MowsConfig {
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

    #[test]
    fn test_compose_cd_project_not_found() {
        let _guard = TestConfigGuard::new();

        // Empty config - no projects
        let config = MowsConfig::default();
        config.save().unwrap();

        let result = compose_cd("nonexistent", None);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No project found"));
        assert!(err.contains("nonexistent"));
    }

    #[test]
    fn test_compose_cd_single_project_exists() {
        let _guard = TestConfigGuard::new();

        // Create a temp directory that exists
        let dir = tempdir().unwrap();
        let project_dir = dir.path().to_path_buf();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "my-project".to_string(),
            instance_name: None,
            repo_path: project_dir.clone(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("my-project", None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_project_directory_missing() {
        let _guard = TestConfigGuard::new();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "deleted-project".to_string(),
            instance_name: None,
            repo_path: PathBuf::from("/nonexistent/path/that/does/not/exist"),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("deleted-project", None);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("no longer exists"));
    }

    #[test]
    fn test_compose_cd_multiple_instances_without_specifying() {
        let _guard = TestConfigGuard::new();

        let dir1 = tempdir().unwrap();
        let dir2 = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "multi".to_string(),
            instance_name: None,
            repo_path: dir1.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.upsert_project(ProjectEntry {
            project_name: "multi".to_string(),
            instance_name: Some("staging".to_string()),
            repo_path: dir2.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("multi", None);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Multiple instances"));
        assert!(err.contains("--instance"));
    }

    #[test]
    fn test_compose_cd_with_instance_specified() {
        let _guard = TestConfigGuard::new();

        let dir1 = tempdir().unwrap();
        let dir2 = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "multi".to_string(),
            instance_name: None,
            repo_path: dir1.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.upsert_project(ProjectEntry {
            project_name: "multi".to_string(),
            instance_name: Some("staging".to_string()),
            repo_path: dir2.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("multi", Some("staging"));
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_instance_not_found() {
        let _guard = TestConfigGuard::new();

        let dir = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "my-project".to_string(),
            instance_name: Some("prod".to_string()),
            repo_path: dir.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("my-project", Some("nonexistent"));
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No instance 'nonexistent' found"));
    }

    #[test]
    fn test_compose_cd_with_manifest_subdir() {
        let _guard = TestConfigGuard::new();

        // Create temp directory with manifest subdirectory
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("deployment")).unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "subdir-project".to_string(),
            instance_name: None,
            repo_path: dir.path().to_path_buf(),
            manifest_path: PathBuf::from("deployment"),
        });
        config.save().unwrap();

        let result = compose_cd("subdir-project", None);
        assert!(result.is_ok());
    }

    // =========================================================================
    // Unicode and Special Character Tests (#38)
    // =========================================================================

    #[test]
    fn test_compose_cd_project_name_with_unicode() {
        let _guard = TestConfigGuard::new();

        let dir = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "项目-αβγ-日本語".to_string(),
            instance_name: None,
            repo_path: dir.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        // Should find the project with unicode name
        let result = compose_cd("项目-αβγ-日本語", None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_instance_name_with_unicode() {
        let _guard = TestConfigGuard::new();

        let dir = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "my-project".to_string(),
            instance_name: Some("ステージング".to_string()),
            repo_path: dir.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("my-project", Some("ステージング"));
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_project_name_with_spaces() {
        let _guard = TestConfigGuard::new();

        let dir = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "my project with spaces".to_string(),
            instance_name: None,
            repo_path: dir.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("my project with spaces", None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_project_name_with_special_chars() {
        let _guard = TestConfigGuard::new();

        let dir = tempdir().unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "project_with-special.chars@123".to_string(),
            instance_name: None,
            repo_path: dir.path().to_path_buf(),
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("project_with-special.chars@123", None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_path_with_spaces() {
        let _guard = TestConfigGuard::new();

        // Create directory with spaces in the name
        let base_dir = tempdir().unwrap();
        let space_dir = base_dir.path().join("path with spaces");
        std::fs::create_dir_all(&space_dir).unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "space-path-project".to_string(),
            instance_name: None,
            repo_path: space_dir,
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("space-path-project", None);
        assert!(result.is_ok());
    }

    #[test]
    fn test_compose_cd_path_with_unicode() {
        let _guard = TestConfigGuard::new();

        // Create directory with unicode in the name
        let base_dir = tempdir().unwrap();
        let unicode_dir = base_dir.path().join("日本語フォルダ");
        std::fs::create_dir_all(&unicode_dir).unwrap();

        let mut config = MowsConfig::default();
        config.upsert_project(ProjectEntry {
            project_name: "unicode-path-project".to_string(),
            instance_name: None,
            repo_path: unicode_dir,
            manifest_path: PathBuf::from("."),
        });
        config.save().unwrap();

        let result = compose_cd("unicode-path-project", None);
        assert!(result.is_ok());
    }
}
