use std::collections::HashMap;

use chrono::{Duration, TimeZone, Utc};
use pektin_common::deadpool_redis::redis::AsyncCommands;
use pektin_common::deadpool_redis::Connection;
use pektin_common::proto::rr::Name;
use pektin_common::{get_authoritative_zones, DbEntry, PektinCommonError, RrSet};
use tokio::time::sleep;
use tracing::{debug, error, trace};

use crate::db::{get_or_mget_records, get_zone_dnskey_records};
use crate::dnssec::sign_db_entry;
use crate::errors_and_responses::{PektinApiError, PektinApiResult};
use crate::types::AppState;
use crate::utils::find_authoritative_zone;

// `interval` is the duration between two runs (check which RRSIGs need to be recreated and actually recreate them)
// `threshold` decides which RRSIGs are recreated: if an RRSIG expires in less than `threshold`, it is recreated
pub async fn signing_task(state: AppState, interval: Duration, threshold: Duration) {
    loop {
        match signing_task_run(&state, threshold).await {
            Ok(()) => debug!("Signing task finished successfully"),
            // TODO: post to alert manager in case of error
            Err(e) => error!("Signing task failed: {}", e),
        };
        sleep(
            interval
                .to_std()
                .expect("signing task interval must not be negative"),
        )
        .await;
    }
}

async fn signing_task_run(state: &AppState, threshold: Duration) -> PektinApiResult<()> {
    debug!(
        "recreating all RRSIGs expiring in less than {:?}",
        threshold
    );

    let mut con = state.db_pool.get().await?;
    let mut dnssec_con = state.db_pool_dnssec.get().await?;
    let vault_api_token = crate::vault::ApiTokenCache::get().await?;

    let authoritative_zones: Vec<_> = get_authoritative_zones(&mut con)
        .await?
        .into_iter()
        .map(|zone| Name::from_utf8(zone).expect("Key in db is not a valid DNS name"))
        .collect();

    let records_to_be_resigned =
        get_records_to_be_resigned(threshold, &mut con, &mut dnssec_con).await?;
    let zones_to_get_dnskeys_for: Vec<_> = records_to_be_resigned
        .iter()
        .map(|r| {
            find_authoritative_zone(&r.name, &authoritative_zones)
                .expect("No zone is authoritative for record in Db")
        })
        .collect();
    let dnskey_for_zone: HashMap<_, _> =
        get_zone_dnskey_records(&zones_to_get_dnskeys_for, &mut con)
            .await?
            .into_iter()
            .collect();

    let mut rrsig_records = Vec::with_capacity(records_to_be_resigned.len());
    for record in records_to_be_resigned {
        let record_zone = find_authoritative_zone(&record.name, &authoritative_zones)
            .expect("no zone is authoritative for record");
        let dnskey = dnskey_for_zone
            .get(&record_zone)
            .expect("failed to get dnskey for zone");
        let rec = sign_db_entry(&record_zone, record.clone(), dnskey, &vault_api_token).await;
        rrsig_records.push(rec);
    }
    let rrsig_records: Result<Vec<_>, _> = rrsig_records.into_iter().collect();
    let rrsig_records: Result<Vec<_>, _> = rrsig_records?
        .iter()
        .map(|e| match e.serialize_for_db() {
            Ok(ser) => Ok((e.db_key(), ser)),
            Err(e) => Err(e),
        })
        .collect();

    match rrsig_records {
        Err(e) => return Err(PektinApiError::GenericError(e.to_string())),
        Ok(rrsig_records) if !rrsig_records.is_empty() => {
            trace!("RRSIG records to be set: {:?}", rrsig_records);
            dnssec_con
                .mset::<_, _, ()>(&rrsig_records)
                .await
                .map_err(PektinCommonError::from)?;
            Ok(())
        }
        _ => {
            debug!("No RRSIG records to be set.");
            return Ok(());
        }
    }
}

async fn get_records_to_be_resigned(
    threshold: Duration,
    con: &mut Connection,
    dnssec_con: &mut Connection,
) -> PektinApiResult<Vec<DbEntry>> {
    let glob = "*:RRSIG:*";
    let rrsig_record_db_keys = dnssec_con
        .keys::<_, Vec<String>>(glob)
        .await
        .map_err(PektinCommonError::from)?;
    let rrsig_records = get_or_mget_records(&rrsig_record_db_keys, dnssec_con).await?;

    let now = Utc::now();
    let expiring_rrsig_record_db_keys = rrsig_records.iter().filter_map(|r| match r {
        Some(
            entry @ DbEntry {
                rr_set: RrSet::RRSIG { rr_set },
                ..
            },
        ) => {
            let expiring_records = rr_set.iter().filter(|record| {
                let expiration = Utc
                    .timestamp_opt(record.signature_expiration as i64, 0)
                    .single();
                if expiration.is_none() {
                    return false;
                }
                let expiration = expiration.unwrap();

                expiration - now < threshold
            });
            if expiring_records.count() > 0 {
                Some(entry.db_key())
            } else {
                None
            }
        }
        _ => None,
    });

    let records_to_be_resigned_db_keys: Vec<_> = expiring_rrsig_record_db_keys
        .map(|key| key.replace(":RRSIG", ""))
        .collect();

    let records_to_be_resigned = get_or_mget_records(&records_to_be_resigned_db_keys, con).await?;

    Ok(records_to_be_resigned.into_iter().flatten().collect())
}
