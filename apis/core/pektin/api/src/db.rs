use pektin_common::deadpool_redis::redis::{AsyncCommands, FromRedisValue, Value};
use pektin_common::proto::rr::Name;
use pektin_common::{deadpool_redis, DnskeyRecord, PektinCommonError, RrSet};
use pektin_common::{deadpool_redis::Connection, DbEntry};
use tracing::{debug, instrument};

use crate::errors_and_responses::{PektinApiError, PektinApiResult};
use crate::types::RecordIdentifier;

#[instrument(skip(con))]
pub async fn get_or_mget_records(
    keys: &[String],
    con: &mut Connection,
) -> Result<Vec<Option<DbEntry>>, PektinCommonError> {
    // if only one key comes back in the response, db returns an error because it cannot parse the reponse as a vector,
    // and there were also issues with a "too many arguments for a GET command" error. we therefore roll our own implementation
    // using only low-level commands.
    if keys.len() == 1 {
        debug!("using GET command");
        match deadpool_redis::redis::cmd("GET")
            .arg(&keys[0])
            .query_async::<_, String>(con)
            .await
        {
            Ok(s) => match DbEntry::deserialize_from_db(&keys[0], &s) {
                Ok(data) => Ok(vec![Some(data)]),
                Err(e) => Err(e),
            },
            Err(_) => Ok(vec![None]),
        }
    } else {
        debug!("using MGET command");
        match deadpool_redis::redis::cmd("MGET")
            .arg(&keys)
            .query_async::<_, Vec<Value>>(con)
            .await
        {
            Ok(v) => {
                let parsed_opt: Result<Vec<_>, _> = keys
                    .iter()
                    .zip(v.into_iter())
                    .map(|(key, val)| {
                        if val == Value::Nil {
                            Ok(None)
                        } else {
                            DbEntry::deserialize_from_db(
                                key,
                                &String::from_redis_value(&val)
                                    .expect("db response could not be deserialized"),
                            )
                            .map(Some)
                        }
                    })
                    .collect();
                Ok(parsed_opt?)
            }
            Err(e) => Err(e.into()),
        }
    }
}

/// Takes a list of zone names and returns the list of all DNSKEY records for those zones, as a
/// tuple together with the zone name.
#[instrument(skip(con))]
pub async fn get_zone_dnskey_records(
    zones: &[Name],
    con: &mut Connection,
) -> Result<Vec<(Name, DnskeyRecord)>, PektinCommonError> {
    if zones.is_empty() {
        return Ok(vec![]);
    }

    let dnskey_db_keys: Vec<_> = zones.iter().map(|z| format!("{z}:DNSKEY")).collect();
    get_or_mget_records(&dnskey_db_keys, con).await.map(|keys| {
        std::iter::zip(dnskey_db_keys, keys)
            .map(|(db_key, dnskey)| {
                let dnskey_entry =
                    dnskey.unwrap_or_else(|| panic!("No DNSKEY entry for zone {} in db", db_key));
                let dnskey = match dnskey_entry.rr_set {
                    RrSet::DNSKEY { mut rr_set } => {
                        rr_set.pop().expect("DNSKEY record set is empty")
                    }
                    _ => panic!("DNSKEY db entry did not contain a DNSKEY record"),
                };
                (dnskey_entry.name.clone(), dnskey)
            })
            .collect()
    })
}

/// Takes a list of zone names and gets all records of all zones, respectively, if a zone with the
/// given name exists. Also takes care of properly separating overlapping zones (e.g. records from
/// the a.example.com. zone don't appear in the example.com. zone).
///
/// The keys in the return value are in the same order as the zones in `names`.
#[instrument(skip(con))]
pub async fn get_zone_keys(
    zones: &[&Name],
    con: &mut Connection,
) -> PektinApiResult<Vec<Option<Vec<String>>>> {
    let available_zones = pektin_common::get_authoritative_zones(con).await?;

    // we ignore non-existing names for now and store None for them
    let mut zones_record_keys = Vec::with_capacity(zones.len());
    for name in zones {
        if available_zones.contains(&name.to_string()) {
            let glob = format!("*{}:*", name);
            let record_keys = con
                .keys::<_, Vec<String>>(glob)
                .await
                .map_err(PektinCommonError::from)?;
            zones_record_keys.push(Some(record_keys));
        } else {
            zones_record_keys.push(None);
        }
    }

    // TODO filter out DNSSEC records

    // if the queries contains one or more pairs of zones where one zone is a subzone of the
    // other (e.g. we have a SOA record for both example.com. and a.example.com.), we don't
    // want the records of the child zone (e.g. a.example.com.) to appear in the parent zone's
    // records (e.g. example.com.)
    for zone1 in available_zones.iter() {
        for zone2 in available_zones.iter() {
            if zone1 == zone2 {
                continue;
            }
            let name1 = Name::from_utf8(zone1).expect("Key in db is not a valid DNS name");
            let name2 = Name::from_utf8(zone2).expect("Key in db is not a valid DNS name");
            // remove all records that belong to zone2 (the child) from zone1's (the parent's) list
            if name1.zone_of(&name2) {
                if let Some((zone1_idx, _)) =
                    zones.iter().enumerate().find(|&(_, name)| *name == &name1)
                {
                    // this may also be none if the queried name was invalid
                    if let Some(record_keys) = zones_record_keys.get_mut(zone1_idx).unwrap() {
                        record_keys.retain(|record_key| {
                            let rec_name = record_key
                                .as_str()
                                .split_once(':')
                                .expect("Record key in db has invalid format")
                                .0;
                            let rec_name = Name::from_utf8(rec_name)
                                .expect("Record key in db is not a valid DNS name");
                            // keep element if...
                            !name2.zone_of(&rec_name)
                        });
                    }
                }
            }
        }
    }

    Ok(zones_record_keys)
}

impl RecordIdentifier {
    /// The key to use in db for this entry.
    pub fn db_key(&self) -> String {
        format!("{}:{:?}", self.name.to_lowercase(), self.rr_type)
    }

    /// Creates a `RecordIdentifier` from a db key.
    pub fn from_db_key(db_key: impl AsRef<str>) -> PektinApiResult<Self> {
        let (name, rr_type) = db_key
            .as_ref()
            .split_once(':')
            .ok_or(PektinApiError::InvalidDbKey)?;
        let name = Name::from_utf8(name).map_err(|_| PektinApiError::InvalidDbKey)?;
        // small hack so we can use serde_json to convert the rr type string to an RrType
        let rr_type = serde_json::from_str(&format!("\"{}\"", rr_type))
            .map_err(|_| PektinApiError::InvalidDbKey)?;
        Ok(Self { name, rr_type })
    }
}
