use anyhow::Context;
use serde_variant::to_variant_name;
use tracing::instrument;
use vaultrs::{
    api::auth::kubernetes::requests::{
        ConfigureKubernetesAuthRequestBuilder, CreateKubernetesRoleRequestBuilder,
    },
    client::VaultClient,
};

use crate::crd::{KubernetesAuthEngineParams, KubernetesAuthEngineRole, VaultAuthEngine};

#[instrument(skip(vault_client), level = "trace")]
pub async fn cleanup_auth_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
) -> Result<(), crate::ControllerError> {
    let mount_path = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    let current_auth_engines = vaultrs::sys::auth::list(vault_client)
        .await
        .context("Failed to list auth engines in Vault")?;

    if current_auth_engines.contains_key(&format!("{mount_path}/")) {
        vaultrs::sys::auth::disable(vault_client, &mount_path)
            .await
            .context(format!("Failed to disable auth engine {mount_path} in Vault"))?;
    }

    Ok(())
}

#[instrument(skip(vault_client), level = "trace")]
pub async fn apply_auth_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_auth_engine: &VaultAuthEngine,
) -> Result<(), crate::ControllerError> {
    let mount_path = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    let current_auth_engines = vaultrs::sys::auth::list(vault_client)
        .await
        .context("Failed to list auth engines in Vault")?;

    if !current_auth_engines.contains_key(&format!("{mount_path}/")) {
        vaultrs::sys::auth::enable(
            vault_client,
            &mount_path,
            to_variant_name(&vault_auth_engine).unwrap(),
            None,
        )
        .await
        .context(format!("Failed to create auth engine {mount_path} in Vault"))?;
    }

    match &vault_auth_engine {
        VaultAuthEngine::Kubernetes(k8s_auth_engine_config) => apply_k8s_auth_engine(
            vault_client,
            &mount_path,
            resource_namespace,
            k8s_auth_engine_config,
        )
        .await
        .context(format!(
            "Failed to handle k8s auth engine for {mount_path} in Vault"
        ))?,
    }

    Ok(())
}

#[instrument(skip(vault_client), level = "trace")]
pub async fn apply_k8s_auth_engine(
    vault_client: &VaultClient,
    mount_path: &str,
    resource_namespace: &str,
    k8s_auth_engine_config: &KubernetesAuthEngineParams,
) -> Result<(), crate::ControllerError> {
    let kubernetes_ca_cert = std::fs::read_to_string("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")
        .context("Failed to read kubernetes ca cert")?;

    vaultrs::auth::kubernetes::configure(
        vault_client,
        mount_path,
        "https://kubernetes.default.svc",
        Some(&mut ConfigureKubernetesAuthRequestBuilder::default().kubernetes_ca_cert(kubernetes_ca_cert)),
    )
    .await
    .context("Failed to configure kubernetes auth for vrc in Vault")?;

    for (role_name, role) in k8s_auth_engine_config.roles.iter() {
        apply_k8s_auth_role(vault_client, mount_path, resource_namespace, role_name, role)
            .await
            .context(format!("Failed to create k8s auth role {:?}", role_name))?;
    }

    Ok(())
}

#[instrument(skip(vault_client), level = "trace")]
pub async fn apply_k8s_auth_role(
    vault_client: &VaultClient,
    mount_path: &str,
    resource_namespace: &str,
    role_name: &str,
    role: &KubernetesAuthEngineRole,
) -> Result<(), crate::ControllerError> {
    let namespace = role.namespace.clone().unwrap_or(resource_namespace.to_string());

    let policy_ids = role
        .policy_ids
        .clone()
        .into_iter()
        .map(|policy_id| format!("mows-core-secrets-vrc/{}/{}", resource_namespace, policy_id))
        .collect::<Vec<_>>();

    vaultrs::auth::kubernetes::role::create(
        vault_client,
        mount_path,
        role_name,
        Some(
            &mut CreateKubernetesRoleRequestBuilder::default()
                .bound_service_account_names(vec![role.service_account_name.clone()])
                .bound_service_account_namespaces(vec![namespace.clone()])
                .token_policies(policy_ids)
                .token_ttl("1h")
                .token_max_ttl("1h"),
        ),
    )
    .await
    .context("Failed to create role in Vault")?;

    Ok(())
}
