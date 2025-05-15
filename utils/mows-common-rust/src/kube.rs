use kube::{
    config::{KubeConfigOptions, Kubeconfig},
    Client,
};

pub async fn get_kube_client(kubeconfig: &str) -> anyhow::Result<Client> {
    let kc = Kubeconfig::from_yaml(&kubeconfig).map_err(|e| anyhow::anyhow!(e.to_string()))?;

    let kc = kube::Config::from_custom_kubeconfig(kc, &KubeConfigOptions::default()).await?;

    let client = kube::client::Client::try_from(kc)?;

    Ok(client)
}
