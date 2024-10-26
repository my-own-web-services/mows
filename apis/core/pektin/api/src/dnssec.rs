use std::collections::HashMap;

use data_encoding::BASE64;
use pektin_common::deadpool_redis::Connection;
use pektin_common::proto::rr::dnssec::rdata::{DNSSECRData, SIG};
use pektin_common::proto::rr::dnssec::tbs::rrset_tbs_with_sig;
use pektin_common::proto::rr::dnssec::Algorithm::ECDSAP256SHA256;
use pektin_common::proto::rr::dnssec::Nsec3HashAlgorithm;
use pektin_common::proto::rr::{DNSClass, Name, RData, Record, RecordType};
use pektin_common::{
    DbEntry, DnskeyRecord, DnssecAlgorithm, HashAlgorithm, Nsec3ParamRecord, Nsec3Record, RrSet,
    RrsigRecord,
};
use tracing::instrument;

use crate::db::get_zone_keys;
use crate::errors_and_responses::PektinApiError;
use crate::types::RecordIdentifier;
use crate::{errors_and_responses::PektinApiResult, vault};

#[instrument(skip(vault_endpoint, vault_token))]
pub async fn get_dnskey_for_zone(
    zone: &Name,
    vault_endpoint: &str,
    vault_token: &str,
) -> PektinApiResult<DnskeyRecord> {
    let mut dnssec_keys = vault::get_zone_dnssec_keys(zone, vault_endpoint, vault_token).await?;
    let dnssec_key = dnssec_keys.pop().expect("Vault returned no DNSSEC keys");

    use p256::pkcs8::DecodePublicKey;

    let dnssec_key = p256::ecdsa::VerifyingKey::from_public_key_pem(&dnssec_key)
        .expect("Vault returned invalid DNSSEC key");
    let dnssec_key_bytes = dnssec_key.to_encoded_point(false);
    let dnskey = DnskeyRecord {
        zone: true,
        secure_entry_point: true,
        revoked: false,
        algorithm: DnssecAlgorithm::ECDSAP256SHA256,
        // remove leading SEC1 tag byte (0x04 for an uncompressed point)
        key: BASE64.encode(&dnssec_key_bytes.as_bytes()[1..]),
    };

    Ok(dnskey)
}

#[instrument(skip(vault_endpoint, vault_token))]
pub async fn sign_db_entry(
    zone: &Name,
    entry: DbEntry,
    dnskey: &DnskeyRecord,
    vault_endpoint: &str,
    vault_token: &str,
) -> PektinApiResult<DbEntry> {
    let signer_name = zone.clone();

    // TODO think about RRSIG signature validity period
    let sig_valid_from = chrono::Utc::now();
    let sig_valid_until = sig_valid_from + chrono::Duration::days(2);

    let dnskey_record: Vec<Record> = DbEntry {
        name: Name::root(),
        meta: "".to_string(),
        ttl: 3600,
        rr_set: RrSet::DNSKEY {
            rr_set: vec![dnskey.clone()],
        },
    }
    .try_into()
    .expect("Could not convert DNSKEY DbEntry to trust-dns Record");
    let dnskey_record = dnskey_record.get(0).expect("Could not get DNSKEY record");
    let dnskey = match dnskey_record.data() {
        Some(RData::DNSSEC(DNSSECRData::DNSKEY(dnskey))) => dnskey,
        _ => panic!("DNSKEY record does not contain a DNSKEY"),
    };
    let key_tag = dnskey
        .calculate_key_tag()
        .expect("Could not calculate key tag");

    let sig = SIG::new(
        entry.rr_type(),
        ECDSAP256SHA256,
        entry.name.num_labels(),
        entry.ttl,
        sig_valid_until.timestamp() as _,
        sig_valid_from.timestamp() as _,
        key_tag,
        signer_name.clone(),
        vec![],
    );

    let records_tbs: Vec<Record> = entry.clone().try_into().unwrap();
    let tbs = rrset_tbs_with_sig(&entry.name, DNSClass::IN, &sig, &records_tbs).unwrap();
    // dbg!(tbs.as_ref());
    let signature = vault::sign_with_vault(&tbs, &signer_name, vault_endpoint, vault_token).await?;

    let rrsig_entry = RrsigRecord {
        type_covered: sig.type_covered(),
        algorithm: DnssecAlgorithm::ECDSAP256SHA256,
        labels: entry.name.num_labels(),
        original_ttl: sig.original_ttl(),
        signature_expiration: sig.sig_expiration(),
        signature_inception: sig.sig_inception(),
        key_tag: sig.key_tag(),
        signer_name: sig.signer_name().clone(),
        signature: BASE64.encode(&signature),
    };

    Ok(DbEntry {
        name: entry.name,
        ttl: entry.ttl,
        meta: "".to_string(),
        rr_set: RrSet::RRSIG {
            rr_set: vec![rrsig_entry],
        },
    })
}

/// Takes a zone name and constructs NSEC3 records for all records in the zone. The corresponding NSEC3PARAM record is also returned.
///
/// `ttl` is the TTL for the generated NSEC3 and NSEC3PARAM records.
///
/// The salt is newly generated.
#[instrument(skip(con))]
pub async fn create_nsec3_chain(
    zone: &Name,
    ttl: u32,
    con: &mut Connection,
) -> PektinApiResult<(Vec<DbEntry>, DbEntry)> {
    // see https://datatracker.ietf.org/doc/html/rfc5155#section-7.1
    let hash_algorithm = HashAlgorithm::SHA1;
    let iterations = 16;
    let salt: [u8; 16] = rand::random();

    let mut hashed_names_and_nsec3_records: Vec<(_, _)> =
        create_hashed_names_and_nsec3_records(zone, hash_algorithm, &salt, iterations, con)
            .await?
            .into_iter()
            .collect();
    hashed_names_and_nsec3_records.sort_unstable_by(|a, b| a.0.cmp(&b.0));

    let len = hashed_names_and_nsec3_records.len();
    for index in 0..len {
        let next_index = (index + 1) % len;
        hashed_names_and_nsec3_records[index].1 .0.next_hashed_owner =
            hashed_names_and_nsec3_records[next_index].0.clone();
    }

    let nsec3_param = Nsec3ParamRecord {
        hash_algorithm,
        iterations,
        salt: Some(salt.into()),
    };
    let nsec3_param = DbEntry {
        name: zone.clone(),
        ttl,
        meta: "".to_string(),
        rr_set: RrSet::NSEC3PARAM {
            rr_set: vec![nsec3_param],
        },
    };

    let nsec3 = hashed_names_and_nsec3_records
        .into_iter()
        .map(|(hash, (nsec3, name))| {
            let hash_b32 = data_encoding::BASE32HEX_NOPAD.encode(&hash);
            let next_b32 = data_encoding::BASE32HEX_NOPAD.encode(&nsec3.next_hashed_owner);
            let salt = data_encoding::HEXLOWER.encode(&salt);

            DbEntry {
                name: Name::from_ascii(&hash_b32)
                    .unwrap()
                    .append_domain(zone)
                    .expect("NSEC3 owner name too long"),
                ttl,
                meta: format!("orig: {name} hash: {hash_b32} next: {next_b32} salt: {salt}"),
                rr_set: RrSet::NSEC3 {
                    rr_set: vec![nsec3],
                },
            }
        });

    Ok((nsec3.collect(), nsec3_param))
}

async fn get_unique_owner_names_and_types(
    zone: &Name,
    con: &mut Connection,
) -> PektinApiResult<HashMap<Name, Vec<RecordType>>> {
    let zone_keys = get_zone_keys(&[zone], con)
        .await?
        .pop()
        .unwrap()
        .ok_or(PektinApiError::NoSoaRecord)?;
    let owner_idents: Result<Vec<_>, _> = zone_keys
        .into_iter()
        .map(RecordIdentifier::from_db_key)
        .collect();
    let mut unique_owner_names_and_types: HashMap<Name, Vec<RecordType>> = HashMap::new();
    for ident in owner_idents? {
        unique_owner_names_and_types
            .entry(ident.name)
            .or_default()
            .push(ident.rr_type);
    }

    Ok(unique_owner_names_and_types)
}

async fn create_hashed_names_and_nsec3_records(
    zone: &Name,
    hash_algorithm: HashAlgorithm,
    salt: &[u8],
    iterations: u16,
    con: &mut Connection,
) -> PektinApiResult<HashMap<Vec<u8>, (Nsec3Record, Name)>> {
    let mut hashed_names_and_nsec3_records = HashMap::new();
    for (mut name, mut types) in get_unique_owner_names_and_types(zone, con).await? {
        // RRSIG records are in the separate DNSSEC db, but are always present
        types.push(RecordType::RRSIG);

        // ensure the zone apex NSEC3 record lists NSEC3PARAM in its types field
        if (&name == zone) && !types.contains(&RecordType::NSEC3PARAM) {
            types.push(RecordType::NSEC3PARAM);
        }

        let nsec3 = Nsec3Record {
            // TODO: think about NSEC3 opt out flag
            opt_out: false,
            hash_algorithm,
            iterations,
            salt: Some(salt.into()),
            next_hashed_owner: vec![],
            types,
        };
        let hashed_owner_name = Nsec3HashAlgorithm::SHA1
            .hash(salt, &name, iterations)
            .map_err(|_| PektinApiError::CouldNotHash)?;
        // trust-dns's `Digest` type can't be used as a key in a HashMap, so we convert it to a Vec<u8>
        let hashed_owner_name = hashed_owner_name.as_ref().to_vec();
        hashed_names_and_nsec3_records.insert(hashed_owner_name, (nsec3, name.clone()));

        // From https://datatracker.ietf.org/doc/html/rfc5155#section-7.1:
        // "If the difference in number of labels between the apex and the original owner name is
        // greater than 1, additional NSEC3 RRs need to be added for every empty non-terminal
        // between the apex and the original owner name."
        // From https://datatracker.ietf.org/doc/html/rfc7719:
        // "Empty non-terminals: 'Domain names that own no resource records but have subdomains that
        // do.'"
        while &name != zone {
            name = name.base_name();
            let hashed_owner_name = Nsec3HashAlgorithm::SHA1
                .hash(salt, &name, iterations)
                .map_err(|_| PektinApiError::CouldNotHash)?;

            // only synthesize records for empty non-terminals, i.e. if we already have an NSEC3
            // record for this hashed owner name, we don't need to synthesize one. if we don't have
            // an NSEC3 record for this hashed owner name yet, but a "real" one will be generated
            // later, it will just overwrite the synthesized one
            if !hashed_names_and_nsec3_records.contains_key(hashed_owner_name.as_ref()) {
                let nsec3 = Nsec3Record {
                    // TODO: think about NSEC3 opt out flag
                    opt_out: false,
                    hash_algorithm,
                    iterations,
                    salt: Some(salt.into()),
                    next_hashed_owner: vec![],
                    types: vec![],
                };
                // trust-dns's `Digest` type can't be used as a key in a HashMap, so we convert it to a Vec<u8>
                let hashed_owner_name = hashed_owner_name.as_ref().to_vec();
                hashed_names_and_nsec3_records.insert(hashed_owner_name, (nsec3, name.clone()));
            }
        }
    }
    Ok(hashed_names_and_nsec3_records)
}
