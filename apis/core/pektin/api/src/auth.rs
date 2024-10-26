use std::time::{SystemTime, UNIX_EPOCH};

use actix_web::HttpRequest;
use tracing::{debug, instrument};

use crate::{
    macros::return_if_err,
    ribston::{self, RibstonRequestData},
    types::{AppState, AuthAnswer, RequestBody},
    vault,
};

#[instrument(skip(
    vault_endpoint,
    vault_api_pw,
    vault_user_name,
    ribston_endpoint,
    confidant_password,
    ribston_request_data
))]
pub async fn auth(
    vault_endpoint: &str,
    vault_api_pw: &str,
    vault_user_name: &str,
    ribston_endpoint: &str,
    client_username: &str,
    confidant_password: &str,
    ribston_request_data: RibstonRequestData,
) -> AuthAnswer {
    // TODO reuse reqwest::Client, caching, await concurrently where possible

    // cache until restart
    // transparently renew it if it's expired
    let api_token = return_if_err!(
        vault::ApiTokenCache::get(vault_endpoint, vault_user_name, vault_api_pw).await,
        err,
        format!("Could not get Vault token for pektin-api: {}", err)
    );

    /*
    struct ClientCache {
        // evict after 10min
        confidant_token: Option<(Instant, String)>,
        client_policy: String,
        policy_results: HashMap<Request, RibstonResponseData>,
    }
    */

    // cache for some amount of time (10min-30min)
    // if we want to cache this we will have to check the validity of the clients password ourselves
    // keeping a hash of the clients password in memory to check against
    let confidant_token = return_if_err!(
        vault::ClientTokenCache::get(
            vault_endpoint,
            &format!("pektin-client-{}-confidant", client_username),
            confidant_password
        )
        .await,
        err,
        format!("Could not get Vault token for confidant: {}", err)
    );

    // cache until restart
    let client_policy = return_if_err!(
        vault::get_policy(vault_endpoint, &api_token, client_username).await,
        err,
        format!("Could not get client policy: {}", err)
    );

    if client_policy.contains("@skip-policy-check") {
        return AuthAnswer {
            success: true,
            message: "Skipped evaluating policy".into(),
        };
    }

    let ribston_answer = return_if_err!(
        ribston::evaluate(ribston_endpoint, &client_policy, ribston_request_data).await,
        err,
        format!("Could not evaluate client policy: {}", err)
    );

    AuthAnswer {
        success: ribston_answer.status == "SUCCESS" && ribston_answer.data.status == "SUCCESS",
        message: if ribston_answer.status == "SUCCESS" {
            format!(
                "Ribston policy evaluation returned: {}",
                ribston_answer.data.message
            )
        } else {
            ribston_answer.message
        },
    }
}

#[instrument(skip(req, request_body, state, confidant_password))]
pub async fn auth_ok(
    req: &HttpRequest,
    request_body: RequestBody,
    state: &AppState,
    client_username: &str,
    confidant_password: &str,
) -> AuthAnswer {
    if "yes, I really want to disable authentication" == state.skip_auth {
        debug!("Skipping authentication");
        return AuthAnswer {
            success: true,
            message: "Skipped authentication because SKIP_AUTH is set".into(),
        };
    }

    let start = SystemTime::now();
    let utc_millis = start
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    let api_method = match request_body {
        RequestBody::Get { .. } => "get",
        RequestBody::GetZoneRecords { .. } => "get-zone-records",
        RequestBody::Set { .. } => "set",
        RequestBody::Delete { .. } => "delete",
        RequestBody::Search { .. } => "search",
        RequestBody::Health => "health",
    }
    .into();

    // somewhere in here a RefCell is involved. if we don't store it in this variable before the
    // auth call, clippy warns that the RefCell is held across an await point
    let ip = req
        .connection_info()
        .realip_remote_addr()
        .map(|s| s.to_string());
    let res = auth(
        &state.vault_uri,
        &state.vault_password,
        &state.vault_user_name,
        &state.ribston_uri,
        client_username,
        confidant_password,
        RibstonRequestData {
            api_method,
            ip,
            // TODO user agent
            user_agent: "TODO user agent".into(),
            utc_millis,
            request_body,
        },
    )
    .await;

    debug!("Authentication result: {:?}", res);
    res
}
