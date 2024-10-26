use std::collections::HashSet;

use pektin_common::deadpool_redis::Connection;
use pektin_common::get_authoritative_zones;
use pektin_common::proto::rr::{Name, RecordType};
use pektin_common::{DbEntry, RrSet};
use thiserror::Error;
use tracing::instrument;

use crate::errors_and_responses::{PektinApiError, PektinApiResult};
use crate::types::Glob;
use crate::utils::find_authoritative_zone;

#[derive(Debug, Error)]
pub enum RecordValidationError {
    #[error("The record's name has an invalid format")]
    InvalidNameFormat,
    #[error("The record's RR set is empty")]
    EmptyRrset,
    #[error("Cannot manually set DNSSEC records (e.g. RRSIG, DNSKEY)")]
    SetDnssec,
    #[error("The record's name contains an invalid record type: '{0}'")]
    InvalidNameRecordType(String),
    #[error("The record's name contains an invalid DNS name: '{0}'")]
    InvalidDnsName(String),
    #[error("The record type of a member of the RR set and in the record's name don't match")]
    RecordTypeMismatch,
    #[error("Too many SOA records (can only set one, duh)")]
    TooManySoas,
    #[error("The record data had an invalid format: {0}")]
    InvalidDataFormat(String),
    #[error("The record's name is not absolute (i.e. the root label at the end is missing)")]
    NameNotAbsolute,
    #[error("The record contains an empty name")]
    EmptyName,
}
pub type RecordValidationResult<T> = Result<T, RecordValidationError>;

#[instrument]
pub fn validate_records(records: &[DbEntry]) -> Vec<RecordValidationResult<()>> {
    records.iter().map(validate_db_entry).collect()
}

#[instrument]
fn validate_db_entry(db_entry: &DbEntry) -> RecordValidationResult<()> {
    if db_entry.rr_set.is_empty() {
        return Err(RecordValidationError::EmptyRrset);
    }

    if [RecordType::RRSIG, RecordType::DNSKEY].contains(&db_entry.rr_type()) {
        return Err(RecordValidationError::SetDnssec);
    }

    if !db_entry.name.is_fqdn() {
        return Err(RecordValidationError::NameNotAbsolute);
    }

    if let Err(err) = db_entry.clone().convert() {
        return Err(RecordValidationError::InvalidDataFormat(err.to_string()));
    }

    let is_soa = matches!(db_entry.rr_set, RrSet::SOA { .. });
    if is_soa && db_entry.rr_set.len() != 1 {
        return Err(RecordValidationError::TooManySoas);
    }

    check_for_empty_names(db_entry)
}

/// Checks that all names in CAA, CNAME, MX, NS, SOA, and SRV records are non-empty (the root label
/// counts as non-empty).
///
/// This is needed because the empty string can be successfully converted to TrustDNS's
/// [`pektin_common::proto::rr::Name`] type.
#[instrument]
fn check_for_empty_names(db_entry: &DbEntry) -> RecordValidationResult<()> {
    let empty_name = Name::from_ascii("").expect("TrustDNS doesn't allow empty names anymore :)");
    // "" == "." is true, we have to work around that
    let is_empty = |name: &Name| !name.is_root() && (name == &empty_name);

    let ok = match &db_entry.rr_set {
        RrSet::CAA { rr_set } => rr_set.iter().all(|record| !record.value.is_empty()),
        RrSet::CNAME { rr_set } => rr_set.iter().all(|record| !is_empty(&record.value)),
        RrSet::MX { rr_set } => rr_set
            .iter()
            .all(|record| !is_empty(record.value.exchange())),
        RrSet::NS { rr_set } => rr_set.iter().all(|record| !is_empty(&record.value)),
        RrSet::SOA { rr_set } => rr_set
            .iter()
            .all(|record| !is_empty(record.value.mname()) && !is_empty(record.value.rname())),
        RrSet::SRV { rr_set } => rr_set.iter().all(|record| !is_empty(record.value.target())),
        _ => true,
    };

    if ok {
        Ok(())
    } else {
        Err(RecordValidationError::EmptyName)
    }
}

/// Checks whether the db entry to be set either contains a SOA record or is for a zone that
/// already has a SOA record.
///
/// Returns three things:
/// - whether the SOA check succeeded;
/// - all zones that occur in the list of db entries;
/// - the zones for which a new SOA record is set.
///
/// This must be called after `validate_records()`, and only if validation succeeded.
#[instrument(skip(con))]
pub async fn check_soa(
    entries: &[DbEntry],
    con: &mut Connection,
) -> PektinApiResult<(Vec<PektinApiResult<()>>, Vec<Name>, Vec<Name>)> {
    let authoritative_zones = get_authoritative_zones(con).await?;
    let authoritative_zones: Vec<_> = authoritative_zones
        .into_iter()
        .map(|zone| Name::from_utf8(zone).expect("Key in db is not a valid DNS name"))
        .collect();

    let mut new_authoritative_zones = Vec::with_capacity(entries.len());
    let mut used_zones = HashSet::with_capacity(entries.len());

    for entry in entries {
        if matches!(entry.rr_set, RrSet::SOA { .. }) && !authoritative_zones.contains(&entry.name) {
            new_authoritative_zones.push(entry.name.clone());
        }
    }
    for entry in entries {
        let auth_zone =
            if let Some(zone) = find_authoritative_zone(&entry.name, &authoritative_zones) {
                zone
            } else {
                find_authoritative_zone(&entry.name, &new_authoritative_zones)
                    .expect("No new or existing zone contains the db entry")
            };
        used_zones.insert(auth_zone);
    }
    let used_zones: Vec<_> = used_zones.into_iter().collect();

    let soa_check_ok = entries
        .iter()
        .map(|entry| {
            check_soa_for_single_entry(entry, &authoritative_zones, &new_authoritative_zones)
        })
        .collect();

    Ok((soa_check_ok, used_zones, new_authoritative_zones))
}

#[instrument]
fn check_soa_for_single_entry(
    entry: &DbEntry,
    authoriative_zones: &[Name],
    new_authoriative_zones: &[Name],
) -> PektinApiResult<()> {
    // record contains SOA
    if matches!(entry.rr_set, RrSet::SOA { .. }) {
        return Ok(());
    }

    if authoriative_zones
        .iter()
        .chain(new_authoriative_zones.iter())
        .any(|auth_zone| auth_zone.zone_of(&entry.name))
    {
        Ok(())
    } else {
        Err(PektinApiError::NoSoaRecord)
    }
}

impl Glob {
    pub fn validate(&self) -> Result<(), String> {
        if self.name_glob.contains(':') {
            Err("Invalid name glob: must not contain ':'".into())
        } else if self.rr_type_glob.contains(':') {
            Err("Invalid rr type glob: must not contain ':'".into())
        } else {
            Ok(())
        }
    }

    pub fn as_db_glob(&self) -> String {
        format!("{}:{}", self.name_glob, self.rr_type_glob)
    }
}
