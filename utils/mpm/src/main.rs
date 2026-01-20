// mpm only supports Unix-like operating systems (Linux, macOS)
// due to Unix-specific features like file permission modes and symlinks
#[cfg(not(unix))]
compile_error!("mpm only supports Unix-like operating systems (Linux, macOS)");

mod cli;
mod compose;
pub mod error;
mod manpage;
mod self_update;
mod shell_init;
mod template;
mod tools;
mod utils;
mod yaml_indent;

use clap::Parser;
use colored::Colorize;
use tracing_subscriber::EnvFilter;

use cli::{Cli, Commands, ComposeCommands, SecretsCommands, ToolCommands};
use compose::{compose_cd, compose_init, compose_install, compose_passthrough, compose_up, compose_update, secrets_regenerate};
use manpage::manpage;
use self_update::{check_for_updates_background, notify_if_update_available, self_update, show_version};
use shell_init::shell_init;
use template::render_template_command;
use tools::{drives_command, expand_object_command, flatten_object_command, jq_command, json_to_yaml, prettify_json, workspace_docker_command, yaml_to_json};

fn init_tracing(verbose: bool) {
    // RUST_LOG environment variable takes precedence over -V flag
    let filter = if std::env::var("RUST_LOG").is_ok() {
        EnvFilter::from_default_env()
    } else if verbose {
        EnvFilter::new("debug")
    } else {
        EnvFilter::new("warn")
    };

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_file(true)
        .with_line_number(true)
        .init();
}

fn main() {
    let cli = Cli::parse();

    init_tracing(cli.verbose);

    // Show update notification from previous check (first line of output)
    notify_if_update_available();

    let result = match cli.command {
        Commands::Compose { command } => match command {
            ComposeCommands::Up => compose_up(),
            ComposeCommands::Init { name } => compose_init(name.as_deref()),
            ComposeCommands::Install { url, target } => compose_install(&url, target.as_deref()),
            ComposeCommands::Update => compose_update(),
            ComposeCommands::Cd { project, instance } => compose_cd(&project, instance.as_deref()),
            ComposeCommands::Secrets { command } => match command {
                SecretsCommands::Regenerate { key } => secrets_regenerate(key.as_deref()),
            },
            ComposeCommands::Passthrough(args) => compose_passthrough(&args),
        },
        Commands::Tools { tool } => match tool {
            ToolCommands::JsonToYaml { input, output } => json_to_yaml(input.as_deref(), output.as_deref()),
            ToolCommands::YamlToJson { input, output } => yaml_to_json(input.as_deref(), output.as_deref()),
            ToolCommands::PrettifyJson { input, output } => prettify_json(input.as_deref(), output.as_deref()),
            ToolCommands::ExpandObject {
                input,
                output,
                selector,
            } => expand_object_command(input.as_deref(), output.as_deref(), &selector),
            ToolCommands::FlattenObject {
                input,
                output,
                selector,
            } => flatten_object_command(input.as_deref(), output.as_deref(), &selector),
            ToolCommands::Jq {
                query,
                input,
                output,
                yaml,
            } => jq_command(&query, input.as_deref(), output.as_deref(), yaml),
            ToolCommands::CargoWorkspaceDocker { all, path } => workspace_docker_command(all, path.as_deref()),
            ToolCommands::Drives => drives_command(),
        },
        Commands::Template {
            input,
            variables,
            output,
        } => render_template_command(&input, &variables, &output),
        Commands::SelfUpdate { build, version } => {
            self_update(build, version.as_deref())
        }
        Commands::Version => show_version(),
        Commands::Manpage { install } => manpage(install),
        Commands::ShellInit { install } => {
            shell_init(install)
        }
    };

    // Check for updates after command completes (with 1s timeout, won't delay noticeably)
    // This ensures the check completes before process exit
    check_for_updates_background();

    if let Err(e) = result {
        let msg = e.to_string();
        // format_file_error output starts with newline and includes "error:" prefix
        // so don't duplicate it for those errors
        if msg.starts_with('\n') {
            eprintln!("{}", msg);
        } else {
            eprintln!("{}: {}", "error".red().bold(), msg);
        }
        std::process::exit(1);
    }
}
