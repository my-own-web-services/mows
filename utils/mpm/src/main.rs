mod cli;
mod compose;
mod template;
mod tools;
mod utils;

use clap::Parser;
use tracing_subscriber::EnvFilter;

use cli::{Cli, Commands, ComposeCommands, SecretsCommands, ToolCommands};
use compose::{compose_cd, compose_init, compose_install, compose_passthrough, compose_up, compose_update, secrets_regenerate};
use template::render_template_command;
use tools::{expand_object_command, flatten_object_command, jq_command, json_to_yaml, prettify_json, yaml_to_json};
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
        },
        Commands::Template {
            input,
            variables,
            output,
        } => render_template_command(&input, &variables, &output),
    };

    if let Err(e) = result {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}
