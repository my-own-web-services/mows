use std::path::Path;

use crate::KubernetesAuthEngineParams;
use crate::KubernetesAuthEngineRole;
use crate::VaultAuthEngine;
use crate::VaultAuthEngineType;
use crate::VaultEngineAccessPolicy;
use crate::VaultEngineAccessPolicyType;
use crate::VaultResource;
use crate::VaultResourceSpec::*;
use crate::VaultSecretEngine;
use anyhow::Context;
use itertools::Itertools;
use serde_variant::to_variant_name;
use vaultrs::api::auth::kubernetes::requests::ConfigureKubernetesAuthRequestBuilder;
use vaultrs::api::auth::kubernetes::requests::CreateKubernetesRoleRequestBuilder;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};

pub async fn create_vault_client() -> anyhow::Result<VaultClient> {
    let mut client_builder = VaultClientSettingsBuilder::default();

    client_builder.address("http://mows-core-secrets-vault-active.mows-core-secrets-vault:8200");

    let vc = VaultClient::new(client_builder.build().context("Failed to create vault client")?)?;

    let service_account_jwt = std::fs::read_to_string("/var/run/secrets/kubernetes.io/serviceaccount/token")
        .context("Failed to read service account token")?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        "mows-core-secrets-vrc-sys",
        "mows-core-secrets-vrc",
        &service_account_jwt,
    )
    .await?;

    let vc = VaultClient::new(
        client_builder
            .token(&vault_auth.client_token)
            .build()
            .context("Failed to create vault client")?,
    )?;

    dbg!(&vault_auth.client_token);

    //vc.settings.token = vault_auth.client_token;

    Ok(vc)
}

pub async fn reconcile_resource(vault_resource: &VaultResource) -> anyhow::Result<()> {
    let vc = create_vault_client()
        .await
        .context("Failed to create vault client")?;

    let ns = vault_resource.metadata.namespace.as_deref().unwrap_or("default");

    match &vault_resource.spec {
        SecretEngine(vault_secret_engine) => handle_secret_engine(&vc, ns, vault_secret_engine).await?,
        AuthEngine(vault_auth_engine) => handle_auth_engine(&vc, ns, vault_auth_engine).await?,
        EngineAccessPolicy(vault_engine_access_policy) => {
            handle_engine_access_policy(&vc, ns, vault_engine_access_policy).await?
        }
    }

    Ok(())
}

pub async fn handle_auth_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    vault_auth_engine: &VaultAuthEngine,
) -> anyhow::Result<()> {
    let mount_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_auth_engine.engine_id
    );

    let current_auth_engines = vaultrs::sys::auth::list(vault_client)
        .await
        .context("Failed to list auth engines in Vault")?;

    if current_auth_engines.contains_key(&format!("{mount_path}/")) {
        return Ok(());
    }

    vaultrs::sys::auth::enable(
        vault_client,
        &mount_path,
        &to_variant_name(&vault_auth_engine.engine).unwrap(),
        None,
    )
    .await
    .context(format!("Failed to create auth engine {mount_path} in Vault"))?;

    match &vault_auth_engine.engine {
        VaultAuthEngineType::Kubernetes(k8s_auth_engine_config) => handle_k8s_auth_engine(
            vault_client,
            &mount_path,
            &resource_namespace,
            k8s_auth_engine_config,
        )
        .await
        .context(format!(
            "Failed to handle k8s auth engine for {mount_path} in Vault"
        ))?,
    }

    Ok(())
}

pub async fn handle_k8s_auth_engine(
    vault_client: &VaultClient,
    mount_path: &str,
    resource_namespace: &str,
    k8s_auth_engine_config: &KubernetesAuthEngineParams,
) -> anyhow::Result<()> {
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
        handle_k8s_auth_role(vault_client, mount_path, resource_namespace, role_name, role)
            .await
            .context(format!("Failed to create k8s auth role {:?}", role_name))?;
    }

    Ok(())
}

pub async fn handle_k8s_auth_role(
    vault_client: &VaultClient,
    mount_path: &str,
    resource_namespace: &str,
    role_name: &str,
    role: &KubernetesAuthEngineRole,
) -> anyhow::Result<()> {
    let namespace = role.namespace.clone().unwrap_or(resource_namespace.to_string());

    let policy_ids = role
        .policy_ids
        .clone()
        .into_iter()
        .map(|policy_id| format!("mows-core-secrets-vrc/{}/{}", resource_namespace, policy_id))
        .collect::<Vec<_>>();

    vaultrs::auth::kubernetes::role::create(
        vault_client,
        &mount_path,
        &role_name,
        Some(
            &mut CreateKubernetesRoleRequestBuilder::default()
                .bound_service_account_names(vec![role.service_account_name.clone()])
                .bound_service_account_namespaces(vec![namespace.clone()])
                .token_policies(policy_ids),
        ),
    )
    .await
    .context("Failed to create role in Vault")?;

    Ok(())
}

pub async fn handle_secret_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    vault_secret_engine: &VaultSecretEngine,
) -> anyhow::Result<()> {
    let mount_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_secret_engine.engine_id
    );

    let current_secret_engines = vaultrs::sys::mount::list(vault_client)
        .await
        .context("Failed to list secret engines in Vault")?;

    if current_secret_engines.contains_key(&format!("{mount_path}/")) {
        return Ok(());
    }

    vaultrs::sys::mount::enable(
        vault_client,
        &mount_path,
        &to_variant_name(&vault_secret_engine.engine_type).unwrap(),
        None,
    )
    .await
    .context(format!("Failed to create secret engine {mount_path} in Vault"))?;

    Ok(())
}

pub async fn handle_engine_access_policy(
    vault_client: &VaultClient,
    resource_namespace: &str,
    vault_engine_access_policy: &VaultEngineAccessPolicy,
) -> anyhow::Result<()> {
    let policy_name = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_engine_access_policy.policy_id
    );

    let current_policies_res = vaultrs::sys::policy::list(vault_client)
        .await
        .context("Failed to list policies in Vault")?;

    if current_policies_res.policies.contains(&format!("{policy_name}")) {
        return Ok(());
    }

    let mut policy = String::new();

    for sub_policy in vault_engine_access_policy.sub_policies.iter() {
        let auth_prefix = match sub_policy.engine_type {
            VaultEngineAccessPolicyType::Auth => "auth",
            VaultEngineAccessPolicyType::Secret => "",
        };

        let path = Path::new(auth_prefix)
            .join("mows-core-secrets-vrc")
            .join(resource_namespace)
            .join(sub_policy.engine_id.clone())
            .join(sub_policy.sub_path.clone());

        let path = path.to_str().unwrap();

        let unique_capabilities = sub_policy
            .capabilities
            .clone()
            .into_iter()
            .unique()
            .collect::<Vec<_>>();

        let capabilities_array = serde_json::to_string(&unique_capabilities).unwrap();

        let sub_policy = format!(
            r#"path "{path}" {{
  capabilities = {capabilities_array}
}}"#,
        );

        policy.push_str(&sub_policy);
        policy.push_str("\n\n");
    }

    vaultrs::sys::policy::set(vault_client, &policy_name, &policy)
        .await
        .context(format!("Failed to create policy {policy_name} in Vault"))?;

    Ok(())
}
