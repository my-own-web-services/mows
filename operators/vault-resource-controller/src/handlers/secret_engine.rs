use crate::{
    crd::{KV2SecretEngineParams, VaultSecretEngine},
    ControllerError,
};
use mows_common_rust::templating::{
    functions::TEMPLATE_FUNCTIONS,
    gtmpl::{Context as GtmplContext, Template},
};
use serde_variant::to_variant_name;
use std::collections::HashMap;
use tracing::{debug, instrument, trace};
use vaultrs::client::VaultClient;

const TEMPLATE_KEYWORD: &str = "template.vrc.reserved.mows.cloud";

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

#[instrument(skip(vault_client), level = "trace")]
pub async fn apply_secret_engine(
    vault_client: &VaultClient,
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

#[instrument(skip(vault_client), level = "trace")]
pub async fn apply_kv2_engine(
    vault_client: &VaultClient,
    mount_path: &str,
    kv2_secret_engine: &KV2SecretEngineParams,
    resource_namespace: &str,
    resource_name: &str,
) -> Result<(), ControllerError> {
    for (new_secret_path, new_secret_kv_template) in kv2_secret_engine.kv_data.iter() {
        let mut current_secret_kv_data: HashMap<String, String> =
            vaultrs::kv2::read(vault_client, mount_path, new_secret_path)
                .await
                .unwrap_or_default();

        let mut value_changed = false;

        for (new_key, new_template) in new_secret_kv_template.iter() {
            // update the secret values only if the value pre rendering has changed

            if let Some(last_template) =
                current_secret_kv_data.get(format!("{}_{}", new_key, TEMPLATE_KEYWORD).as_str())
            {
                if last_template == new_template {
                    continue;
                }
            }
            value_changed = true;

            let mut template = Template::default();
            template.add_funcs(&TEMPLATE_FUNCTIONS);
            template.parse(new_template.clone().replace("{%", "{{").replace("%}", "}}"))?;

            current_secret_kv_data.insert(new_key.to_string(), template.render(&GtmplContext::empty())?);
            current_secret_kv_data.insert(format!("{}_{}", new_key, TEMPLATE_KEYWORD), new_template.clone());
        }

        if value_changed {
            trace!(
                "Creating secret {:?} in Vault at {:?} with data {:?}",
                new_secret_path,
                mount_path,
                current_secret_kv_data
            );
            vaultrs::kv2::set(vault_client, mount_path, new_secret_path, &current_secret_kv_data).await?;
        } else {
            trace!(
                "Skipping secret {:?} in Vault at {:?} as value has not changed",
                new_secret_path,
                mount_path
            );
        }

        // TODO: delete key-values that are not in the new secret
    }

    // TODO: delete secrets that are not in the new secret engine

    Ok(())
}
