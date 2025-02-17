use std::path::Path;

use anyhow::Context;
use itertools::Itertools;
use tracing::instrument;
use vaultrs::client::VaultClient;

use crate::crd::{VaultEngineAccessPolicy, VaultEngineAccessPolicyType};

#[instrument(skip(vault_client), level = "trace")]
pub async fn cleanup_engine_access_policy(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
) -> anyhow::Result<()> {
    let policy_name = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    vaultrs::sys::policy::delete(vault_client, &policy_name)
        .await
        .context(format!("Failed to delete policy {policy_name} in Vault"))?;

    Ok(())
}

#[instrument(skip(vault_client), level = "trace")]
pub async fn apply_engine_access_policy(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_engine_access_policy: &VaultEngineAccessPolicy,
) -> anyhow::Result<()> {
    let policy_name = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    /*
    let current_policies_res = vaultrs::sys::policy::list(vault_client)
        .await
        .context("Failed to list policies in Vault")?;

    if current_policies_res
        .policies
        .contains(&"{policy_name}".to_string())
    {
        return Ok(());
    }*/

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
