use crate::{
    crd::{KV2SecretEngineParams, VaultResource, VaultResourceSpec, VaultSecretEngine},
    ControllerError,
};
use anyhow::anyhow;
use kube::Api;
use mows_common::templating::{
    functions::TEMPLATE_FUNCTIONS,
    gtmpl::{Context as GtmplContext, Template},
};
use serde_variant::to_variant_name;
use std::collections::HashMap;
use tracing::{debug, instrument};
use vaultrs::client::VaultClient;

#[instrument(skip(vault_client), level = "trace")]
pub async fn cleanup_secret_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_secret_engine: &VaultSecretEngine,
) -> Result<(), ControllerError> {
    let mount_path = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    let current_secret_engines = vaultrs::sys::mount::list(vault_client).await?;

    debug!("Cleaning up secret engine at {:?} in Vault", mount_path);

    if current_secret_engines.contains_key(&format!("{mount_path}/")) {
        vaultrs::sys::mount::disable(vault_client, &mount_path).await?;
    }

    Ok(())
}

#[instrument(skip(vault_client, kube_client), level = "trace")]
pub async fn apply_secret_engine(
    vault_client: &VaultClient,
    kube_client: &kube::Client,
    resource_namespace: &str,
    resource_name: &str,
    vault_secret_engine: &VaultSecretEngine,
) -> Result<(), ControllerError> {
    let mount_path = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    let current_secret_engines = vaultrs::sys::mount::list(vault_client).await?;

    if !current_secret_engines.contains_key(&format!("{mount_path}/")) {
        vaultrs::sys::mount::enable(
            vault_client,
            &mount_path,
            to_variant_name(&vault_secret_engine).unwrap(),
            None,
        )
        .await?;
    }

    debug!("Creating secret engine at {:?} in Vault", mount_path);

    match &vault_secret_engine {
        VaultSecretEngine::KV2(kv2_secret_engine_params) => {
            debug!("Handling KV2 secret engine at {:?} in Vault", mount_path);
            apply_kv2_engine(
                vault_client,
                kube_client,
                &mount_path,
                kv2_secret_engine_params,
                resource_namespace,
                resource_name,
            )
            .await?
        }
        _ => {}
    }

    Ok(())
}

#[instrument(skip(vault_client, kube_client), level = "trace")]
pub async fn apply_kv2_engine(
    vault_client: &VaultClient,
    kube_client: &kube::Client,
    mount_path: &str,
    kv2_secret_engine_params: &KV2SecretEngineParams,
    resource_namespace: &str,
    resource_name: &str,
) -> Result<(), ControllerError> {
    // check if the vault_resource is already present in kubernetes and if it is check the fields that changed and update them in vault

    let vault_resource_api: Api<VaultResource> = Api::namespaced(kube_client.clone(), resource_namespace);

    let old_vault_resource = vault_resource_api.get_opt(resource_name).await.map_err(|e| {
        anyhow!(format!(
            "Failed to get VaultResource {:?} in namespace {:?}: {:?}",
            resource_name, resource_namespace, e
        ))
    })?;

    let old_kv2_secret_engine_params =
        old_vault_resource.and_then(|vault_resource| match vault_resource.spec {
            VaultResourceSpec::SecretEngine(old_secret_engine) => match old_secret_engine {
                VaultSecretEngine::KV2(old_kv2_secret_engine_params) => Some(old_kv2_secret_engine_params),
                _ => None,
            },
            _ => None,
        });

    for (secret_path, secret_kv_data) in kv2_secret_engine_params.kv_data.iter() {
        if let Some(old_kv2_secret_engine_params) = &old_kv2_secret_engine_params {
            if let Some(old_secret_kv_data) = old_kv2_secret_engine_params.kv_data.get(secret_path) {
                if old_secret_kv_data == secret_kv_data {
                    debug!(
                        "Secret {:?} in Vault at {:?} has not changed, skipping",
                        secret_path, mount_path
                    );
                    continue;
                }
            }
        }

        let mut rendered_secret_kv_data: HashMap<String, String> =
            vaultrs::kv2::read(vault_client, mount_path, secret_path)
                .await
                .unwrap_or_default();

        debug!(
            "Secret {:?} in Vault at {:?} has data {:?}",
            secret_path, mount_path, rendered_secret_kv_data
        );

        for (key, value) in secret_kv_data.iter() {
            // update the secret values only if they are not already present in the secret
            if rendered_secret_kv_data.contains_key(key) {
                continue;
            }

            let mut template = Template::default();
            template.add_funcs(&TEMPLATE_FUNCTIONS);
            template.parse(value.clone().replace("{%", "{{").replace("%}", "}}"))?;

            rendered_secret_kv_data.insert(key.to_string(), template.render(&GtmplContext::empty())?);
        }

        debug!(
            "Creating secret {:?} in Vault at {:?} with data {:?}",
            secret_path, mount_path, rendered_secret_kv_data
        );

        vaultrs::kv2::set(vault_client, mount_path, secret_path, &rendered_secret_kv_data).await?;
    }

    Ok(())
}
