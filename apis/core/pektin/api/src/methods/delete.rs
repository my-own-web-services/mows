use std::ops::Deref;

use actix_web::{post, web, HttpRequest, Responder};
use pektin_common::{deadpool_redis::redis::AsyncCommands, proto::rr::RecordType};
use tracing::{info_span, Instrument};

use crate::{
    auth::auth_ok,
    db::get_zone_keys,
    errors_and_responses::{auth_err, err, internal_err, success_with_toplevel_data},
    types::{AppState, DeleteRequestBody},
    validation::RecordValidationError,
};

#[post("/delete")]
pub async fn delete(
    req: HttpRequest,
    req_body: web::Json<DeleteRequestBody>,
    state: web::Data<AppState>,
) -> impl Responder {
    let span = info_span!("delete", client_username = %req_body.client_username, records = ?req_body.records);
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
                return success_with_toplevel_data("removed 0 records", 0);
            }

            // TODO:
            // - also delete RRSIG entries
            // - update NSEC chain
            // - if soa is deleted also delete dnskey
            let mut con = match state.db_pool.get().await {
                Ok(c) => c,
                Err(_) => return internal_err("No db connection."),
            };

            let valid: Vec<_> = req_body
                .records
                .iter()
                .map(|record| {
                    if record.name.is_fqdn() {
                        Ok(())
                    } else {
                        Err(RecordValidationError::NameNotAbsolute)
                    }
                })
                .collect();
            if valid.iter().any(|s| s.is_err()) {
                let messages = valid
                    .iter()
                    .map(|res| res.as_ref().err().map(|e| e.to_string()))
                    .collect();
                return err("One or more records were invalid.", messages);
            }

            let keys_to_delete: Vec<_> = req_body
                .records
                .iter()
                .flat_map(|record| {
                    let mut keys = vec![];
                    keys.push(format!("{}:{:?}", record.name, record.rr_type));
                    if record.rr_type == RecordType::SOA {
                        keys.push(format!("{}:{:?}", record.name, RecordType::DNSKEY));
                    }
                    keys
                })
                .collect();

            // we only check conditions that require communication with db if all records are valid,
            // i.e. we skip these checks if we reject the request anyways

            // check that if we delete a SOA record we also delete all other records in that zone.
            // this stores the names of SOA records that should be deleted
            let zones_to_delete: Vec<_> = req_body
                .records
                .iter()
                .filter(|r| r.rr_type == RecordType::SOA)
                .map(|r| &r.name)
                .collect();
            // now this stores all keys of the zones that should be deleted
            let zones_to_delete = match get_zone_keys(&zones_to_delete, &mut con).await {
                Ok(z) => z,
                Err(e) => return internal_err(e.to_string()),
            };
            // true if all of the zone's records are also deleted
            let complete_zone_deleted: Vec<_> = zones_to_delete
                .into_iter()
                .flatten()
                .map(|zone_keys| zone_keys.iter().all(|key| keys_to_delete.contains(key)))
                .collect();
            // soa_idx counts the index into complete_zone_deleted for the following iter()
            let mut soa_idx = 0;
            if complete_zone_deleted.iter().any(|b| !b) {
                let messages = req_body
                    .records
                    .iter()
                    .map(|r| {
                        if r.rr_type != RecordType::SOA {
                            None
                        } else {
                            let res = if complete_zone_deleted[soa_idx] {
                                None
                            } else {
                                Some("Requested to delete the zone's SOA record without also deleting all the other records in the zone.")
                            };
                            soa_idx += 1;
                            res
                        }
                    }).collect();
                return err("One or more records were invalid.", messages);
            }

            match con.del::<_, u32>(&keys_to_delete).await {
                Ok(n) => success_with_toplevel_data(format!("removed {n} records"), n),
                Err(_) => internal_err("Could not delete records from database."),
            }
        } else {
            auth.message.push('\n');
            auth_err(auth.message)
        }
    }
    .instrument(span)
    .await
}
