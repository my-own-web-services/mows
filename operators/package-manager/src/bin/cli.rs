use anyhow::Context;
use clap::Parser;
use mows_package_manager::{rendered_document::CrdHandling, repository::Repository};

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    uri: String,
    #[arg(short, long)]
    namespace: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();

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

    Repository::new(&args.uri)
        .install(
            &args.namespace,
            "/tmp/mows-package-manager-cli",
            &CrdHandling::CrdFirst,
            &kubeconfig,
        )
        .await
        .context(format!(
            "Failed to install core repo: {} in namespace: {}",
            &args.uri, &args.namespace
        ))?;

    Ok(())
}
