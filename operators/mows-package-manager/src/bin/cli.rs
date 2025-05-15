use anyhow::Context;
use clap::{Parser, Subcommand};

use mows_common_rust::observability::init_minimal_observability;
use mows_package_manager::{
    dev::get_fake_cluster_config,
    rendered_document::{CrdHandling, RenderedDocument},
    repository::Repository,
};

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Cli {
    #[clap(subcommand)]
    command: Commands,
    /// Log debug information
    #[arg(short, long, global = true)]
    verbose: Option<String>,
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

    let log_level = match cli.verbose.as_deref() {
        Some(value) => {
            if value.is_empty() {
                "info"
            } else {
                value
            }
        }
        None => "info",
    };

    init_minimal_observability(&log_level).await?;

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
