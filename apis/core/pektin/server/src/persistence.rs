use pektin_common::deadpool_redis::redis::aio::Connection;
use pektin_common::deadpool_redis::redis::{AsyncCommands, FromRedisValue, Value};
use pektin_common::proto::rr::{Name, RecordType};
use pektin_common::DbEntry;

use crate::{PektinError, PektinResult};

pub enum QueryResponse {
    Empty,
    Definitive(DbEntry),
    Wildcard(DbEntry),
    Both {
        definitive: DbEntry,
        wildcard: DbEntry,
    },
}

// also automatically looks for a wildcard record
pub async fn get_rrset(
    con: &mut Connection,
    zone: &Name,
    rr_type: RecordType,
) -> PektinResult<QueryResponse> {
    let zone = zone.to_lowercase();
    let definitive_key = format!("{}:{}", zone, rr_type);
    let wildcard_key = format!("{}:{}", zone.clone().into_wildcard(), rr_type);
    get_definitive_or_wildcard_records(con, &definitive_key, &wildcard_key).await
}

pub async fn get_rrsig(
    con: &mut Connection,
    zone: &Name,
    rr_type: RecordType,
) -> PektinResult<QueryResponse> {
    let zone = zone.to_lowercase();
    let definitive_key = format!("{}:RRSIG:{}", zone, rr_type);
    let wildcard_key = format!("{}:RRSIG:{}", zone.clone().into_wildcard(), rr_type);
    get_definitive_or_wildcard_records(con, &definitive_key, &wildcard_key).await
}

async fn get_definitive_or_wildcard_records(
    con: &mut Connection,
    definitive_key: &str,
    wildcard_key: &str,
) -> PektinResult<QueryResponse> {
    let res: Vec<Value> = con.get(vec![definitive_key, wildcard_key]).await?;
    if res.len() != 2 {
        return Err(PektinError::InvalidDbData);
    }

    let string_res = (
        String::from_redis_value(&res[0]),
        String::from_redis_value(&res[1]),
    );

    Ok(match string_res {
        (Ok(def), Ok(wild)) => QueryResponse::Both {
            definitive: DbEntry::deserialize_from_db(&definitive_key, &def)?,
            wildcard: DbEntry::deserialize_from_db(&wildcard_key, &wild)?,
        },
        (Ok(def), Err(_)) => {
            if !matches!(res[1], Value::Nil) {
                return Err(PektinError::WickedDbValue);
            }
            QueryResponse::Definitive(DbEntry::deserialize_from_db(&definitive_key, &def)?)
        }
        (Err(_), Ok(wild)) => {
            if !matches!(res[0], Value::Nil) {
                return Err(PektinError::WickedDbValue);
            }
            QueryResponse::Wildcard(DbEntry::deserialize_from_db(&wildcard_key, &wild)?)
        }
        (Err(_), Err(_)) => {
            if !matches!(res[0], Value::Nil) || !matches!(res[1], Value::Nil) {
                return Err(PektinError::WickedDbValue);
            }
            QueryResponse::Empty
        }
    })
}
