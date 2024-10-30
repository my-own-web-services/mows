use std::{borrow::BorrowMut, collections::HashMap, hash::Hash};

use anyhow::Context;

use serde_variant::to_variant_name;
use tracing::debug;
use tracing_subscriber::field::debug;
use vaultrs::client::VaultClient;

use crate::{templating::funcs::TEMPLATE_FUNCTIONS, Error, KV2SecretEngineParams, VaultSecretEngine};

pub async fn handle_secret_engine(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_secret_engine: &VaultSecretEngine,
) -> Result<(), Error> {
    let mount_path = format!("mows-core-secrets-vrc/{}/{}", resource_namespace, resource_name);

    let current_secret_engines = vaultrs::sys::mount::list(vault_client).await?;

    if current_secret_engines.contains_key(&format!("{mount_path}/")) {
        return Ok(());
    }

    debug!(
        "Creating
          
            secret engine at {:?} in Vault",
        mount_path
    );

    vaultrs::sys::mount::enable(
        vault_client,
        &mount_path,
        to_variant_name(&vault_secret_engine).unwrap(),
        None,
    )
    .await?;

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

pub async fn handle_kv2_engine(
    vault_client: &VaultClient,
    mount_path: &str,
    kv2_secret_engine_params: &KV2SecretEngineParams,
) -> Result<(), Error> {
    for (secret_path, secret_kv_data) in kv2_secret_engine_params.kv_data.iter() {
        let mut rendered_secret_kv_data = HashMap::new();

        for (key, value) in secret_kv_data.iter() {
            let mut template = gtmpl::Template::default();
            template.add_funcs(&TEMPLATE_FUNCTIONS);
            template.parse(value.clone().replace("{%", "{{").replace("%}", "}}"))?;
            rendered_secret_kv_data.insert(key, template.render(&gtmpl::Context::empty())?);
        }

        debug!(
            "Creating secret {:?} in Vault at {:?} with data {:?}",
            secret_path, mount_path, rendered_secret_kv_data
        );

        vaultrs::kv2::set(vault_client, mount_path, secret_path, &rendered_secret_kv_data).await?;
    }

    Ok(())
}
