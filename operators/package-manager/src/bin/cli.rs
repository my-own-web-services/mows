use anyhow::Context;
use clap::{Parser, Subcommand};

use mows_common::observability::init_minimal_observability;
use mows_package_manager::{rendered_document::CrdHandling, repository::Repository};

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Cli {
    #[clap(subcommand)]
    command: Commands,
    #[arg(short, long, global = true)]
    verbose: bool,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Install {
        #[arg(short, long)]
        uri: String,
        #[arg(short, long)]
        namespace: String,
    },
    Template {
        #[arg(short, long)]
        uri: String,
        #[arg(short, long)]
        namespace: String,
        #[arg(short, long)]
        debug: bool,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let log_level = if cli.verbose { "debug" } else { "info" };
    init_minimal_observability(log_level).await?;

    match cli.command {
        Commands::Install { uri, namespace } => {
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
            Repository::new(&uri)
                .install(
                    &namespace,
                    "/tmp/mows-package-manager-cli",
                    &CrdHandling::CrdFirst,
                    &kubeconfig,
                )
                .await
                .context(format!(
                    "Failed to install core repo: {} in namespace: {}",
                    &uri, &namespace
                ))?;
        }
        Commands::Template {
            uri,
            namespace,
            debug,
        } => {
            let results = Repository::new(&uri)
                .render(&namespace, "/tmp/mows-package-manager-cli")
                .await
                .context(format!(
                    "Failed to install core repo: {} in namespace: {}",
                    &uri, &namespace
                ))?;
            if debug {
                for result in &results {
                    println!("{}", serde_yaml_ng::to_string(&result)?);
                    println!("---");
                }
            } else {
                for result in &results {
                    println!("{}", serde_yaml_ng::to_string(&result.resource)?);
                    println!("---");
                }
            }
        }
    }

    Ok(())
}
