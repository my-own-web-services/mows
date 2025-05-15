use mows_common_rust::utils::generate_id;
use std::path::{Path, PathBuf};

const MANIFEST_FILE_NAME: &str = "mows-manifest.yaml";

pub struct RepositoryPaths {
    /// The parent working directory
    /// /tmp/mows-package-manager/
    pub package_manager_working_path: PathBuf,
    /// The working directory for the repository
    /// /tmp/mows-package-manager/zitadel-random
    pub repository_working_path: PathBuf,
    /// The path were the mows repository will be fetched to
    /// /tmp/mows-package-manager/zitadel-random/source
    pub mows_repo_source_path: PathBuf,
    /// The path to the mows manifest file
    /// /tmp/mows-package-manager/zitadel-random/source/manifest.mows.yaml
    pub manifest_path: PathBuf,
    /// a path to a temporary directory to work in
    /// /tmp/mows-package-manager/zitadel-random/temp
    pub temp_path: PathBuf,
    /// Path to store files in by hash
    pub artifact_path: PathBuf,
}

impl RepositoryPaths {
    pub async fn new(root_working_directory: &str) -> Self {
        let working_path = Path::new(&root_working_directory).join(generate_id(20));
        let source_path = working_path.join("source");
        let manifest_path = source_path.join(MANIFEST_FILE_NAME);
        let temp_path = working_path.join("temp");
        let artifact_path = Path::new(&root_working_directory).join("store");

        let _ = tokio::fs::create_dir_all(&source_path).await;
        let _ = tokio::fs::create_dir_all(&temp_path).await;
        let _ = tokio::fs::create_dir_all(&artifact_path).await;

        Self {
            package_manager_working_path: PathBuf::from(root_working_directory),
            repository_working_path: working_path.clone(),
            manifest_path,
            mows_repo_source_path: source_path,
            temp_path,
            artifact_path,
        }
    }
}
