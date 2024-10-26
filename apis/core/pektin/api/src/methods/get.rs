use std::ops::Deref;

use actix_web::{post, web, HttpRequest, Responder};
use serde_json::json;
use tracing::{info_span, Instrument};

use crate::{
    auth::auth_ok,
    db::get_or_mget_records,
    errors_and_responses::{
        auth_err, internal_err, partial_success_with_data, success_with_toplevel_data,
    },
    types::{AppState, GetRequestBody, RecordIdentifier, ResponseType},
};

#[post("/get")]
pub async fn get(
    req: HttpRequest,
    req_body: web::Json<GetRequestBody>,
    state: web::Data<AppState>,
) -> impl Responder {
    let span =
        info_span!("get", client_username = %req_body.client_username, records = ?req_body.records);
    async move {
        let mut auth = auth_ok(
            &req,
            req_body.clone().into(),
            state.deref(),
            &req_body.client_username,
            &req_body.confidant_password,
        )
        .await;

        if auth.success {
            if req_body.records.is_empty() {
                return success_with_toplevel_data("got records", json!([]));
            }

            let mut con = match state.db_pool.get().await {
                Ok(c) => c,
                Err(_) => return internal_err("No db connection."),
            };

            let record_keys: Vec<_> = req_body
                .records
                .iter()
                .map(RecordIdentifier::db_key)
                .collect();

            match get_or_mget_records(&record_keys, &mut con).await {
                Ok(records) => {
                    let messages: Vec<_> = records
                        .into_iter()
                        .map(|entry| match entry {
                            Some(e) => (ResponseType::Success, "record found", Some(e)),
                            None => (ResponseType::Error, "no record found", None),
                        })
                        .collect();
                    let all_success = messages.iter().all(|(t, _, _)| *t == ResponseType::Success);
                    let all_error = messages.iter().all(|(t, _, _)| *t == ResponseType::Error);
                    let toplevel_response_type = match (all_success, all_error) {
                        (true, false) => ResponseType::Success,
                        (false, true) => ResponseType::Error,
                        (false, false) => ResponseType::PartialSuccess,
                        (true, true) => unreachable!(),
                    };
                    let toplevel_message = match toplevel_response_type {
                        ResponseType::Success => "got records",
                        ResponseType::PartialSuccess => "couldn't get all records",
                        ResponseType::Error => "couldn't get records",
                        ResponseType::Ignored => unreachable!(),
                    };
                    partial_success_with_data(toplevel_response_type, toplevel_message, messages)
                }
                Err(e) => internal_err(e.to_string()),
            }
        } else {
            auth.message.push('\n');
            auth_err(auth.message)
        }
    }
    .instrument(span)
    .await
}
