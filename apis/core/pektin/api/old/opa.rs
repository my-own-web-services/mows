use crate::PektinApiError;
use crate::PektinApiResult;

use reqwest::{
    self,
    header::{HeaderMap, HeaderValue, CONTENT_TYPE},
};
use serde::{Deserialize, Serialize};
use std::{net::Ipv6Addr, time::Duration};

pub type OpaResult<T> = Result<T, PektinApiError>;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OpaRequestWrapper {
    input: OpaRequestData,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OpaRequestData {
    pub api_method: String,
    pub ip: Ipv6Addr,
    pub utc_millis: u128,
    pub user_agent: String,
    pub rr_sets: Vec<OpaRequestResourceRecord>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OpaRequestResourceRecord {
    pub name: String,
    pub rr_type: String,
    pub ttl: u64, //TODO is it u64?
    pub values: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct OpaResultWrapper {
    result: OpaResponseData,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OpaResponseData {
    pub return_policy_results: Option<bool>,
    pub api_method: bool,
    pub ip: bool,
    pub utc_millis: bool,
    pub user_agent: bool,
    pub rr_sets: Vec<OpaResponseResourceRecord>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OpaResponseResourceRecord {
    pub name: bool,
    pub rr_type: bool,
    pub ttl: bool,
    pub values: bool,
}

pub async fn evaluate(
    opa_uri: &str,
    policy: String,
    to_be_evaluated: OpaRequestData,
) -> OpaResult<OpaResponseData> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/plain"));

    // TODO reuse reqwest::Client

    let create_policy: u16 = reqwest::Client::new()
        .put(format!("{}{}", opa_uri, "/v1/policies/pear_policy"))
        .timeout(Duration::from_secs(2))
        .headers(headers)
        .body(policy)
        .send()
        .await?
        .status()
        .as_u16();

    if create_policy != 200 {
        return Err(PektinApiError::OpaError);
    }

    let eval_response: OpaResultWrapper = reqwest::Client::new()
        .post(format!("{}{}", opa_uri, "/v1/data/pear_policy"))
        .timeout(Duration::from_secs(2))
        .json::<OpaRequestWrapper>(&OpaRequestWrapper {
            input: to_be_evaluated,
        })
        .send()
        .await?
        .json()
        .await?;

    Ok(eval_response.result)
}

pub async fn check_policy(opa_uri: String, policy: String) -> OpaResult<OpaResponseData> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("text/plain"));

    // TODO reuse reqwest::Client

    let create_policy = reqwest::Client::new()
        .put(format!("{}{}", opa_uri, "/v1/policies/check_pear_policy"))
        .timeout(Duration::from_secs(2))
        .headers(headers)
        .body(policy.replace("pear_policy", "check_pear_policy"))
        .send()
        .await?
        .json()
        .await?;

    Ok(create_policy)
}

pub async fn get_health(uri: String) -> u16 {
    let res = reqwest::Client::new()
        .get(format!("{}{}", uri, "/health"))
        .timeout(Duration::from_secs(2))
        .send()
        .await;

    res.map(|r| r.status().as_u16()).unwrap_or(0)
}
