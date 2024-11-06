use crate::{
    get_current_config_cloned,
    reconcile::{
        auth::handle_auth_engine, policy::handle_engine_access_policy, secret_engine::handle_secret_engine,
        secret_sync::handle_secret_sync,
    },
    telemetry,
    utils::get_error_type,
    Error, Metrics, Result,
};
use anyhow::Context as anyhow_context;
use chrono::{DateTime, Utc};
use futures::StreamExt;
use kube::{
    api::{Api, ListParams, Patch, PatchParams, ResourceExt},
    client::Client,
    runtime::{
        controller::{Action, Controller},
        events::{Event, EventType, Recorder, Reporter},
        finalizer::{finalizer, Event as Finalizer},
        watcher::Config,
    },
    CustomResource, Resource,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, hash::Hash, sync::Arc};
use tokio::{sync::RwLock, time::Duration};
use tracing::*;
use vaultrs::client::{VaultClient, VaultClientSettingsBuilder};
pub static FINALIZER: &str = "vaultresources.k8s.mows.cloud";

/// Generate the Kubernetes wrapper struct `Document` from our Spec and Status struct
///
/// This provides a hook for generating the CRD yaml (in crdgen.rs) vault.k8s.mows.cloud
#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "VaultResource",
    group = "vault.k8s.mows.cloud",
    version = "v1",
    namespaced
)]
#[kube(status = "VaultResourceStatus", shortname = "vres")]
#[serde(rename_all = "camelCase")]
pub enum VaultResourceSpec {
    SecretEngine(VaultSecretEngine),
    AuthEngine(VaultAuthEngine),
    EngineAccessPolicy(VaultEngineAccessPolicy),
    SecretSync(VaultSecretSync),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretSync {
    pub kv_mapping: HashMap<String, SecretSyncKvMapping>,
    pub targets: VaultSecretSyncTargetTypes,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultSecretSyncTargetTypes {
    pub config_maps: Option<HashMap<String, HashMap<String, String>>>,
    pub secrets: Option<HashMap<String, HashMap<String, String>>>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
pub enum SecretSyncTargetResource {
    ConfigMap,
    Secret,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SecretSyncKvMapping {
    pub engine: String,
    pub path: String,
}

// policies will be named mows-core-secrets-vrc/namespace/policy_id
#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultEngineAccessPolicy {
    pub sub_policies: Vec<VaultEngineAccessPolicySubPolicy>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VaultEngineAccessPolicySubPolicy {
    pub engine_id: String,
    pub engine_type: VaultEngineAccessPolicyType,
    pub sub_path: String,
    pub capabilities: Vec<VaultPolicyCapability>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum VaultEngineAccessPolicyType {
    Auth,
    Secret,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "camelCase")]
pub enum VaultPolicyCapability {
    Read,
    Create,
    Update,
    Delete,
    List,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum VaultAuthEngine {
    Kubernetes(KubernetesAuthEngineParams),
    //Userpass(UserpassAuthEngineParams),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct KubernetesAuthEngineParams {
    pub roles: HashMap<String, KubernetesAuthEngineRole>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct KubernetesAuthEngineRole {
    pub service_account_name: String,
    pub namespace: Option<String>,
    /// The vault policy id to attach to the service account without namespace
    pub policy_ids: Vec<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
pub enum VaultSecretEngine {
    #[serde(rename = "kv-v2")]
    KV2(KV2SecretEngineParams),
    #[serde(rename = "transit")]
    Transit(TransitSecretEngineParams),
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransitSecretEngineParams {}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct KV2SecretEngineParams {
    pub kv_data: HashMap<String, HashMap<String, String>>,
}

pub async fn create_vault_client() -> Result<VaultClient, Error> {
    let mut client_builder = VaultClientSettingsBuilder::default();

    let config = get_current_config_cloned!();

    client_builder.address(config.vault_uri);

    let vc =
        VaultClient::new(client_builder.build().map_err(|_| {
            Error::GenericError("Failed to create vault client settings builder".to_string())
        })?)?;

    let service_account_jwt = std::fs::read_to_string(config.service_account_token_path)
        .context("Failed to read service account token")?;

    let vault_auth = vaultrs::auth::kubernetes::login(
        &vc,
        &config.vault_kubernetes_auth_path,
        &config.vault_kubernetes_auth_role,
        &service_account_jwt,
    )
    .await?;

    let vc = VaultClient::new(
        client_builder
            .token(&vault_auth.client_token)
            .build()
            .context("Failed to create vault client")?,
    )?;

    Ok(vc)
}

pub async fn reconcile_resource(
    vault_resource: &VaultResource,
    kube_client: &kube::Client,
) -> Result<(), Error> {
    let vc = create_vault_client().await?;

    let resource_namespace = vault_resource.metadata.namespace.as_deref().unwrap_or("default");

    let resource_name = match vault_resource.metadata.name.as_deref() {
        Some(v) => v,
        None => {
            return Err(Error::GenericError(
                "Failed to get resource name from VaultResource metadata".to_string(),
            ))
        }
    };

    match &vault_resource.spec {
        VaultResourceSpec::SecretEngine(vault_secret_engine) => {
            handle_secret_engine(&vc, resource_namespace, resource_name, vault_secret_engine).await?
        }
        VaultResourceSpec::AuthEngine(vault_auth_engine) => {
            handle_auth_engine(&vc, resource_namespace, resource_name, vault_auth_engine).await?
        }
        VaultResourceSpec::EngineAccessPolicy(vault_engine_access_policy) => {
            handle_engine_access_policy(&vc, resource_namespace, resource_name, vault_engine_access_policy)
                .await?
        }
        VaultResourceSpec::SecretSync(vault_secret_sync) => {
            let force_target_namespace_key = "vault.k8s.mows.cloud/force-target-namespace";
            let sudo_key = "k8s.mows.cloud/sudo";

            let mut target_namespace = resource_namespace;
            if let Some(labels) = &vault_resource.metadata.labels {
                if let Some(force_target_namespace_some) = labels.get(force_target_namespace_key) {
                    if let Some(sudo) = labels.get(sudo_key) {
                        if sudo == "true" {
                            target_namespace = force_target_namespace_some;
                        } else {
                            return Err(Error::GenericError(format!(
                                "The `{}` label is only allowed with `{}` label set to `true`",
                                force_target_namespace_key, sudo_key
                            )));
                        };
                    }
                };
            };
            handle_secret_sync(
                &vc,
                resource_namespace,
                resource_name,
                &target_namespace,
                vault_secret_sync,
                kube_client,
            )
            .await?
        }
    }

    Ok(())
}

/// The status object of `VaultResource`
#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
pub struct VaultResourceStatus {
    pub created: bool,
}

impl VaultResource {}

// Context for our reconciler
#[derive(Clone)]
pub struct Context {
    /// Kubernetes client
    pub client: Client,
    /// Diagnostics read by the web server
    pub diagnostics: Arc<RwLock<Diagnostics>>,
    /// Prometheus metrics
    pub metrics: Arc<Metrics>,
}

#[instrument(skip(ctx, vault_resource), fields(trace_id))]
async fn reconcile(vault_resource: Arc<VaultResource>, ctx: Arc<Context>) -> Result<Action> {
    let trace_id = telemetry::get_trace_id();
    if trace_id != opentelemetry::trace::TraceId::INVALID {
        Span::current().record("trace_id", field::display(&trace_id));
    }
    let _timer = ctx.metrics.reconcile.count_and_measure(&trace_id);
    ctx.diagnostics.write().await.last_event = Utc::now();
    let ns = vault_resource.namespace().unwrap(); // vault resources are namespace scoped
    let vault_resources: Api<VaultResource> = Api::namespaced(ctx.client.clone(), &ns);

    info!("Reconciling Document \"{}\" in {}", vault_resource.name_any(), ns);
    finalizer(&vault_resources, FINALIZER, vault_resource, |event| async {
        match event {
            Finalizer::Apply(doc) => doc.reconcile(ctx.clone()).await,
            Finalizer::Cleanup(doc) => doc.cleanup(ctx.clone()).await,
        }
    })
    .await
    .map_err(|e| Error::FinalizerError(Box::new(e)))
}

fn error_policy(vault_resource: Arc<VaultResource>, error: &Error, ctx: Arc<Context>) -> Action {
    warn!("reconcile failed: {:?}", error);
    ctx.metrics.reconcile.set_failure(&vault_resource, error);

    Action::requeue(Duration::from_secs(5 * 60))
}

impl VaultResource {
    // Reconcile (for non-finalizer related changes)
    async fn reconcile(&self, ctx: Arc<Context>) -> Result<Action> {
        let kube_client = ctx.client.clone();
        let recorder = ctx.diagnostics.read().await.recorder(kube_client.clone(), self);
        let ns = self.namespace().unwrap();
        let name = self.name_any();
        let vault_resources: Api<VaultResource> = Api::namespaced(kube_client.clone(), &ns);

        match reconcile_resource(self, &kube_client).await {
            Ok(_) => {
                info!("Reconcile successful");
                let new_status = Patch::Apply(json!({
                    "apiVersion": "vault.k8s.mows.cloud/v1",
                    "kind": "VaultResource",
                    "status": VaultResourceStatus {
                        created: true
                    }
                }));

                let ps = PatchParams::apply("cntrlr").force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(Error::KubeError)?;

                recorder
                    .publish(Event {
                        type_: EventType::Normal,
                        reason: "ObjectCreated".into(),
                        note: Some(format!("Object Created: `{name}`")),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(Error::KubeError)?;
            }
            Err(e) => {
                error!("Reconcile failed: {:?}", e);
                let new_status = Patch::Apply(json!({
                    "apiVersion": "vault.k8s.mows.cloud/v1",
                    "kind": "VaultResource",
                    "status": VaultResourceStatus {
                        created: false
                    }
                }));

                let ps = PatchParams::apply("cntrlr").force();
                let _o = vault_resources
                    .patch_status(&name, &ps, &new_status)
                    .await
                    .map_err(Error::KubeError)?;

                let reason = get_error_type(&e);

                recorder
                    .publish(Event {
                        type_: EventType::Warning,
                        reason,
                        note: Some(e.to_string()),
                        action: "CreateObject".into(),
                        secondary: None,
                    })
                    .await
                    .map_err(Error::KubeError)?;
                return Err(e);
            }
        }

        // If no events were received, check back every 5 minutes
        Ok(Action::requeue(Duration::from_secs(5 * 60)))
    }

    // Finalizer cleanup (the object was deleted, ensure nothing is orphaned)
    async fn cleanup(&self, ctx: Arc<Context>) -> Result<Action> {
        let recorder = ctx.diagnostics.read().await.recorder(ctx.client.clone(), self);
        // Document doesn't have any real cleanup, so we just publish an event
        recorder
            .publish(Event {
                type_: EventType::Normal,
                reason: "DeleteRequested".into(),
                note: Some(format!("Delete `{}`", self.name_any())),
                action: "Deleting".into(),
                secondary: None,
            })
            .await
            .map_err(Error::KubeError)?;
        Ok(Action::await_change())
    }
}

/// Diagnostics to be exposed by the web server
#[derive(Clone, Serialize)]
pub struct Diagnostics {
    #[serde(deserialize_with = "from_ts")]
    pub last_event: DateTime<Utc>,
    #[serde(skip)]
    pub reporter: Reporter,
}
impl Default for Diagnostics {
    fn default() -> Self {
        Self {
            last_event: Utc::now(),
            reporter: "vault-resource-controller".into(),
        }
    }
}
impl Diagnostics {
    fn recorder(&self, client: Client, doc: &VaultResource) -> Recorder {
        Recorder::new(client, self.reporter.clone(), doc.object_ref(&()))
    }
}

/// State shared between the controller and the web server
#[derive(Clone, Default)]
pub struct State {
    /// Diagnostics populated by the reconciler
    diagnostics: Arc<RwLock<Diagnostics>>,
    /// Metrics
    metrics: Arc<Metrics>,
}

/// State wrapper around the controller outputs for the web server
impl State {
    /// Metrics getter
    pub fn metrics(&self) -> String {
        let mut buffer = String::new();
        let registry = &*self.metrics.registry;
        prometheus_client::encoding::text::encode(&mut buffer, registry).unwrap();
        buffer
    }

    /// State getter
    pub async fn diagnostics(&self) -> Diagnostics {
        self.diagnostics.read().await.clone()
    }

    // Create a Controller Context that can update State
    pub fn to_context(&self, client: Client) -> Arc<Context> {
        Arc::new(Context {
            client,
            metrics: self.metrics.clone(),
            diagnostics: self.diagnostics.clone(),
        })
    }
}

/// Initialize the controller and shared state (given the crd is installed)
pub async fn run(state: State) {
    let client = Client::try_default().await.expect("failed to create kube Client");
    let docs = Api::<VaultResource>::all(client.clone());
    if let Err(e) = docs.list(&ListParams::default().limit(1)).await {
        error!("CRD is not queryable; {e:?}. Is the CRD installed?");
        info!("Installation: cargo run --bin crdgen | kubectl apply -f -");
        std::process::exit(1);
    }
    Controller::new(docs, Config::default().any_semantic())
        .shutdown_on_signal()
        .run(reconcile, error_policy, state.to_context(client))
        .filter_map(|x| async move { std::result::Result::ok(x) })
        .for_each(|_| futures::future::ready(()))
        .await;
}
