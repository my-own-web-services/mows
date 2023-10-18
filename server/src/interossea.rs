use crate::{
    config::{InterosseaConfig, SERVER_CONFIG},
    some_or_bail,
    utils::{generate_id, get_cookies, is_allowed_origin, is_allowed_service_id},
};
use anyhow::bail;
use hyper::{Body, Request, Response};
use jsonwebtoken::{decode, DecodingKey, Validation};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;

pub static INTEROSSEA: OnceCell<Interossea> = OnceCell::new();

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserAssertion {
    pub iat: i64,
    pub exp: i64,
    pub user_id: String,
    pub service_id: String,
    pub client_ip: String,
    pub service_origin: String,
    pub ir_admin: bool,
    pub ir_email: String,
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

    // using sessions instead of sending the JWT every time saves bandwidth time and processing resources
    pub async fn get_user_assertion_from_header(
        &self,
        req: &Request<Body>,
        addr: SocketAddr,
    ) -> anyhow::Result<UserAssertion> {
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

        if &self.assertion_validity_seconds * 1000 + token_created_time < current_time {
            bail!("Assertion expired");
        }

        if validated_token.claims.client_ip != ip {
            bail!(
                "Assertion IP mismatch: {} != {}",
                validated_token.claims.client_ip,
                ip
            );
        }

        is_allowed_origin(&validated_token.claims.service_origin)?;

        is_allowed_service_id(&validated_token.claims.service_id)?;

        Ok(validated_token.claims)
    }

    pub async fn get_user_assertion_from_session(
        &self,
        req: &Request<Body>,
        addr: SocketAddr,
        session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
    ) -> anyhow::Result<UserAssertion> {
        let cookies = get_cookies(req)?;
        let session = some_or_bail!(cookies.get("session"), "No session cookie found");

        let validated_assertion_claims = some_or_bail!(
            session_map.read().await.get(session).cloned(),
            "Session not found in map"
        );

        let current_time = chrono::offset::Utc::now().timestamp_millis();
        let token_created_time = validated_assertion_claims.iat;
        let ip = addr.ip().to_string();

        if &self.assertion_validity_seconds * 1000 + token_created_time < current_time {
            bail!("Assertion expired");
        }

        if validated_assertion_claims.client_ip != ip {
            bail!("Assertion IP mismatch");
        }

        is_allowed_origin(&validated_assertion_claims.service_origin)?;

        Ok(validated_assertion_claims)
    }

    pub async fn get_decoding_key(&self) -> anyhow::Result<DecodingKey> {
        get_decoding_key(&self.interossea_addr).await
    }
}

pub async fn get_decoding_key(interossea_addr: &str) -> anyhow::Result<DecodingKey> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/get_public_key/", interossea_addr))
        .send()
        .await?;
    let text = res.text().await?;
    Ok(DecodingKey::from_rsa_pem(text.as_bytes())?)
}

pub async fn get_session_cookie(
    req: &Request<Body>,
    session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
    addr: SocketAddr,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let new_session_id = generate_id(32);

    let ua = INTEROSSEA
        .get()
        .unwrap()
        .get_user_assertion_from_header(req, addr)
        .await?;

    session_map.write().await.insert(new_session_id.clone(), ua);

    let session_cookie = cookie::Cookie::build("session", &new_session_id)
        .path("/")
        .secure(true)
        .max_age(cookie::time::Duration::seconds(
            SERVER_CONFIG.interossea.assertion_validity_seconds as i64,
        ))
        .http_only(true)
        .same_site(cookie::SameSite::None)
        .finish();

    Ok(res
        .status(200)
        .header("Set-Cookie", session_cookie.to_string())
        .body(Body::from("OK"))
        .unwrap())
}
