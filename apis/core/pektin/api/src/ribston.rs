use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use tracing::instrument;

use crate::errors_and_responses::PektinApiError;
use crate::types::RequestBody;

pub type RibstonResult<T> = Result<T, PektinApiError>;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RibstonRequestWrapper {
    policy: String,
    input: RibstonRequestData,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RibstonRequestData {
    pub api_method: String,
    pub ip: Option<String>,
    pub utc_millis: u128,
    pub user_agent: String,
    pub request_body: RequestBody,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct RibstonResultWrapper {
    result: RibstonResponseData,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RibstonResponseData {
    pub status: String,
    pub message: String,
    pub data: RibstonReponseEvalData,
}
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RibstonReponseEvalData {
    pub status: String,
    pub message: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RibstonResponseResourceRecord {
    pub name: bool,
    pub rr_set: bool,
}

#[instrument(skip(ribston_uri, to_be_evaluated))]
pub async fn evaluate(
    ribston_uri: &str,
    policy: &str,
    to_be_evaluated: RibstonRequestData,
) -> RibstonResult<RibstonResponseData> {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    // TODO reuse reqwest::Client

    let eval_response = reqwest::Client::new()
        .post(format!("{}{}", ribston_uri, "/eval"))
        .timeout(Duration::from_secs(2))
        .headers(headers)
        .json::<RibstonRequestWrapper>(&RibstonRequestWrapper {
            policy: policy.to_string(),
            input: to_be_evaluated.clone(),
        })
        .send()
        .await?;

    let status = eval_response.status();
    let res_text = eval_response.text().await?;
    dbg!(&res_text);
    dbg!(&status);
    //dbg!(to_be_evaluated);
    if status == 200 {
        let data: RibstonResponseData =
            serde_json::from_str(&res_text).map_err(|_| PektinApiError::Ribston)?;
        Ok(data)
    } else {
        Err(PektinApiError::Ribston)
    }
}

#[instrument(skip(uri))]
pub async fn get_health(uri: &str) -> u16 {
    let res = reqwest::Client::new()
        .get(format!("{}{}", uri, "/health"))
        .timeout(Duration::from_secs(2))
        .send()
        .await;

    res.map(|r| r.status().as_u16()).unwrap_or(0)
}
