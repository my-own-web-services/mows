use crate::{
    config::{InterosseaConfig, SERVER_CONFIG},
    some_or_bail,
};
use anyhow::bail;
use hyper::{Body, Request};
use jsonwebtoken::{decode, DecodingKey, Validation};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

pub static INTEROSSEA: OnceCell<Interossea> = OnceCell::new();

#[derive(Deserialize, Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserAssertion {
    pub iat: i64,
    pub exp: i64,
    pub user_id: String,
    pub service_id: String,
    pub client_ip: String,
    pub service_origin: String,
}

#[derive(Clone)]
pub struct Interossea {
    pub interossea_addr: String,
    pub assertion_validity_seconds: i64,
    pub decoding_key: DecodingKey,
}

impl Interossea {
    pub async fn new(interossea_config: &InterosseaConfig) -> anyhow::Result<Interossea> {
        Ok(Interossea {
            interossea_addr: interossea_config.url.to_string(),
            decoding_key: get_decoding_key(&interossea_config.url).await?,
            assertion_validity_seconds: interossea_config.assertion_validity_seconds as i64,
        })
    }

    pub async fn check_user_assertion(
        &self,
        req: &Request<Body>,
        addr: SocketAddr,
    ) -> anyhow::Result<UserAssertion> {
        let config = &SERVER_CONFIG;
        let authorization_header = some_or_bail!(
            req.headers().get("InterosseaUserAssertion"),
            "No UserAssertion header"
        )
        .to_str()?;

        let validated_token = decode::<UserAssertion>(
            authorization_header,
            &self.decoding_key,
            &Validation::new(jsonwebtoken::Algorithm::RS256),
        )?;

        let current_time = chrono::offset::Utc::now().timestamp_millis();
        let token_created_time = validated_token.claims.iat;
        let ip = addr.ip().to_string();
        let host = some_or_bail!(req.headers().get("host"), "No host header found").to_str()?;

        if &self.assertion_validity_seconds * 1000 + token_created_time < current_time {
            bail!("Assertion expired");
        }

        if validated_token.claims.client_ip != ip {
            bail!("Assertion IP mismatch");
        }

        if validated_token
            .claims
            .service_origin
            .replacen("http://", "", 1)
            .replacen("https://", "", 1)
            != host
        {
            bail!(
                "Assertion host mismatch: {} != {}",
                validated_token.claims.service_origin,
                host
            );
        }

        if validated_token.claims.service_id != config.service_id {
            bail!("Assertion service ID mismatch");
        }

        Ok(validated_token.claims)
    }

    pub async fn get_decoding_key(&self) -> anyhow::Result<DecodingKey> {
        get_decoding_key(&self.interossea_addr).await
    }
}

pub async fn get_decoding_key(interossea_addr: &str) -> anyhow::Result<DecodingKey> {
    let res = reqwest::get(format!("{}/api/get_public_key/", interossea_addr)).await?;
    let text = res.text().await?;
    Ok(DecodingKey::from_rsa_pem(text.as_bytes())?)
}
