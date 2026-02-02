// mows only supports Unix-like operating systems (Linux, macOS)
// due to Unix-specific features like file permission modes and symlinks
#[cfg(not(unix))]
compile_error!("mows only supports Unix-like operating systems (Linux, macOS)");

mod cli;
pub mod error;
mod manpage;
mod package_manager;
mod self_update;
mod shell_init;
mod template;
mod tools;
mod utils;

use std::path::Path;

use clap::Parser;
use colored::Colorize;
use tracing_subscriber::EnvFilter;

use cli::{Cli, Commands, ComposeCommands, PackageManagerCommands, SecretsCommands, ToolCommands};
use manpage::manpage;
use package_manager::{
    compose_cd, compose_init, compose_install, compose_passthrough, compose_up, compose_update,
    secrets_regenerate,
};
use self_update::{check_for_updates_background, notify_if_update_available, self_update, show_version};
use shell_init::shell_init;
use template::render_template_command;
use tools::{
    drives_command, expand_object_command, flatten_object_command, jq_command, json_to_yaml,
    prettify_json, workspace_docker_command, yaml_to_json,
};

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

/// Detect whether the binary was invoked via the `mpm` symlink.
///
/// Inspects `argv[0]` to extract the filename component. When the binary
/// is called via a `mpm -> mows` symlink, argv[0] will end with `mpm`,
/// and we return `true` so the caller can inject the `package-manager` subcommand.
fn is_mpm_invocation() -> bool {
    std::env::args()
        .next()
        .and_then(|arg| {
            Path::new(&arg)
                .file_name()
                .map(|f| f.to_string_lossy() == "mpm")
        })
        .unwrap_or(false)
}

fn main() {
    let cli = if is_mpm_invocation() {
        // When called as "mpm", insert "package-manager" after the binary name
        // so that `mpm compose up` becomes `mows package-manager compose up`
        let args = std::iter::once("mows".into())
            .chain(std::iter::once("package-manager".into()))
            .chain(std::env::args().skip(1))
            .collect::<Vec<String>>();
        Cli::parse_from(args)
    } else {
        Cli::parse()
    };

    init_tracing(cli.verbose);

    // Show update notification from previous check (first line of output)
    notify_if_update_available();

    let result = match cli.command {
        Commands::PackageManager { command } => handle_package_manager_command(command),
        Commands::Tools { tool } => handle_tool_command(tool),
        Commands::Template {
            input,
            variables,
            output,
        } => render_template_command(&input, &variables, &output),
        Commands::SelfUpdate { build, version } => self_update(build, version.as_deref()),
        Commands::Version => show_version(),
        Commands::Manpage { install } => manpage(install),
        Commands::ShellInit { install } => shell_init(install),
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

fn handle_package_manager_command(command: PackageManagerCommands) -> error::Result<()> {
    match command {
        PackageManagerCommands::Compose { command } => handle_compose_command(command),
    }
}

fn handle_compose_command(command: ComposeCommands) -> error::Result<()> {
    match command {
        ComposeCommands::Up => compose_up(),
        ComposeCommands::Init { name } => compose_init(name.as_deref()),
        ComposeCommands::Install { url, target } => compose_install(&url, target.as_deref()),
        ComposeCommands::Update => compose_update(),
        ComposeCommands::Cd { project, instance } => compose_cd(&project, instance.as_deref()),
        ComposeCommands::Secrets { command } => match command {
            SecretsCommands::Regenerate { key } => secrets_regenerate(key.as_deref()),
        },
        ComposeCommands::Passthrough(args) => compose_passthrough(&args),
    }
}

fn handle_tool_command(tool: ToolCommands) -> error::Result<()> {
    match tool {
        ToolCommands::JsonToYaml { input, output } => {
            json_to_yaml(input.as_deref(), output.as_deref())
        }
        ToolCommands::YamlToJson { input, output } => {
            yaml_to_json(input.as_deref(), output.as_deref())
        }
        ToolCommands::PrettifyJson { input, output } => {
            prettify_json(input.as_deref(), output.as_deref())
        }
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
        ToolCommands::CargoWorkspaceDocker { all, path } => {
            workspace_docker_command(all, path.as_deref())
        }
        ToolCommands::Drives => drives_command(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_filename_extraction() {
        // Tests the Path::file_name() logic used by is_mpm_invocation()
        let cases: &[(&str, &str)] = &[
            ("/usr/local/bin/mpm", "mpm"),
            ("./mows", "mows"),
            ("mows", "mows"),
            ("/usr/bin/mpm", "mpm"),
            ("target/release/mows", "mows"),
            ("/home/user/.local/bin/mpm", "mpm"),
        ];

        for (input, expected) in cases {
            let path = Path::new(input);
            assert_eq!(
                path.file_name().unwrap().to_string_lossy(),
                *expected,
                "Failed for input: {}", input,
            );
        }
    }

    #[test]
    fn test_mpm_detection_logic() {
        // Tests the comparison logic used by is_mpm_invocation()
        let mpm_names = ["mpm"];
        let non_mpm_names = ["mows", "mows.bin", "mpm_wrapper", "my-mpm", ""];

        for name in &mpm_names {
            assert!(
                *name == "mpm",
                "'{}' should be detected as mpm invocation", name,
            );
        }

        for name in &non_mpm_names {
            assert!(
                *name != "mpm",
                "'{}' should NOT be detected as mpm invocation", name,
            );
        }
    }

    #[test]
    fn test_build_mpm_command_succeeds() {
        // Verifies that build_mpm_command() returns Ok and has the expected structure
        let cmd = cli::build_mpm_command()
            .expect("build_mpm_command() should succeed");

        assert_eq!(cmd.get_name(), "mpm");

        // Verify it has the compose subcommand
        let subcommands: Vec<&str> = cmd
            .get_subcommands()
            .map(|c| c.get_name())
            .collect();
        assert!(
            subcommands.contains(&"compose"),
            "mpm command should have 'compose' subcommand, found: {:?}",
            subcommands,
        );
    }

    #[test]
    fn test_build_mpm_command_has_verbose_flag() {
        let cmd = cli::build_mpm_command()
            .expect("build_mpm_command() should succeed");

        let args: Vec<&str> = cmd
            .get_arguments()
            .map(|a| a.get_id().as_str())
            .collect();
        assert!(
            args.contains(&"verbose"),
            "mpm command should have 'verbose' argument, found: {:?}",
            args,
        );
    }

    #[test]
    fn test_build_mpm_command_compose_has_all_subcommands() {
        let cmd = cli::build_mpm_command()
            .expect("build_mpm_command() should succeed");

        let compose_cmd = cmd
            .get_subcommands()
            .find(|c| c.get_name() == "compose")
            .expect("compose subcommand should exist");

        let subcommands: Vec<&str> = compose_cmd
            .get_subcommands()
            .map(|c| c.get_name())
            .collect();

        let expected = ["up", "init", "install", "update", "cd", "secrets"];
        for expected_cmd in &expected {
            assert!(
                subcommands.contains(expected_cmd),
                "compose should have '{}' subcommand, found: {:?}",
                expected_cmd, subcommands,
            );
        }
    }
}
