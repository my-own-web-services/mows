use std::ops::Deref;

use actix_web::{post, web, HttpRequest, Responder};
use serde_json::json;
use tracing::{info_span, Instrument};

use crate::{
    auth::auth_ok,
    db::{get_or_mget_records, get_zone_keys},
    errors_and_responses::{
        auth_err, internal_err, partial_success_with_data, success_with_toplevel_data,
    },
    types::{AppState, GetZoneRecordsRequestBody, ResponseType},
};

#[post("/get-zone-records")]
pub async fn get_zone_records(
    req: HttpRequest,
    req_body: web::Json<GetZoneRecordsRequestBody>,
    state: web::Data<AppState>,
) -> impl Responder {
    let span = info_span!(
        "get-zone-records",
        client_username = %req_body.client_username,
        names = ?req_body.names
    );
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
            if req_body.names.is_empty() {
                return success_with_toplevel_data("got records", json!([]));
            }

            let mut con = match state.db_pool.get().await {
                Ok(c) => c,
                Err(_) => return internal_err("No db connection."),
            };

            // store if a name was invalid or not absolute so we can it report back in the response.
            // we can also use the status to skip checking whether it is one of the available zones
            // if the status is not Ok
            #[derive(PartialEq)]
            enum NameStatus {
                NotAbsolute,
                Ok,
            }
            let name_status: Vec<_> = req_body
                .names
                .iter()
                .map(|name| {
                    if name.is_fqdn() {
                        NameStatus::Ok
                    } else {
                        NameStatus::NotAbsolute
                    }
                })
                .collect();

            let names: Vec<_> = req_body.names.iter().collect();
            let zones_record_keys = match get_zone_keys(&names, &mut con).await {
                Ok(z) => z,
                Err(e) => return internal_err(e.to_string()),
            };

            // actually get the record contents, we currently only have the keys
            let mut records = Vec::with_capacity(zones_record_keys.len());
            let mut internal_error = None;
            for (idx, keys_opt) in zones_record_keys.iter().enumerate() {
                if let Some(keys) = keys_opt {
                    let get_res = get_or_mget_records(keys, &mut con)
                        .await
                        .map_err(|e| e.to_string());
                    if let Err(ref err) = get_res {
                        internal_error = Some(err.clone());
                    }
                    records.push(get_res);
                } else if name_status[idx] == NameStatus::NotAbsolute {
                    records.push(Err("non-absolute name".into()));
                } else {
                    records.push(Err("not found".into()));
                }
            }

            if let Some(err) = internal_error {
                internal_err(err)
            } else {
                let messages: Vec<_> = records
                    .into_iter()
                    .map(|records_res| match records_res {
                        Err(e) => (ResponseType::Error, e, None),
                        Ok(records) => (ResponseType::Success, "got records".into(), Some(records)),
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
                    ResponseType::PartialSuccess => "couldn't get records for all zones",
                    ResponseType::Error => "couldn't get records",
                    ResponseType::Ignored => unreachable!(),
                };
                partial_success_with_data(toplevel_response_type, toplevel_message, messages)
            }
        } else {
            auth.message.push('\n');
            auth_err(auth.message)
        }
    }
    .instrument(span)
    .await
}
