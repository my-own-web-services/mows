use openidconnect::reqwest::async_http_client;
use openidconnect::{
    core::{
        CoreAuthDisplay, CoreClaimName, CoreClaimType, CoreClientAuthMethod, CoreGrantType,
        CoreJsonWebKey, CoreJsonWebKeyType, CoreJsonWebKeyUse, CoreJweContentEncryptionAlgorithm,
        CoreJweKeyManagementAlgorithm, CoreJwsSigningAlgorithm, CoreResponseMode, CoreResponseType,
        CoreSubjectIdentifierType,
    },
    url, AdditionalProviderMetadata, IntrospectionUrl, IssuerUrl, ProviderMetadata, RevocationUrl,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum DiscoveryError {
    #[error(transparent)]
    IssuerUrl(#[from] url::ParseError),

    #[error("Discovery document could not be fetched or parsed {0}")]
    DiscoveryDocument(String),
}

/// Fetch the well-known [OIDC Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html)
/// document of a given `authority`. "Authority" is a synonym for "Issuer" and vice versa.
/// The discovery document contains information about various OIDC endpoints of the ZITADEL
/// instance. Note that the authority (issuer) must not contain the well-known url part
/// (`/.well-known/openid-configuration`).
///
/// The returned [metadata](ZitadelProviderMetadata) contains the parsed information of the
/// well-known OIDC configuration.
///
/// ### Errors
///
/// This method may fail if:
/// - The authority url cannot be parsed correctly
/// - The discovery call throws any kind of error
///
/// ### Example
///
/// #### Fetch the discovery document of the "ZITADEL Libraries" - Test Instance
///
/// ```
/// # #[tokio::main]
/// # async fn main() -> Result<(), Box<dyn std::error::Error>>{
/// use zitadel::oidc::discovery::discover;
/// let authority = "https://zitadel-libraries-l8boqa.zitadel.cloud";
/// let metadata = discover(authority).await?;
/// println!("{:?}", metadata.token_endpoint());
/// # Ok(())
/// # }
/// ```
pub async fn discover(authority: &str) -> Result<ZitadelProviderMetadata, DiscoveryError> {
    let issuer = IssuerUrl::new(authority.to_string())?;
    ZitadelProviderMetadata::discover_async(issuer, async_http_client)
        .await
        .map_err(|e| DiscoveryError::DiscoveryDocument(e.to_string()))
}

/// Definition of additional metadata that is not present in the
/// standard metadata of the openidconnect crate.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ZitadelAdditionalMetadata {
    pub introspection_endpoint: Option<IntrospectionUrl>,
    pub revocation_endpoint: Option<RevocationUrl>,
}

impl AdditionalProviderMetadata for ZitadelAdditionalMetadata {}

/// Type to the ZITADEL provider metadata. Essentially combines
/// the [ZitadelAdditionalMetadata] with the openid provider
/// metadata information.
pub type ZitadelProviderMetadata = ProviderMetadata<
    ZitadelAdditionalMetadata,
    CoreAuthDisplay,
    CoreClientAuthMethod,
    CoreClaimName,
    CoreClaimType,
    CoreGrantType,
    CoreJweContentEncryptionAlgorithm,
    CoreJweKeyManagementAlgorithm,
    CoreJwsSigningAlgorithm,
    CoreJsonWebKeyType,
    CoreJsonWebKeyUse,
    CoreJsonWebKey,
    CoreResponseMode,
    CoreResponseType,
    CoreSubjectIdentifierType,
>;
