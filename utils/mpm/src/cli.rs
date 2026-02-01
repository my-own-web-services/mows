use clap::{Command, CommandFactory, Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "mows")]
#[command(about = "mows - MOWS CLI toolkit", long_about = None)]
#[command(disable_version_flag = true)]
pub struct Cli {
    /// Enable verbose output (debug logging)
    #[arg(short = 'v', long, global = true)]
    pub verbose: bool,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Package manager for Docker Compose deployments
    ///
    /// Commands for managing mows-style Docker Compose deployments with
    /// templated configuration, automatic secrets generation, and
    /// health monitoring.
    #[command(name = "package-manager")]
    PackageManager {
        #[command(subcommand)]
        command: PackageManagerCommands,
    },
    /// Data transformation utilities
    ///
    /// Small utilities for working with JSON, YAML, and other data formats.
    /// All tools read from stdin and write to stdout by default, or use
    /// -i/--input and -o/--output for file operations.
    Tools {
        #[command(subcommand)]
        tool: ToolCommands,
    },
    /// Render templates
    ///
    /// Automatically loads values.yml, values.yaml, or values.json from the input directory.
    /// Values are available at root level (e.g., .myValue).
    Template {
        /// Template file or directory to render
        #[arg(short, long)]
        input: PathBuf,
        /// Variable file in format name:path (e.g., --variable=config:./config.yml)
        /// Supports JSON, YAML, and .env files. Available in templates as $name
        #[arg(long = "variable", value_name = "NAME:PATH")]
        variables: Vec<String>,
        /// Output file or directory
        #[arg(short, long)]
        output: PathBuf,
    },
    /// Install shell completions
    ///
    /// Outputs shell completion script to stdout, or installs to
    /// the standard completion directory with --install.
    ///
    /// Standard locations:
    ///   Bash: ~/.local/share/bash-completion/completions/mows
    ///   Zsh:  ~/.zsh/completions/_mows (or ~/.oh-my-zsh/completions/_mows)
    ///   Fish: ~/.config/fish/completions/mows.fish
    #[command(name = "shell-init")]
    ShellInit {
        /// Install completions to standard directory
        #[arg(long)]
        install: bool,
    },
    /// Show version information
    ///
    /// Displays the current mows version and checks for available updates.
    Version,
    /// Generate man pages
    ///
    /// Outputs the man page to stdout, or installs all man pages
    /// to ~/.local/share/man/man1/ with --install.
    Manpage {
        /// Install man pages to ~/.local/share/man/man1/
        #[arg(long)]
        install: bool,
    },
    /// Update mows to the latest version
    ///
    /// By default, downloads the latest pre-built binary from GitHub releases
    /// and verifies its SHA256 checksum before installation.
    ///
    /// Use --build to clone the repository, verify its SSH signature, and
    /// build from source using Docker (requires git and docker).
    #[command(name = "self-update")]
    SelfUpdate {
        /// Build from source instead of downloading binary
        ///
        /// Clones the repository, verifies the SSH signature on the release tag
        /// against the hardcoded trusted key, and builds the binary using Docker.
        /// Requires git and docker.
        #[arg(long)]
        build: bool,

        /// Specific version to install (e.g., "0.2.0")
        ///
        /// By default, installs the latest version. Works with both binary
        /// download and --build modes.
        #[arg(long)]
        version: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum PackageManagerCommands {
    /// Docker Compose deployment management
    ///
    /// Commands for managing mows-style Docker Compose deployments with
    /// templated configuration, automatic secrets generation, and
    /// health monitoring.
    Compose {
        #[command(subcommand)]
        command: ComposeCommands,
    },
}

#[derive(Subcommand)]
pub enum ComposeCommands {
    /// Render templates and start the deployment
    ///
    /// Executes the full deployment pipeline:
    /// 1. Renders Go templates in the templates/ directory using values.yaml
    /// 2. Generates any missing secrets defined in mows-manifest.yaml
    /// 3. Flattens nested Traefik labels to dot-notation format
    /// 4. Runs docker compose up -d
    /// 5. Monitors container health and displays status
    ///
    /// Templates use Go template syntax with Helm-compatible functions.
    /// Secrets are auto-generated based on patterns in mows-manifest.yaml.
    Up,
    /// Initialize a new mows compose project
    ///
    /// Creates the standard mows project structure:
    /// - mows-manifest.yaml: Project configuration and secrets definitions
    /// - values.yaml: Template variables (gitignored)
    /// - templates/: Directory for Go templates
    /// - templates/docker-compose.yaml.gotmpl: Main compose template
    /// - .gitignore: Excludes values.yaml, results/, secrets/
    ///
    /// If run in a git repository, auto-detects the project name from
    /// the remote URL.
    Init {
        /// Project name (defaults to git repository name)
        name: Option<String>,
    },
    /// Clone and install a mows project from a git URL
    ///
    /// Clones the repository and registers it with mows for easy navigation.
    /// Only HTTPS and SSH URLs are allowed for security.
    ///
    /// After installation, use 'mows package-manager compose cd <project>' to navigate to it,
    /// then 'mows package-manager compose up' to deploy.
    Install {
        /// Git repository URL (https:// or git@)
        url: String,
        /// Target directory (defaults to current directory)
        #[arg(short, long)]
        target: Option<std::path::PathBuf>,
    },
    /// Pull latest changes and merge values
    ///
    /// Updates the project by:
    /// 1. Running git pull to fetch upstream changes
    /// 2. Merging new keys from default-values.yaml into values.yaml
    /// 3. Preserving existing values (your customizations are kept)
    /// 4. Commenting out keys that were removed upstream
    ///
    /// Safe to run repeatedly - your values.yaml modifications are preserved.
    Update,
    /// Print the path to a registered project
    ///
    /// Prints the absolute path to a project's directory, useful for
    /// shell navigation. Projects are registered when installed or
    /// when 'mows package-manager compose up' is run.
    ///
    /// Usage with cd: cd $(mows package-manager compose cd myproject)
    ///
    /// If multiple instances of a project exist (same project installed
    /// in different locations), use --instance to specify which one.
    Cd {
        /// Project name to navigate to
        project: String,
        /// Instance name (if multiple instances exist)
        #[arg(short, long)]
        instance: Option<String>,
    },
    /// Manage deployment secrets
    ///
    /// Secrets are defined in mows-manifest.yaml and stored in secrets/.env.
    /// They are auto-generated on first 'mows package-manager compose up' and can be
    /// regenerated with this command.
    Secrets {
        #[command(subcommand)]
        command: SecretsCommands,
    },
    /// Pass through to docker compose with project context
    ///
    /// Any unrecognized subcommand is passed directly to docker compose
    /// with the project's compose file. Useful for commands like:
    ///   mows package-manager compose logs -f
    ///   mows package-manager compose ps
    ///   mows package-manager compose down
    ///   mows package-manager compose exec service_name bash
    #[command(external_subcommand)]
    Passthrough(Vec<String>),
}

#[derive(Subcommand)]
pub enum SecretsCommands {
    /// Regenerate secrets (all or specific key)
    ///
    /// Regenerates secrets defined in mows-manifest.yaml. By default,
    /// only generates missing secrets; existing values are preserved.
    ///
    /// Use with a specific key name to force regeneration of that secret.
    /// The secret patterns (length, character set) are defined in the
    /// mows-manifest.yaml file.
    Regenerate {
        /// Specific key to regenerate (regenerates all missing if not specified)
        key: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum ToolCommands {
    /// Convert JSON to YAML
    ///
    /// Reads JSON input and outputs equivalent YAML with 4-space indentation.
    ///
    /// Example: mows tools json-to-yaml -i config.json -o config.yaml
    /// Example: cat data.json | mows tools json-to-yaml > data.yaml
    #[command(name = "json-to-yaml")]
    JsonToYaml {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Convert YAML to JSON
    ///
    /// Reads YAML input and outputs pretty-printed JSON.
    ///
    /// Example: mows tools yaml-to-json -i config.yaml -o config.json
    /// Example: cat data.yaml | mows tools yaml-to-json > data.json
    #[command(name = "yaml-to-json")]
    YamlToJson {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Prettify JSON with consistent formatting
    ///
    /// Reads JSON and outputs with consistent indentation and formatting.
    /// Useful for normalizing JSON files or making them human-readable.
    ///
    /// Example: mows tools prettify-json -i messy.json -o clean.json
    #[command(name = "prettify-json")]
    PrettifyJson {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Expand flat dot-notation keys to nested structure
    ///
    /// Transforms flat keys like "traefik.http.routers.app.rule" into
    /// nested YAML/JSON objects. Useful for editing Traefik labels.
    ///
    /// For Docker Compose files, automatically targets services.*.labels.
    /// Use --selector to specify a different path or apply to entire document.
    ///
    /// Example: mows tools expand-object -i compose.yaml -o expanded.yaml
    #[command(name = "expand-object")]
    ExpandObject {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Path selector with glob support (e.g., "services.*.labels")
        #[arg(short, long)]
        selector: Option<String>,
    },
    /// Flatten nested structure to dot-notation keys
    ///
    /// Transforms nested YAML/JSON objects into flat dot-notation keys.
    /// The inverse of expand-object. Useful for converting human-readable
    /// Traefik configuration back to label format.
    ///
    /// For Docker Compose files, automatically targets services.*.labels.
    ///
    /// Example: mows tools flatten-object -i expanded.yaml -o compose.yaml
    #[command(name = "flatten-object")]
    FlattenObject {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Path selector with glob support (e.g., "services.*.labels")
        #[arg(short, long)]
        selector: Option<String>,
    },
    /// Query JSON/YAML with jq syntax
    ///
    /// Run jq-style queries on JSON or YAML input. Supports most jq
    /// core filters. Input can be JSON or YAML; output defaults to JSON
    /// but can be YAML with --yaml.
    ///
    /// Example: mows tools jq '.services | keys' -i compose.yaml
    /// Example: cat data.json | mows tools jq '.items[] | .name'
    Jq {
        /// jq query/filter to apply (e.g., '.foo.bar', '.[] | select(.x > 1)')
        query: String,
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Output as YAML instead of JSON
        #[arg(long)]
        yaml: bool,
    },
    /// List drives with health and capacity info
    ///
    /// Lists all block devices with size, model, and SMART health status.
    /// SMART data requires smartctl to be installed and may need sudo
    /// for some drives.
    ///
    /// Example: mows tools drives
    /// Example: sudo mows tools drives  # for full SMART access
    Drives,
    /// Generate cargo-workspace-docker.toml for Docker builds
    ///
    /// Creates minimal Cargo workspace configuration for Dockerized builds.
    /// Resolves all dependencies (including transitive) needed to build
    /// the package, enabling efficient Docker layer caching with cargo-chef.
    ///
    /// Run from a package directory or use --path. Use --all to generate
    /// for all packages in the workspace that have a docker-compose file.
    ///
    /// Example: mows tools cargo-workspace-docker
    /// Example: mows tools cargo-workspace-docker --all
    #[command(name = "cargo-workspace-docker")]
    CargoWorkspaceDocker {
        /// Generate for all packages with docker-compose in the workspace
        #[arg(long)]
        all: bool,
        /// Path to package (default: current directory)
        #[arg(short, long)]
        path: Option<PathBuf>,
    },
}

/// Build a clap Command for the `mpm` alias binary.
///
/// This extracts the `package-manager` subcommand tree from the full `mows` CLI
/// and presents it at the top level as `mpm`, so completions and man pages
/// show `mpm compose ...` rather than `mows package-manager compose ...`.
///
/// # Errors
///
/// Returns an error if the `package-manager` subcommand is not found in the CLI definition.
pub fn build_mpm_command() -> crate::error::Result<Command> {
    let cli_cmd = Cli::command();

    let package_manager_cmd = cli_cmd
        .get_subcommands()
        .find(|c| c.get_name() == "package-manager")
        .ok_or_else(|| crate::error::MowsError::Config(
            "package-manager subcommand not found in CLI definition (internal error)".to_string(),
        ))?;

    let mut mpm = Command::new("mpm")
        .about("mpm - MOWS Package Manager (alias for 'mows package-manager')")
        .disable_version_flag(true)
        .arg(
            clap::Arg::new("verbose")
                .short('v')
                .long("verbose")
                .global(true)
                .action(clap::ArgAction::SetTrue)
                .help("Enable verbose output (debug logging)"),
        );

    for sub in package_manager_cmd.get_subcommands() {
        mpm = mpm.subcommand(sub.clone());
    }

    Ok(mpm)
}
