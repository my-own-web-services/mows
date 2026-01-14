// mpm only supports Unix-like operating systems (Linux, macOS)
// due to Unix-specific features like file permission modes and symlinks
#[cfg(not(unix))]
compile_error!("mpm only supports Unix-like operating systems (Linux, macOS)");

mod cli;
mod compose;
mod self_update;
mod template;
mod tools;
mod utils;
pub mod yaml_indent;

use clap::Parser;
use tracing_subscriber::EnvFilter;

use cli::{Cli, Commands, ComposeCommands, SecretsCommands, ToolCommands};
use compose::{compose_cd, compose_init, compose_install, compose_passthrough, compose_up, compose_update, secrets_regenerate};
use self_update::{check_for_updates_background, notify_if_update_available, self_update};
use template::render_template_command;
use tools::{expand_object_command, flatten_object_command, jq_command, json_to_yaml, prettify_json, workspace_docker_command, yaml_to_json};
use utils::find_git_root;

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

    // Check for update notification from previous check
    notify_if_update_available();

    // Spawn background update check (won't delay execution)
    check_for_updates_background();

    let result = match cli.command {
        Commands::Build => {
            match find_git_root() {
                Ok(root) => {
                    println!("Git repository root: {}", root.display());
                    // Does nothing else for now
                    Ok(())
                }
                Err(e) => Err(e),
            }
        }
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
            ToolCommands::JsonToYaml { input, output } => json_to_yaml(&input, &output),
            ToolCommands::YamlToJson { input, output } => yaml_to_json(&input, &output),
            ToolCommands::PrettifyJson { input, output } => prettify_json(&input, &output),
            ToolCommands::ExpandObject {
                input,
                output,
                selector,
            } => expand_object_command(&input, &output, &selector),
            ToolCommands::FlattenObject {
                input,
                output,
                selector,
            } => flatten_object_command(&input, &output, &selector),
            ToolCommands::Jq {
                query,
                input,
                output,
                yaml,
            } => jq_command(&query, &input, &output, yaml),
            ToolCommands::CargoWorkspaceDocker { all, path } => workspace_docker_command(all, &path),
        },
        Commands::Template {
            input,
            variables,
            output,
        } => render_template_command(&input, &variables, &output),
        Commands::SelfUpdate { build, version } => {
            self_update(build, version.as_deref())
        }
    };

    if let Err(e) = result {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}
