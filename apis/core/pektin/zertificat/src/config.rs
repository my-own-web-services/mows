use std::env;

use anyhow::bail;
use data_encoding::BASE64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub mode: String,
    pub url: String,
    pub password: String,
    pub username: String,
    pub pektin_auth: Pc3,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Pc3 {
    pub username: String,
    #[serde(rename = "confidantPassword")]
    pub confidant_password: String,
    #[serde(rename = "override")]
    pub override_params: OverrideParams,
    #[serde(rename = "perimeterAuth")]
    pub perimeter_auth: String,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OverrideParams {
    #[serde(rename = "pektinApiEndpoint")]
    pub pektin_api_endpoint: String,
}

pub fn get_config() -> anyhow::Result<Config> {
    let env = env::vars();
    let mut mode: Option<String> = None;
    let mut url: Option<String> = None;
    let mut username: Option<String> = None;
    let mut password: Option<String> = None;
    let mut pektin_auth_b64: Option<String> = None;

    for (k, v) in env {
        if k == "MODE" {
            mode = Some(v);
        } else if k == "URL" {
            url = Some(v);
        } else if k == "USERNAME" {
            username = Some(v);
        } else if k == "PASSWORD" {
            password = Some(v);
        } else if k == "PEKTIN_AUTH" {
            pektin_auth_b64 = Some(v);
        }
    }
    if url.is_none()
        || username.is_none()
        || password.is_none()
        || mode.is_none()
        || pektin_auth_b64.is_none()
    {
        bail!("MODE, URL, USERNAME and PASSWORD must be provided as environment variables");
    }

    let pektin_auth = BASE64.decode(pektin_auth_b64.unwrap().as_bytes())?;
    let pektin_auth: Pc3 = match serde_json::from_str(std::str::from_utf8(&pektin_auth)?) {
        Ok(v) => v,
        Err(e) => {
            bail!("failed to parse pektin auth: {:?} {}", pektin_auth, e);
        }
    };

    Ok(Config {
        mode: mode.unwrap(),
        url: url.unwrap(),
        username: username.unwrap(),
        password: password.unwrap(),
        pektin_auth,
    })
}
