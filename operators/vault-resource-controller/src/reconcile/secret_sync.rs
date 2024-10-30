use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
};

use gtmpl_derive::Gtmpl;
use k8s_openapi::api::core::v1::Secret;
use kube::api::{ObjectMeta, Patch};
use tracing::debug;
use vaultrs::client::VaultClient;

use crate::{VaultSecretSync, VAULT_RESOURCES_FINALIZER};

#[derive(Gtmpl)]
struct Context {
    secrets: HashMap<String, HashMap<String, String>>,
}

pub async fn handle_secret_sync(
    vault_client: &VaultClient,
    resource_namespace: &str,
    resource_name: &str,
    vault_secret_sync: &VaultSecretSync,
    kube_client: &kube::Client,
) -> Result<(), crate::Error> {
    let mut fetched_secrets: HashMap<String, HashMap<String, String>> = HashMap::new();

    for (template_key, fetch_from) in vault_secret_sync.kv_mapping.iter() {
        let vault_engine_path = Path::new("mows-core-secrets-vrc")
            .join(resource_namespace)
            .join(&fetch_from.engine);
        let vault_engine_path = vault_engine_path.to_str().ok_or(crate::Error::GenericError(
            "Failed to create engine path".to_string(),
        ))?;

        debug!("Fetching secrets from: {:?}", &vault_engine_path);

        let secret: HashMap<String, String> =
            vaultrs::kv2::read(vault_client, &vault_engine_path, &fetch_from.path).await?;
        fetched_secrets.insert(template_key.clone(), secret);
    }

    debug!("Fetched secrets: {:?}", fetched_secrets);

    let mut rendered_secrets: HashMap<String, String> = HashMap::new();

    let mut template_creator = gtmpl::Template::default();
    template_creator.add_funcs(&crate::templating::funcs::TEMPLATE_FUNCTIONS);

    let context = gtmpl::Context::from(Context {
        secrets: fetched_secrets.clone(),
    });

    for (target_name, target) in vault_secret_sync.targets.iter() {
        template_creator.parse(target.template.clone().replace("{%", "{{").replace("%}", "}}"))?;
        rendered_secrets.insert(target_name.clone(), template_creator.render(&context)?);
    }

    debug!("Rendered secrets: {:?}", rendered_secrets);

    // create secrets in k8s
    let secret_api: kube::Api<Secret> = kube::Api::namespaced(kube_client.clone(), resource_namespace);

    let mut labels = BTreeMap::new();

    labels.insert(
        "app.kubernetes.io/managed-by".to_string(),
        VAULT_RESOURCES_FINALIZER.to_string(),
    );

    for (secret_name, secret) in rendered_secrets {
        let mut secret_map = BTreeMap::new();

        secret_map.insert("data".to_string(), secret);

        let secret = Secret {
            metadata: ObjectMeta {
                name: Some(secret_name.clone()),
                namespace: Some(resource_namespace.to_string()),
                labels: Some(labels.clone()),
                ..Default::default()
            },
            string_data: Some(secret_map),
            ..Default::default()
        };

        let secret_exists = secret_api
            .get_opt(&secret_name)
            .await
            .map_err(crate::Error::KubeError)?;

        if let Some(secret) = &secret_exists {
            if let Some(labels) = &secret.metadata.labels {
                if let Some(managed_by) = labels.get("app.kubernetes.io/managed-by") {
                    if managed_by != VAULT_RESOURCES_FINALIZER {
                        return Err(crate::Error::GenericError(format!(
                            "Secret {} is not managed by vrc",
                            secret_name
                        )));
                    }
                } else {
                    return Err(crate::Error::GenericError(format!(
                        "Secret {} is not managed by vrc",
                        secret_name
                    )));
                }
            }
            let mut patch_params = kube::api::PatchParams::default();
            patch_params.field_manager = Some(VAULT_RESOURCES_FINALIZER.to_string());
            secret_api
                .patch(&secret_name, &patch_params, &Patch::Apply(secret))
                .await
                .map_err(crate::Error::KubeError)?;
        } else {
            secret_api
                .create(&kube::api::PostParams::default(), &secret)
                .await
                .map_err(crate::Error::KubeError)?;
        }
    }

    Ok(())
}
