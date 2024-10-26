use std::{collections::HashMap, ops::Deref};

use actix_web::{post, web, HttpRequest, Responder};
use pektin_common::deadpool_redis::redis::AsyncCommands;
use pektin_common::{DbEntry, PektinCommonError, RrSet};
use serde_json::json;
use tracing::{info_span, Instrument};

use crate::db::get_zone_dnskey_records;
use crate::dnssec::create_nsec3_chain;
use crate::utils::find_authoritative_zone;
use crate::{
    auth::auth_ok,
    dnssec::{get_dnskey_for_zone, sign_db_entry},
    errors_and_responses::{auth_err, err, internal_err, success, success_with_toplevel_data},
    types::{AppState, SetRequestBody},
    validation::{check_soa, validate_records},
    vault,
};

// TODO: this is probably also useful for all other methods
/// Takes `var`, a `Vec<Result<T, E>>`, and turns it into a `Vec<T>` if all results are `Ok`.
/// If any result is `Err`, a vector of all error messages is built and returned using `err()`
/// together with the given error message.
macro_rules! unwrap_or_return_if_err {
    ($var:ident, $err_msg:expr) => {
        if $var.iter().any(|r| r.is_err()) {
            let messages = $var
                .iter()
                .map(|res| res.as_ref().err().map(|e| e.to_string()))
                .collect();
            return err($err_msg, messages);
        }
        let $var = $var.into_iter().map(|res| res.unwrap()).collect::<Vec<_>>();
    };
}

#[post("/set")]
pub async fn set(
    req: HttpRequest,
    req_body: web::Json<SetRequestBody>,
    state: web::Data<AppState>,
) -> impl Responder {
    let span = info_span!(
        "set",
        client_username = %req_body.client_username,
        records = ?req_body.records
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
            if req_body.records.is_empty() {
                return success_with_toplevel_data("set records", json!([]));
            }

            // get db cons
            let mut con = match state.db_pool.get().await {
                Ok(c) => c,
                Err(_) => return internal_err("No db connection."),
            };

            let mut dnssec_con = match state.db_pool_dnssec.get().await {
                Ok(c) => c,
                Err(_) => return internal_err("No db connection."),
            };

            // validate
            let _valid = validate_records(&req_body.records);
            unwrap_or_return_if_err!(_valid, "One or more records were invalid.");

            let (_soa_check, used_zones, new_authoritative_zones) =
                match check_soa(&req_body.records, &mut con).await {
                    Ok(s) => s,
                    Err(e) => return internal_err(e.to_string()),
                };
            unwrap_or_return_if_err!(_soa_check, "Tried to set one or more records for a zone that does not have a SOA record.");

            let vault_api_token = match vault::ApiTokenCache::get(
                &state.vault_uri,
                &state.vault_user_name,
                &state.vault_password,
            )
            .await
            {
                Ok(t) => t,
                Err(_) => return internal_err("Couldnt get vault api token"),
            };

            let zones_to_fetch_dnskeys_for: Vec<_> = used_zones
                .iter()
                .filter(|zone| !new_authoritative_zones.contains(zone))
                .cloned()
                .collect();
            let dnskeys = match get_zone_dnskey_records(
                &zones_to_fetch_dnskeys_for,
                &mut con,
            ).await {
                Ok(d) => d,
                Err(e) => return internal_err(e.to_string()),
            };

            let mut dnskeys_for_new_zones = Vec::with_capacity(new_authoritative_zones.len());
            for zone in &new_authoritative_zones {
                let dnskey = get_dnskey_for_zone(zone, &state.vault_uri, &vault_api_token).await;
                dnskeys_for_new_zones.push(dnskey.map(|d| (zone.clone(), d)));
            }
            unwrap_or_return_if_err!(dnskeys_for_new_zones, "Couldn't set DNSKEY for one or more newly created zones because Vault has no signer for this zone.");

            let dnskey_for_zone: HashMap<_, _> = dnskeys
                .into_iter()
                .chain(dnskeys_for_new_zones.clone().into_iter())
                .collect();

            let new_dnskey_records: Vec<_> = dnskeys_for_new_zones
                .into_iter()
                .map(|(zone, dnskey)| DbEntry {
                    name: zone,
                    meta:"".to_string(),
                    // TODO: don't hardcode DNSKEY TTL
                    ttl: 3600,
                    rr_set: RrSet::DNSKEY {
                        rr_set: vec![dnskey],
                    },
                })
                .collect();

            // TODO once we support separate KSK and ZSK, sign the ZSK with the KSK
            // until then we just sign the KSK with itself

            let mut rrsig_records = Vec::with_capacity(req_body.records.len());
            for record in req_body.records.iter().chain(new_dnskey_records.iter()) {
                let record_zone = find_authoritative_zone(&record.name, &used_zones).expect("no zone is authoritative for record");
                let dnskey = dnskey_for_zone.get(&record_zone).expect("failed to get dnskey for zone");
                let rec = sign_db_entry(
                    &record_zone,
                    record.clone(),
                    dnskey,
                    &state.vault_uri,
                    &vault_api_token,
                )
                .await;
                rrsig_records.push(rec);
            }

            unwrap_or_return_if_err!(rrsig_records, "Could not sign one or more records.");

            // TODO:
            // - re-generate and re-sign NSEC records

            let entries_length = req_body.records.len();
            let entries: Result<Vec<_>, _> = req_body
                .records
                .iter()
                .chain(new_dnskey_records.iter())
                .map(|e| match e.serialize_for_db() {
                    Ok(ser) => Ok((e.db_key(), ser)),
                    Err(e) => Err(e),
                })
                .collect();

            let rrsig_records: Result<Vec<_>, _> = rrsig_records
                .iter()
                .map(|e| match e.serialize_for_db() {
                    Ok(ser) => Ok((e.db_key(), ser)),
                    Err(e) => Err(e),
                })
                .collect();

            match rrsig_records {
                Err(e) => return internal_err(e.to_string()),
                Ok(rrsig_records) if !rrsig_records.is_empty() => {
                    if let Err(e) = dnssec_con.set_multiple::<_, _, ()>(&rrsig_records).await {
                        return internal_err(PektinCommonError::from(e).to_string());
                    }
                }
                _ => {
                    println!("{:?}", req_body.records);
                }
            }

            let res = match entries {
                Err(e) => internal_err(e.to_string()),
                Ok(entries) => match con.set_multiple(&entries).await {
                    Ok(()) => {
                        let messages = entries[0..entries_length]
                            .iter()
                            .map(|_| "set record")
                            .collect();
                        success("set records", messages)
                    }
                    Err(e) => {
                        let to_be_deleted: Vec<String> = entries[entries_length..]
                            .to_vec()
                            .iter()
                            .map(|e| e.0.clone())
                            .collect();
                        match dnssec_con.del::<_, u32>(to_be_deleted).await {
                            Err(ee) => internal_err(format!("FATAL: POSSIBLE INCONSISTENCY: Setting non DNSSEC records failed, while setting DNSSEC records succeeded. The removal of the successful set DNSSEC records failed again. {}{}", PektinCommonError::from(e), ee)),
                            Ok(_) => internal_err(PektinCommonError::from(e).to_string()),
                        }
                    }
                },
            };

            // TODO: set NSEC3(PARAM) records
            for zone in &new_authoritative_zones {
                let chain = format!("{:#?}", create_nsec3_chain(zone, 600, &mut con).await);
                tracing::debug!(%chain, "NSEC3 chain for {zone}");
            }

            res
        } else {
            auth.message.push('\n');
            auth_err(auth.message)
        }
    }
    .instrument(span)
    .await
}
