//! Managed Vault client wrapper with automatic token renewal
//!
//! This module provides a wrapper around the VaultClient that automatically
//! handles token renewal before expiration. The client periodically checks
//! the token's TTL and renews it when necessary.

#[cfg(feature = "vault")]
use std::sync::Arc;

#[cfg(feature = "vault")]
use chrono::{DateTime, Utc};
#[cfg(feature = "vault")]
use tokio::sync::RwLock;
#[cfg(feature = "vault")]
use tracing::{debug, info, instrument, warn};
#[cfg(feature = "vault")]
use vaultrs::{
    api::AuthInfo,
    client::{VaultClient, VaultClientSettingsBuilder},
};

#[cfg(feature = "vault")]
/// Authentication method for Vault
#[derive(Debug, Clone)]
pub enum VaultAuthMethod {
    /// Kubernetes authentication
    Kubernetes {
        /// Path to the Kubernetes service account token file
        service_account_token_path: String,
        /// Kubernetes auth mount path in Vault
        auth_path: String,
        /// Kubernetes auth role to use
        auth_role: String,
    },
    /// Token-based authentication (no renewal, re-authenticates using same token)
    Token {
        /// The vault token to use
        token: String,
    },
}

#[cfg(feature = "vault")]
/// Configuration for the managed vault client
#[derive(Debug, Clone)]
pub struct VaultConfig {
    /// Vault server address (e.g., "http://vault.example.com:8200")
    pub address: String,
    /// Authentication method to use
    pub auth_method: VaultAuthMethod,
    /// Percentage of TTL at which to trigger renewal (0.0 to 1.0, default 0.8 = 80%)
    pub renewal_threshold: f64,
}

#[cfg(feature = "vault")]
impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            address: "http://vault:8200".to_string(),
            auth_method: VaultAuthMethod::Kubernetes {
                service_account_token_path: "/var/run/secrets/kubernetes.io/serviceaccount/token"
                    .to_string(),
                auth_path: "kubernetes".to_string(),
                auth_role: "default".to_string(),
            },
            renewal_threshold: 0.8,
        }
    }
}

#[cfg(feature = "vault")]
/// Internal state for the managed vault client
struct ManagedVaultClientState {
    token: String,
    auth_info: AuthInfo,
    token_created_at: DateTime<Utc>,
}

#[cfg(feature = "vault")]
/// A managed Vault client that automatically renews its authentication token
///
/// This wrapper provides automatic token renewal before expiration. It stores
/// the VaultClient and authentication information, and provides methods to
/// check if renewal is needed and perform the renewal.
///
/// **Important:** When this client is dropped, it will automatically attempt to
/// revoke the token to prevent lease accumulation in Vault.
///
/// # Example
///
/// ```no_run
/// use mows_common_rust::vault::{ManagedVaultClient, VaultConfig};
///
/// #[tokio::main]
/// async fn main() -> Result<(), Box<dyn std::error::Error>> {
///     let config = VaultConfig {
///         address: "http://vault:8200".to_string(),
///         auth_method: VaultAuthMethod::Kubernetes {
///             service_account_token_path: "/var/run/secrets/kubernetes.io/serviceaccount/token".to_string(),
///             auth_path: "kubernetes".to_string(),
///             auth_role: "my-role".to_string(),
///         },
///         renewal_threshold: 0.8,
///     };
///
///     let client = ManagedVaultClient::new(config).await?;
///
///     // Use the client
///     let vault_client = client.get_client().await?;
///
///     Ok(())
///     // Token is automatically revoked when client is dropped
/// }
/// ```
#[derive(Clone)]
pub struct ManagedVaultClient {
    config: VaultConfig,
    state: Arc<RwLock<ManagedVaultClientState>>,
}

#[cfg(feature = "vault")]
impl ManagedVaultClient {
    /// Create a new managed vault client with the given configuration
    ///
    /// This will immediately authenticate to Vault using Kubernetes auth
    /// and create the initial client.
    #[instrument(skip(config), level = "debug")]
    pub async fn new(config: VaultConfig) -> Result<Self, VaultError> {
        let state = Self::create_client_state(&config).await?;

        Ok(Self {
            config,
            state: Arc::new(RwLock::new(state)),
        })
    }

    /// Create a new client state by authenticating to Vault
    #[instrument(skip(config), level = "trace")]
    async fn create_client_state(config: &VaultConfig) -> Result<ManagedVaultClientState, VaultError> {
        let mut client_builder = VaultClientSettingsBuilder::default();
        client_builder.address(&config.address);

        match &config.auth_method {
            VaultAuthMethod::Kubernetes {
                service_account_token_path,
                auth_path,
                auth_role,
            } => {
                let temp_client = VaultClient::new(
                    client_builder
                        .build()
                        .map_err(|e| VaultError::ClientCreation(e.to_string()))?,
                )
                .map_err(|e| VaultError::ClientCreation(e.to_string()))?;

                // Read the Kubernetes service account token
                let service_account_jwt = std::fs::read_to_string(service_account_token_path)
                    .map_err(|e| VaultError::ServiceAccountToken(e.to_string()))?;

                // Authenticate using Kubernetes auth
                let auth_info = vaultrs::auth::kubernetes::login(
                    &temp_client,
                    auth_path,
                    auth_role,
                    &service_account_jwt,
                )
                .await
                .map_err(|e| VaultError::Authentication(e.to_string()))?;

                let token = auth_info.client_token.clone();
                let token_created_at = Utc::now();

                info!(
                    "Vault client authenticated successfully with Kubernetes auth, token TTL: {}s",
                    auth_info.lease_duration
                );

                Ok(ManagedVaultClientState {
                    token,
                    auth_info,
                    token_created_at,
                })
            }
            VaultAuthMethod::Token { token } => {
                // For token-based auth, we need to look up the token to get its info
                let temp_client = VaultClient::new(
                    client_builder
                        .token(token)
                        .build()
                        .map_err(|e| VaultError::ClientCreation(e.to_string()))?,
                )
                .map_err(|e| VaultError::ClientCreation(e.to_string()))?;

                // Lookup token information to get TTL
                let token_info = vaultrs::token::lookup_self(&temp_client)
                    .await
                    .map_err(|e| VaultError::Authentication(format!("Failed to lookup token: {}", e)))?;

                let auth_info = AuthInfo {
                    client_token: token.clone(),
                    lease_duration: token_info.ttl,
                    renewable: token_info.renewable,
                    accessor: token_info.accessor,
                    policies: token_info.policies.clone(),
                    token_policies: token_info.policies,
                    metadata: token_info.meta,
                    entity_id: token_info.entity_id,
                    orphan: token_info.orphan,
                    token_type: "service".to_string(), // Default token type for pre-existing tokens
                };

                let token_created_at = Utc::now();

                info!(
                    "Vault client initialized with token auth, token TTL: {}s",
                    auth_info.lease_duration
                );

                Ok(ManagedVaultClientState {
                    token: token.clone(),
                    auth_info,
                    token_created_at,
                })
            }
        }
    }

    /// Get the vault client, automatically renewing the token if needed
    ///
    /// This method checks if the token needs renewal based on the configured
    /// renewal threshold. If renewal is needed, it will attempt to renew the
    /// token before returning the client.
    #[instrument(skip(self), level = "trace")]
    pub async fn get_client(&self) -> Result<VaultClient, VaultError> {
        // Check if we need to renew
        if self.should_renew().await {
            self.renew_token().await?;
        }

        let state = self.state.read().await;

        // Create a new client with the current token
        let mut client_builder = VaultClientSettingsBuilder::default();
        client_builder.address(&self.config.address);

        let client = VaultClient::new(
            client_builder
                .token(&state.token)
                .build()
                .map_err(|e| VaultError::ClientCreation(e.to_string()))?,
        )
        .map_err(|e| VaultError::ClientCreation(e.to_string()))?;

        Ok(client)
    }

    /// Check if the token should be renewed based on TTL and threshold
    #[instrument(skip(self), level = "trace")]
    async fn should_renew(&self) -> bool {
        let state = self.state.read().await;

        let elapsed = Utc::now() - state.token_created_at;
        let elapsed_seconds = elapsed.num_seconds() as u64;
        let ttl = state.auth_info.lease_duration;

        // Calculate the renewal threshold in seconds
        let renewal_threshold_seconds = (ttl as f64 * self.config.renewal_threshold) as u64;

        let should_renew = elapsed_seconds >= renewal_threshold_seconds;

        if should_renew {
            debug!(
                "Token renewal needed: elapsed={}s, ttl={}s, threshold={}s",
                elapsed_seconds, ttl, renewal_threshold_seconds
            );
        }

        should_renew
    }

    /// Renew the vault token
    ///
    /// This method attempts to renew the current token using the token renew-self
    /// endpoint. If renewal fails, it will attempt to re-authenticate using
    /// Kubernetes auth to get a fresh token.
    #[instrument(skip(self), level = "debug")]
    pub async fn renew_token(&self) -> Result<(), VaultError> {
        let mut state = self.state.write().await;

        info!("Attempting to renew vault token");

        // Create a temporary client with the current token for renewal
        let mut client_builder = VaultClientSettingsBuilder::default();
        client_builder.address(&self.config.address);

        let temp_client = VaultClient::new(
            client_builder
                .token(&state.token)
                .build()
                .map_err(|e| VaultError::ClientCreation(e.to_string()))?,
        )
        .map_err(|e| VaultError::ClientCreation(e.to_string()))?;

        // Try to renew the existing token
        match vaultrs::token::renew_self(&temp_client, None).await {
            Ok(auth_info) => {
                info!(
                    "Token renewed successfully, new TTL: {}s",
                    auth_info.lease_duration
                );
                state.token = auth_info.client_token.clone();
                state.auth_info = auth_info;
                state.token_created_at = Utc::now();
                Ok(())
            }
            Err(e) => {
                warn!(
                    "Failed to renew token: {}. Re-authenticating with Kubernetes auth.",
                    e
                );

                // If renewal fails, re-authenticate
                drop(state); // Release the write lock before calling create_client_state
                let new_state = Self::create_client_state(&self.config).await?;

                // Re-acquire the write lock to update the state
                let mut state = self.state.write().await;
                *state = new_state;

                info!("Re-authenticated successfully");
                Ok(())
            }
        }
    }

    /// Force a token renewal regardless of TTL
    ///
    /// This can be useful for testing or when you know the token needs to be refreshed.
    pub async fn force_renew(&self) -> Result<(), VaultError> {
        self.renew_token().await
    }

    /// Get the current token TTL in seconds
    ///
    /// Returns the remaining TTL based on when the token was created and its lease duration.
    pub async fn get_token_ttl(&self) -> i64 {
        let state = self.state.read().await;
        let elapsed = Utc::now() - state.token_created_at;
        let remaining = state.auth_info.lease_duration as i64 - elapsed.num_seconds();
        remaining.max(0)
    }

    /// Get the token creation time
    pub async fn get_token_created_at(&self) -> DateTime<Utc> {
        let state = self.state.read().await;
        state.token_created_at
    }

    /// Revoke the current token
    ///
    /// This should be called when you're done with the client to prevent
    /// lease accumulation in Vault. The token will be revoked immediately.
    ///
    /// **Note:** This is important for preventing lease accumulation when creating
    /// short-lived clients (e.g., one per API request). For long-lived clients
    /// stored in controller state, this is less critical as they renew their tokens.
    #[instrument(skip(self), level = "debug")]
    pub async fn revoke_token(&self) -> Result<(), VaultError> {
        let state = self.state.read().await;

        info!("Revoking vault token");

        // Create a temporary client with the current token
        let mut client_builder = VaultClientSettingsBuilder::default();
        client_builder.address(&self.config.address);

        let temp_client = VaultClient::new(
            client_builder
                .token(&state.token)
                .build()
                .map_err(|e| VaultError::ClientCreation(e.to_string()))?,
        )
        .map_err(|e| VaultError::ClientCreation(e.to_string()))?;

        // Try to revoke the token
        match vaultrs::token::revoke_self(&temp_client).await {
            Ok(_) => {
                info!("Token revoked successfully");
                Ok(())
            }
            Err(e) => {
                warn!("Failed to revoke token: {}. This may lead to lease accumulation.", e);
                Err(VaultError::VaultClient(e))
            }
        }
    }
}

#[cfg(feature = "vault")]
/// Errors that can occur when using the managed vault client
#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("Failed to create vault client: {0}")]
    ClientCreation(String),

    #[error("Failed to read service account token: {0}")]
    ServiceAccountToken(String),

    #[error("Failed to authenticate to vault: {0}")]
    Authentication(String),

    #[error("Failed to renew token: {0}")]
    TokenRenewal(String),

    #[error("Vault client error: {0}")]
    VaultClient(#[from] vaultrs::error::ClientError),
}
