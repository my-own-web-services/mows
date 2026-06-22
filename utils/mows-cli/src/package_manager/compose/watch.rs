use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use colored::Colorize;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use tracing::{debug, warn};

use crate::error::{MowsError, Result};
use super::docker::DockerClient;
use super::up::{find_compose_file, run_deploy_cycle, BuildPolicy};

/// Find the git repository root for a given directory.
///
/// Runs `git rev-parse --show-toplevel` with the given directory as CWD,
/// so the result is correct even when the process CWD differs (e.g. in tests).
/// Returns `None` if the directory is not inside a git repository.
fn find_git_root_from(dir: &Path) -> Option<PathBuf> {
    std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(dir)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| PathBuf::from(String::from_utf8_lossy(&o.stdout).trim()))
}

/// Extract build context directories from the rendered docker-compose file.
///
/// Parses `.results/docker-compose.yaml` (or `.yml`) and extracts
/// `services.*.build.context` values. Supports both shorthand
/// (`build: ./path`) and structured (`build: { context: ./path }`) forms.
/// Paths are resolved relative to the results directory and only returned
/// if they exist as directories.
///
/// Resolved paths are verified to remain within the project root after
/// canonicalization, preventing directory traversal via `build: ../../../../etc`.
fn extract_build_contexts(base_dir: &Path) -> Vec<PathBuf> {
    let results_dir = base_dir.join(super::RESULTS_DIR_NAME);
    let compose_path = match find_compose_file(&results_dir) {
        Some(path) => path,
        None => return Vec::new(),
    };

    let content = match std::fs::read_to_string(&compose_path) {
        Ok(c) => c,
        Err(e) => {
            debug!("Could not read compose file for build contexts: {}", e);
            return Vec::new();
        }
    };

    let doc: serde_yaml_neo::Value = match serde_yaml_neo::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            debug!("Could not parse compose file for build contexts: {}", e);
            return Vec::new();
        }
    };

    let mut contexts = Vec::new();

    let services = match doc.get("services").and_then(|s| s.as_mapping()) {
        Some(s) => s,
        None => return Vec::new(),
    };

    // Use the git repository root as the traversal boundary. Build contexts
    // commonly live outside the mows project directory (e.g. sibling source
    // dirs like ../api, ../web) but should still be within the repository.
    // If not in a git repo, skip the boundary check entirely — the compose
    // file is generated from the project's own templates, not untrusted input.
    let boundary = find_git_root_from(base_dir)
        .and_then(|p| p.canonicalize().ok());

    for (_name, service) in services {
        let context_path = match service.get("build") {
            Some(build_value) => {
                if let Some(s) = build_value.as_str() {
                    Some(s)
                } else {
                    build_value.get("context").and_then(|c| c.as_str())
                }
            }
            None => None,
        };

        if let Some(context_path) = context_path {
            let resolved = results_dir.join(context_path);
            let resolved = resolved.canonicalize().unwrap_or(resolved);

            // Verify the resolved path is within the repository root
            if let Some(ref root) = boundary {
                if !resolved.starts_with(root) {
                    debug!(
                        "Build context '{}' resolves outside repository root, skipping",
                        context_path
                    );
                    continue;
                }
            }

            if resolved.is_dir() {
                contexts.push(resolved);
            } else {
                debug!(
                    "Build context '{}' does not exist as directory, skipping",
                    context_path
                );
            }
        }
    }

    contexts
}

/// Collect all paths that should be watched for changes.
///
/// Returns a list of existing paths including:
/// - `templates/` directory
/// - `values.yaml`, `values.yml`, `values.json`
/// - `mows-manifest.yaml`, `mows-manifest.yml`
/// - `provided-secrets.env`
/// - Build context directories extracted from the rendered compose file
fn collect_watch_paths(base_dir: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    let templates = base_dir.join("templates");
    if templates.is_dir() {
        paths.push(templates);
    }

    for name in &["values.yaml", "values.yml", "values.json"] {
        let path = base_dir.join(name);
        if path.exists() {
            paths.push(path);
        }
    }

    for name in &["mows-manifest.yaml", "mows-manifest.yml"] {
        let path = base_dir.join(name);
        if path.exists() {
            paths.push(path);
        }
    }

    let secrets = base_dir.join("provided-secrets.env");
    if secrets.exists() {
        paths.push(secrets);
    }

    paths.extend(extract_build_contexts(base_dir));

    paths
}

/// Create a debouncer watching the given paths and return it with its event receiver.
fn create_watcher(
    paths: &[PathBuf],
    debounce: Duration,
) -> Result<(
    notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>,
    mpsc::Receiver<DebounceEventResult>,
)> {
    let (tx, rx) = mpsc::channel();

    let mut debouncer = new_debouncer(debounce, tx)
        .map_err(|e| MowsError::Watch(format!("Failed to create file watcher: {}", e)))?;

    for path in paths {
        let mode = if path.is_dir() {
            notify::RecursiveMode::Recursive
        } else {
            notify::RecursiveMode::NonRecursive
        };

        debouncer
            .watcher()
            .watch(path, mode)
            .map_err(|e| {
                MowsError::Watch(format!(
                    "Failed to watch '{}': {}",
                    path.display(),
                    e
                ))
            })?;

        debug!("Watching: {} ({})", path.display(), if path.is_dir() { "recursive" } else { "file" });
    }

    Ok((debouncer, rx))
}

/// Snapshot the modification times of all files under the watched paths.
///
/// For directories, this walks all files recursively. For individual files,
/// it records their mtime directly. Returns a map from canonical path to mtime.
fn snapshot_mtimes(watch_paths: &[PathBuf]) -> HashMap<PathBuf, SystemTime> {
    let mut mtimes = HashMap::new();

    for path in watch_paths {
        if path.is_dir() {
            if let Ok(entries) = walkdir(path) {
                for file in entries {
                    if let Ok(meta) = std::fs::metadata(&file) {
                        if let Ok(mtime) = meta.modified() {
                            let key = file.canonicalize().unwrap_or(file);
                            mtimes.insert(key, mtime);
                        }
                    }
                }
            }
        } else if let Ok(meta) = std::fs::metadata(path) {
            if let Ok(mtime) = meta.modified() {
                let key = path.canonicalize().unwrap_or_else(|_| path.clone());
                mtimes.insert(key, mtime);
            }
        }
    }

    mtimes
}

/// Recursively list all files in a directory.
fn walkdir(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            files.extend(walkdir(&path)?);
        } else {
            files.push(path);
        }
    }
    Ok(files)
}

/// Check whether any file modification times changed between two snapshots.
///
/// Returns true if any file was added, removed, or has a different mtime.
fn mtimes_changed(
    old: &HashMap<PathBuf, SystemTime>,
    new: &HashMap<PathBuf, SystemTime>,
) -> bool {
    if old.len() != new.len() {
        return true;
    }
    for (path, new_mtime) in new {
        match old.get(path) {
            Some(old_mtime) if old_mtime == new_mtime => {}
            _ => return true,
        }
    }
    false
}

/// Print the list of watched paths and a ready-to-watch status line.
fn print_watch_status(base_dir: &Path, watch_paths: &[PathBuf]) {
    println!(
        "\n{} Watching {} path(s) for changes:",
        "watch:".cyan().bold(),
        watch_paths.len()
    );
    for path in watch_paths {
        let display = path.strip_prefix(base_dir).unwrap_or(path).display();
        let kind = if path.is_dir() { "dir" } else { "file" };
        println!("  {} ({})", display, kind);
    }

    let now = format_local_time();
    println!(
        "{} Ready at {} — waiting for changes... (Ctrl+C to stop)",
        "watch:".cyan().bold(),
        now
    );
}

/// Format the current local time as HH:MM:SS.
///
/// Uses UTC epoch arithmetic with the libc timezone offset to avoid
/// pulling in a datetime crate for a single cosmetic display.
fn format_local_time() -> String {
    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Determine the local UTC offset using libc (safe wrapper around localtime_r).
    // SAFETY: localtime_r is reentrant and writes into our stack-allocated `tm`.
    // This is the only libc call in the module and is justified because:
    // - std::time has no local-time support
    // - adding `chrono` just for HH:MM:SS display is disproportionate
    let (hour, min, sec) = {
        let mut tm: libc::tm = unsafe { std::mem::zeroed() };
        let time = secs as libc::time_t;
        unsafe { libc::localtime_r(&time, &mut tm) };
        (tm.tm_hour, tm.tm_min, tm.tm_sec)
    };
    format!("{:02}:{:02}:{:02}", hour, min, sec)
}

/// Run the watch loop: monitor source files and re-deploy on changes.
///
/// After the initial deploy (already done by the caller), this function:
/// 1. Collects paths to watch (templates, values, manifest, build contexts)
/// 2. Sets up a debounced file watcher
/// 3. Waits for file change events
/// 4. On change: drops the watcher (to avoid self-triggered events from
///    rendering output), re-runs the deploy cycle, then re-creates the watcher
/// 5. On error during deploy: prints the error and continues watching
/// 6. On Ctrl+C: exits cleanly
pub(super) fn run_watch_loop(
    base_dir: &Path,
    client: &dyn DockerClient,
    debounce_ms: u64,
    policy: BuildPolicy,
) -> Result<()> {
    let debounce = Duration::from_millis(debounce_ms);

    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_handler = Arc::clone(&shutdown);
    if let Err(e) = ctrlc::set_handler(move || {
        shutdown_handler.store(true, Ordering::SeqCst);
    }) {
        debug!("Could not set Ctrl+C handler (likely already set): {}", e);
    }

    let mut watch_paths = collect_watch_paths(base_dir);
    let mut last_mtimes = snapshot_mtimes(&watch_paths);
    let (mut debouncer, mut rx) = create_watcher(&watch_paths, debounce)?;

    print_watch_status(base_dir, &watch_paths);

    loop {
        if shutdown.load(Ordering::SeqCst) {
            println!("\n{} Shutting down.", "watch:".cyan().bold());
            break;
        }

        match rx.recv_timeout(Duration::from_millis(250)) {
            Ok(Ok(events)) => {
                // Deduplicate and filter to actual file changes — directory-level
                // events (e.g. from read_dir during rendering) cause spurious re-deploys.
                let changed: HashSet<PathBuf> = events
                    .iter()
                    .map(|e| e.path.clone())
                    .filter(|path| !path.is_dir())
                    .collect();

                if changed.is_empty() {
                    debug!("Ignoring directory-only events");
                    continue;
                }

                // Compare file modification times to filter out read-only access
                // events and other non-modifying filesystem activity.
                let current_mtimes = snapshot_mtimes(&watch_paths);
                if !mtimes_changed(&last_mtimes, &current_mtimes) {
                    debug!(
                        "Ignoring {} event(s) — no modification times changed",
                        changed.len()
                    );
                    continue;
                }
                // Note: the authoritative baseline is re-snapshotted after the
                // deploy below (the deploy itself writes into .results/), so we
                // intentionally do not update `last_mtimes` from the pre-deploy
                // snapshot here.

                println!(
                    "\n{} Changes detected in {} file(s):",
                    "watch:".cyan().bold(),
                    changed.len()
                );
                for path in &changed {
                    let display = path.strip_prefix(base_dir).unwrap_or(path).display();
                    println!("  {}", display);
                }

                // Drop watcher during deploy to avoid self-triggered events
                drop(debouncer);

                // Re-deploy with the same build policy as the initial deploy.
                // The cache is kept by default; whether a container is recreated
                // is decided downstream by the image-ID comparison (so a change
                // inside a build context rebuilds and recreates without
                // discarding the layer cache).
                println!("{} Re-deploying...", "watch:".cyan().bold());
                match run_deploy_cycle(base_dir, client, &policy) {
                    Ok(()) => {
                        debug!("Watch: re-deploy completed successfully");
                    }
                    Err(e) => {
                        eprintln!(
                            "\n{} Deploy failed: {}\n       Fix the issue and save to retry.",
                            "watch:".red().bold(),
                            e
                        );
                    }
                }

                // Re-collect paths (build contexts may have changed) and re-create watcher
                watch_paths = collect_watch_paths(base_dir);
                last_mtimes = snapshot_mtimes(&watch_paths);
                let (new_debouncer, new_rx) = create_watcher(&watch_paths, debounce)?;
                debouncer = new_debouncer;
                rx = new_rx;

                print_watch_status(base_dir, &watch_paths);
            }
            Ok(Err(e)) => {
                warn!("File watcher error: {:?}", e);
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Normal timeout, loop and check shutdown flag
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                return Err(MowsError::Watch(
                    "File watcher channel disconnected unexpectedly".to_string(),
                ));
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    /// Create a minimal mows project structure for testing.
    fn create_test_project(dir: &Path) {
        fs::write(
            dir.join("mows-manifest.yaml"),
            r#"manifestVersion: "0.1"
metadata:
  name: test-project
spec:
  compose: {}
"#,
        )
        .unwrap();

        fs::create_dir_all(dir.join("templates")).unwrap();
        fs::write(
            dir.join("templates/docker-compose.yaml"),
            r#"services:
  web:
    image: nginx:latest
"#,
        )
        .unwrap();

        fs::write(dir.join("values.yaml"), "key: value\n").unwrap();
    }

    // =========================================================================
    // collect_watch_paths tests
    // =========================================================================

    #[test]
    fn test_collect_watch_paths_includes_templates() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());

        let paths = collect_watch_paths(dir.path());
        assert!(
            paths.iter().any(|p| p.ends_with("templates")),
            "Should include templates dir, got: {:?}",
            paths
        );
    }

    #[test]
    fn test_collect_watch_paths_includes_values_yaml() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());

        let paths = collect_watch_paths(dir.path());
        assert!(
            paths.iter().any(|p| p.ends_with("values.yaml")),
            "Should include values.yaml, got: {:?}",
            paths
        );
    }

    #[test]
    fn test_collect_watch_paths_includes_manifest() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());

        let paths = collect_watch_paths(dir.path());
        assert!(
            paths.iter().any(|p| p.ends_with("mows-manifest.yaml")),
            "Should include mows-manifest.yaml, got: {:?}",
            paths
        );
    }

    #[test]
    fn test_collect_watch_paths_includes_provided_secrets() {
        let dir = tempdir().unwrap();
        create_test_project(dir.path());
        fs::write(dir.path().join("provided-secrets.env"), "SECRET=val").unwrap();

        let paths = collect_watch_paths(dir.path());
        assert!(
            paths.iter().any(|p| p.ends_with("provided-secrets.env")),
            "Should include provided-secrets.env, got: {:?}",
            paths
        );
    }

    #[test]
    fn test_collect_watch_paths_skips_nonexistent() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("mows-manifest.yaml"),
            "manifestVersion: '0.1'\nmetadata:\n  name: test\nspec:\n  compose: {}\n",
        )
        .unwrap();

        let paths = collect_watch_paths(dir.path());
        assert_eq!(paths.len(), 1);
        assert!(paths[0].ends_with("mows-manifest.yaml"));
    }

    #[test]
    fn test_collect_watch_paths_values_yml() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("mows-manifest.yaml"),
            "manifestVersion: '0.1'\nmetadata:\n  name: test\nspec:\n  compose: {}\n",
        )
        .unwrap();
        fs::write(dir.path().join("values.yml"), "key: val").unwrap();

        let paths = collect_watch_paths(dir.path());
        assert!(
            paths.iter().any(|p| p.ends_with("values.yml")),
            "Should include values.yml, got: {:?}",
            paths
        );
    }

    #[test]
    fn test_collect_watch_paths_values_json() {
        let dir = tempdir().unwrap();
        fs::write(
            dir.path().join("mows-manifest.yaml"),
            "manifestVersion: '0.1'\nmetadata:\n  name: test\nspec:\n  compose: {}\n",
        )
        .unwrap();
        fs::write(dir.path().join("values.json"), r#"{"key": "val"}"#).unwrap();

        let paths = collect_watch_paths(dir.path());
        assert!(
            paths.iter().any(|p| p.ends_with("values.json")),
            "Should include values.json, got: {:?}",
            paths
        );
    }

    // =========================================================================
    // extract_build_contexts tests
    // =========================================================================

    #[test]
    fn test_extract_build_contexts_shorthand() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        let context_dir = dir.path().join("app");
        fs::create_dir_all(&context_dir).unwrap();

        fs::write(
            results_dir.join("docker-compose.yaml"),
            format!(
                "services:\n  web:\n    build: {}\n",
                context_dir.display()
            ),
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert_eq!(contexts.len(), 1);
        assert_eq!(
            contexts[0].canonicalize().unwrap(),
            context_dir.canonicalize().unwrap()
        );
    }

    #[test]
    fn test_extract_build_contexts_structured() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        let context_dir = dir.path().join("backend");
        fs::create_dir_all(&context_dir).unwrap();

        fs::write(
            results_dir.join("docker-compose.yaml"),
            format!(
                "services:\n  api:\n    build:\n      context: {}\n      dockerfile: Dockerfile\n",
                context_dir.display()
            ),
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert_eq!(contexts.len(), 1);
        assert_eq!(
            contexts[0].canonicalize().unwrap(),
            context_dir.canonicalize().unwrap()
        );
    }

    #[test]
    fn test_extract_build_contexts_no_build_section() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        fs::write(
            results_dir.join("docker-compose.yaml"),
            "services:\n  web:\n    image: nginx:latest\n",
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert!(contexts.is_empty());
    }

    #[test]
    fn test_extract_build_contexts_no_compose_file() {
        let dir = tempdir().unwrap();
        let contexts = extract_build_contexts(dir.path());
        assert!(contexts.is_empty());
    }

    #[test]
    fn test_extract_build_contexts_nonexistent_dir() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        fs::write(
            results_dir.join("docker-compose.yaml"),
            "services:\n  web:\n    build: ./nonexistent-dir\n",
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert!(
            contexts.is_empty(),
            "Should skip nonexistent build context directories"
        );
    }

    #[test]
    fn test_extract_build_contexts_multiple_services() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        let frontend = dir.path().join("frontend");
        let backend = dir.path().join("backend");
        fs::create_dir_all(&frontend).unwrap();
        fs::create_dir_all(&backend).unwrap();

        fs::write(
            results_dir.join("docker-compose.yaml"),
            format!(
                "services:\n  frontend:\n    build: {}\n  backend:\n    build:\n      context: {}\n  redis:\n    image: redis:latest\n",
                frontend.display(),
                backend.display()
            ),
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert_eq!(contexts.len(), 2);
    }

    #[test]
    fn test_extract_build_contexts_relative_path() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        // Create a build context as a sibling of results/
        let context_dir = dir.path().join("app");
        fs::create_dir_all(&context_dir).unwrap();

        // Use a relative path from the results directory
        fs::write(
            results_dir.join("docker-compose.yaml"),
            "services:\n  web:\n    build: ../app\n",
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert_eq!(contexts.len(), 1, "Should resolve relative path from results dir");
        assert_eq!(
            contexts[0].canonicalize().unwrap(),
            context_dir.canonicalize().unwrap()
        );
    }

    #[test]
    fn test_extract_build_contexts_dockerfile_only_no_context() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join(super::super::RESULTS_DIR_NAME);
        fs::create_dir_all(&results_dir).unwrap();

        // build: block with only dockerfile, no context key
        fs::write(
            results_dir.join("docker-compose.yaml"),
            "services:\n  web:\n    build:\n      dockerfile: Dockerfile.custom\n",
        )
        .unwrap();

        let contexts = extract_build_contexts(dir.path());
        assert!(
            contexts.is_empty(),
            "Should return empty when build block has no context key"
        );
    }

    // =========================================================================
    // create_watcher tests
    // =========================================================================

    #[test]
    fn test_create_watcher_with_valid_paths() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "content").unwrap();

        let paths = vec![dir.path().to_path_buf(), file];
        let result = create_watcher(&paths, Duration::from_millis(100));
        assert!(result.is_ok(), "Should create watcher for valid paths");
    }

    #[test]
    fn test_create_watcher_empty_paths() {
        let paths: Vec<PathBuf> = vec![];
        let result = create_watcher(&paths, Duration::from_millis(100));
        assert!(result.is_ok(), "Should succeed with no paths");
    }

    // =========================================================================
    // snapshot_mtimes / mtimes_changed tests
    // =========================================================================

    #[test]
    fn test_snapshot_mtimes_captures_files() {
        let dir = tempdir().unwrap();
        let file_a = dir.path().join("a.txt");
        let file_b = dir.path().join("b.txt");
        fs::write(&file_a, "aaa").unwrap();
        fs::write(&file_b, "bbb").unwrap();

        let paths = vec![file_a.clone(), file_b.clone()];
        let snap = snapshot_mtimes(&paths);
        assert_eq!(snap.len(), 2);
        assert!(snap.contains_key(&file_a.canonicalize().unwrap()));
        assert!(snap.contains_key(&file_b.canonicalize().unwrap()));
    }

    #[test]
    fn test_snapshot_mtimes_captures_directory_contents() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("x.txt"), "x").unwrap();
        fs::write(sub.join("y.txt"), "y").unwrap();

        let paths = vec![sub.clone()];
        let snap = snapshot_mtimes(&paths);
        assert_eq!(snap.len(), 2);
    }

    #[test]
    fn test_mtimes_changed_no_change() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "content").unwrap();

        let paths = vec![file.clone()];
        let snap1 = snapshot_mtimes(&paths);
        let snap2 = snapshot_mtimes(&paths);
        assert!(!mtimes_changed(&snap1, &snap2));
    }

    #[test]
    fn test_mtimes_changed_after_write() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("test.txt");
        fs::write(&file, "original").unwrap();

        let paths = vec![file.clone()];
        let snap1 = snapshot_mtimes(&paths);

        // Sleep briefly to ensure mtime advances
        std::thread::sleep(Duration::from_millis(50));
        fs::write(&file, "modified").unwrap();

        let snap2 = snapshot_mtimes(&paths);
        assert!(mtimes_changed(&snap1, &snap2));
    }

    #[test]
    fn test_mtimes_changed_file_added() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("a.txt"), "a").unwrap();

        let paths = vec![sub.clone()];
        let snap1 = snapshot_mtimes(&paths);

        fs::write(sub.join("b.txt"), "b").unwrap();
        let snap2 = snapshot_mtimes(&paths);
        assert!(mtimes_changed(&snap1, &snap2));
    }

    #[test]
    fn test_mtimes_changed_file_removed() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("a.txt"), "a").unwrap();
        fs::write(sub.join("b.txt"), "b").unwrap();

        let paths = vec![sub.clone()];
        let snap1 = snapshot_mtimes(&paths);

        fs::remove_file(sub.join("b.txt")).unwrap();
        let snap2 = snapshot_mtimes(&paths);
        assert!(mtimes_changed(&snap1, &snap2));
    }
}
