use anyhow::Context;
use clap::{Parser, Subcommand};

use mows_common_rust::observability::init_minimal_observability_with_color;
use mows_package_manager::{
    dev::get_fake_cluster_config,
    error_formatter::set_no_color,
    rendered_document::{CrdHandling, RenderedDocument},
    repository::Repository,
};

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Cli {
    #[clap(subcommand)]
    command: Commands,
    /// Set log level or increase verbosity (-v for debug, -vv for trace, or --verbose=level)
    #[arg(short, long, global = true, action = clap::ArgAction::Count)]
    verbose: u8,
    /// Custom log level filter
    #[arg(long = "log-level", global = true)]
    log_level: Option<String>,
    /// Disable colored output
    #[arg(long = "no-color", global = true)]
    no_color: bool,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Install {
        /// The url of the mows repository
        #[arg(short, long)]
        url: String,
        #[arg(short, long)]
        name: String,
    },
    Template {
        /// The url of the mows repository
        #[arg(short, long)]
        url: String,
        #[arg(short, long)]
        name: String,
        /// Output the debug output
        #[arg(short, long)]
        debug: bool,
        #[arg(short, long)]
        output: Option<String>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // Build log filter based on verbosity level or custom log level
    // -v         = debug for mows_package_manager and mows_common_rust
    // -vv        = trace for mows_package_manager and mows_common_rust
    // --log-level=level = use custom log level string
    // Always keep hyper and reqwest at warn level
    let log_filter = if let Some(custom_level) = &cli.log_level {
        format!("{},hyper=warn,reqwest=warn", custom_level)
    } else {
        match cli.verbose {
            0 => "info,hyper=warn,reqwest=warn".to_string(),
            1 => "mows_package_manager=debug,mows_common_rust=debug,info,hyper=warn,reqwest=warn".to_string(),
            _ => "mows_package_manager=trace,mows_common_rust=trace,info,hyper=warn,reqwest=warn".to_string(),
        }
    };

    // Set the global no-color flag
    set_no_color(cli.no_color);

    // Initialize observability with color settings
    init_minimal_observability_with_color(&log_filter, !cli.no_color).await?;

    match cli.command {
        Commands::Install { url, name } => {
            let kubeconfig_path =
                std::env::var("KUBECONFIG").unwrap_or_else(|_| "~/.kube/config".to_string());

            // use shell expansion to resolve the path
            let kubeconfig_path = shellexpand::tilde(&kubeconfig_path).to_string();

            let kubeconfig = tokio::fs::read_to_string(&kubeconfig_path)
                .await
                .context(format!(
                    "Failed to read kubeconfig from path: {}",
                    &kubeconfig_path
                ))?;
            Repository::new(&url)
                .install(
                    &name,
                    "/tmp/mows-package-manager-cli",
                    &CrdHandling::CrdFirst,
                    &kubeconfig,
                )
                .await
                .context(format!(
                    "Failed to install core repo: {} in namespace: {}",
                    &url, &name
                ))?;
        }
        Commands::Template {
            url,
            name,
            debug,
            output,
        } => {
            let cluster_variables = get_fake_cluster_config().await;

            let results = Repository::new(&url)
                .render(&name, "/tmp/mows-package-manager-cli", &cluster_variables)
                .await
                .context(format!(
                    "Failed to install core repo: {} in namespace: {}",
                    &url, &name
                ))?;
            handle_output(results, output, debug).await?;
        }
    }

    Ok(())
}

pub async fn handle_output(
    results: Vec<RenderedDocument>,
    output_path: Option<String>,
    debug: bool,
) -> anyhow::Result<()> {
    let mut output_text = String::new();
    if debug {
        for result in &results {
            output_text.push_str(&serde_yaml_ng::to_string(&result)?);
            output_text.push_str("\n---\n");
        }
    } else {
        for result in &results {
            output_text.push_str(&serde_yaml_ng::to_string(&result.resource)?);
            output_text.push_str("\n---\n");
        }
    }

    match output_path {
        Some(output_path) => {
            tokio::fs::write(&output_path, output_text)
                .await
                .context(format!("Failed to write output to path: {}", &output_path))?;
        }
        None => {
            println!("{}", output_text);
        }
    }

    Ok(())
}
