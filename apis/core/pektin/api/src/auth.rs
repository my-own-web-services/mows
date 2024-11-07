use crate::{
    get_current_config_cloned,
    macros::return_if_err,
    ribston::{self, RibstonRequestData},
    types::{AppState, AuthAnswer, RequestBody},
    vault::create_vault_client_with_token,
};
use actix_web::HttpRequest;
use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};
use tracing::{debug, instrument};

#[instrument(skip(ribston_endpoint, client_token, ribston_request_data))]
pub async fn auth(
    ribston_endpoint: &str,
    client_username: &str,
    client_token: &str,
    ribston_request_data: RibstonRequestData,
) -> AuthAnswer {
    let api_config = get_current_config_cloned!();
    // TODO reuse reqwest::Client, caching, await concurrently where possible

    // cache until restart
    // transparently renew it if it's expired

    debug!("Creating Vault client with client token: {}", client_token);

    let vc = return_if_err!(
        create_vault_client_with_token(client_token).await,
        err,
        format!("Could not create Vault client: {}", err)
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

    // cache until restart
    let client_policy: HashMap<String, String> = return_if_err!(
        vaultrs::kv2::read(&vc, &api_config.policy_vault_path, client_username).await,
        err,
        format!("Could not get client policy from vault: {}", err)
    );

    let client_policy = return_if_err!(
        client_policy
            .get("ribston-policy")
            .cloned()
            .ok_or("No policy found"),
        err,
        format!("Could not get client policy from vault response: {}", err)
    );

    if let Some(first_line) = client_policy.lines().next() {
        if first_line.contains("@skip-policy-check") {
            return AuthAnswer {
                success: true,
                message: "Skipped evaluating policy".into(),
            };
        }
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

#[instrument(skip(req, request_body, state, client_token))]
pub async fn auth_ok(
    req: &HttpRequest,
    request_body: RequestBody,
    state: &AppState,
    client_username: &str,
    client_token: &str,
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
        &state.ribston_uri,
        client_username,
        client_token,
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
