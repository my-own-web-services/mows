use std::collections::HashMap;

use mows_common::templating::{
    functions::TEMPLATE_FUNCTIONS,
    gtmpl::{Context as GtmplContext, Template},
};

use serde_variant::to_variant_name;
use tracing::{debug, instrument};
use vaultrs::client::VaultClient;

use crate::{
    crd::{KV2SecretEngineParams, VaultSecretEngine},
    ControllerError,
};

#[instrument(skip(vault_client))]
pub async fn handle_secret_engine(
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

    debug!("Created secret engine at {:?} in Vault", mount_path);

    match &vault_secret_engine {
        VaultSecretEngine::KV2(kv2_secret_engine_params) => {
            debug!("Handling KV2 secret engine at {:?} in Vault", mount_path);
            handle_kv2_engine(vault_client, &mount_path, kv2_secret_engine_params).await?
        }
        VaultSecretEngine::Transit(_) => {}
    }

    Ok(())
}

#[instrument(skip(vault_client))]
pub async fn handle_kv2_engine(
    vault_client: &VaultClient,
    mount_path: &str,
    kv2_secret_engine_params: &KV2SecretEngineParams,
) -> Result<(), ControllerError> {
    for (secret_path, secret_kv_data) in kv2_secret_engine_params.kv_data.iter() {
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
