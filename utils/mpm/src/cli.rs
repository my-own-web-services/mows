use clap::{Parser, Subcommand};
use std::path::PathBuf;

/// Build version string with git info
fn version_string() -> &'static str {
    concat!(
        env!("CARGO_PKG_VERSION"),
        " (",
        env!("GIT_HASH"),
        " ",
        env!("GIT_DATE"),
        ")"
    )
}

#[derive(Parser)]
#[command(name = "mpm")]
#[command(about = "mpm - MOWS Package Manager for Docker Compose deployments", long_about = None)]
#[command(version = version_string())]
pub struct Cli {
    /// Enable verbose output (debug logging)
    #[arg(short = 'v', long, global = true)]
    pub verbose: bool,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Build command
    Build,
    /// Docker Compose deployment management
    Compose {
        #[command(subcommand)]
        command: ComposeCommands,
    },
    /// Small utilities
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
    ///   Bash: ~/.local/share/bash-completion/completions/mpm
    ///   Zsh:  ~/.zsh/completions/_mpm (or ~/.oh-my-zsh/completions/_mpm)
    ///   Fish: ~/.config/fish/completions/mpm.fish
    #[command(name = "shell-init")]
    ShellInit {
        /// Install completions to standard directory
        #[arg(long)]
        install: bool,
    },
    /// Update mpm to the latest version
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
pub enum ComposeCommands {
    /// Render templates and start the deployment with docker compose up
    Up,
    /// Initialize a new mpm compose project
    Init {
        /// Project name (defaults to git repository name)
        name: Option<String>,
    },
    /// Install a mpm repo from a URL
    Install {
        /// Git repository URL to clone
        url: String,
        /// Target directory (defaults to current directory)
        #[arg(short, long)]
        target: Option<std::path::PathBuf>,
    },
    /// Update the repository and merge values
    Update,
    /// Print the path to a project directory
    ///
    /// Use with cd: cd $(mpm compose cd myproject)
    Cd {
        /// Project name to navigate to
        project: String,
        /// Instance name (if multiple instances exist)
        #[arg(short, long)]
        instance: Option<String>,
    },
    /// Manage secrets
    Secrets {
        #[command(subcommand)]
        command: SecretsCommands,
    },
    /// Pass through to docker compose with project context
    #[command(external_subcommand)]
    Passthrough(Vec<String>),
}

#[derive(Subcommand)]
pub enum SecretsCommands {
    /// Regenerate secrets (all or specific key)
    Regenerate {
        /// Specific key to regenerate (regenerates all if not specified)
        key: Option<String>,
    },
}

#[derive(Subcommand)]
pub enum ToolCommands {
    /// Convert JSON to YAML
    JsonToYaml {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Convert YAML to JSON
    YamlToJson {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Prettify JSON
    PrettifyJson {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },
    /// Expand flat dot-notation keys to nested object structure
    ExpandObject {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Path selector with glob support (e.g., "services.*.labels")
        /// Defaults to "services.*.labels" for Docker Compose files
        #[arg(short, long)]
        selector: Option<String>,
    },
    /// Flatten nested object structure to flat dot-notation keys
    FlattenObject {
        /// Input file (reads from stdin if not provided)
        #[arg(short, long)]
        input: Option<PathBuf>,
        /// Output file (writes to stdout if not provided)
        #[arg(short, long)]
        output: Option<PathBuf>,
        /// Path selector with glob support (e.g., "services.*.labels")
        /// Defaults to "services.*.labels" for Docker Compose files
        #[arg(short, long)]
        selector: Option<String>,
    },
    /// Run jq queries on JSON/YAML input
    Jq {
        /// jq query/filter to apply
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
    /// Generate cargo-workspace-docker.toml for Docker builds
    ///
    /// Creates minimal workspace configuration files for Dockerized Rust builds.
    /// Automatically finds the workspace root and resolves all dependencies
    /// (including transitive ones) needed for the package.
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
