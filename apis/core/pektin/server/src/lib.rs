pub mod doh;
pub mod persistence;

use anyhow::{anyhow, bail, ensure, Context};
use futures_util::join;
use log::{error, info};
use pektin_common::deadpool_redis::redis::aio::Connection;
use pektin_common::deadpool_redis::Pool;
use pektin_common::proto::op::{Edns, Message, MessageType, Query, ResponseCode};
use pektin_common::proto::rr::{Name, RData, Record, RecordType};
use pektin_common::{get_authoritative_zones, DbEntry, RrSet};
use persistence::{get_rrset, get_rrsig, QueryResponse};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PektinError {
    #[error("{0}")]
    CommonError(#[from] pektin_common::PektinCommonError),
    #[error("db error")]
    DbError(#[from] pektin_common::deadpool_redis::redis::RedisError),
    #[error("could not create db connection pool: `{0}`")]
    PoolError(#[from] pektin_common::deadpool_redis::CreatePoolError),
    #[error("io error: `{0}`")]
    IoError(#[from] std::io::Error),
    #[error("could not (de)serialize JSON: `{0}`")]
    JsonError(#[from] serde_json::Error),
    #[error("invalid DNS data")]
    ProtoError(#[from] pektin_common::proto::error::ProtoError),
    #[error("data in db invalid")]
    InvalidDbData,
    #[error("requested db key had an unexpected type")]
    WickedDbValue,
    #[error("This is a bug, please report it: {0}")]
    Bug(&'static str),
}
pub type PektinResult<T> = Result<T, PektinError>;

/// Takes the given query message, processes it, and returns an appropriate response message.
pub async fn process_request(mut message: Message, db_pool: Pool, db_pool_dnssec: Pool) -> Message {
    let mut response = Message::new();
    response.set_id(message.id());
    response.set_message_type(MessageType::Response);
    response.set_op_code(message.op_code());
    response.set_recursion_desired(message.recursion_desired());
    response.set_recursion_available(false);
    response.set_authoritative(true);

    // only add EDNS to the response if it's present in the query message
    if message.extensions().is_some() {
        let mut edns = Edns::new();
        // TODO: think about payload size (see https://www.rfc-editor.org/rfc/rfc6891#section-6.2.5)
        edns.set_max_payload(4096);
        response.set_edns(edns);
    }

    if let Err(e) = process_request_internal(&mut response, &message, db_pool, db_pool_dnssec).await
    {
        error!("ServFail: {}", e);
        response.set_response_code(ResponseCode::ServFail);
        // drop any entries that might have already been added to the response
        response.answers_mut().clear();
        response.name_servers_mut().clear();
        response.additionals_mut().clear();
    }

    // echo back the query section in the response
    response.add_queries(message.take_queries().into_iter());

    response
}

/// Does most of the work for process_request(), but is allowed to return an error.
///
/// This error is logged in process_request(), and then a SERVFAIL response is returned.
async fn process_request_internal(
    response: &mut Message,
    message: &Message,
    db_pool: Pool,
    db_pool_dnssec: Pool,
) -> anyhow::Result<()> {
    if !validate_query_message(message) {
        info!("Received invalid message");
        response.set_response_code(ResponseCode::FormErr);
        return Ok(());
    }

    let (mut con, mut dnssec_con) = match join!(db_pool.get(), db_pool_dnssec.get()) {
        (Ok(c), Ok(db_c)) => (c, db_c),
        _ => {
            bail!("could not get db and dnssec db connection from pool");
        }
    };

    // TODO: check how to handle wildcards according to the relevant RFCs
    // (does a.b.example.com match *.example.com?)

    // validate_query_message() checks that there is exactly one query
    let query = message.queries().get(0).ok_or_else(|| {
        anyhow!("no query in message - validate_query_message() should have prevented this")
    })?;

    // try to find a matching answer (wildcard allowed).
    // keep track if we added an answer into the message (response.answer_count() doesn't
    // automatically update)
    let answers = find_answers(query, get_rrset, &mut con).await?;
    let answer_stored = !answers.is_empty();
    response.add_answers(answers);

    // if we found a matching answer and the DO flag is set, try to get the matching RRSIG entries
    let do_flag = message
        .extensions()
        .as_ref()
        .map(|edns| edns.dnssec_ok())
        .unwrap_or(false);
    if answer_stored && do_flag {
        let answers = find_answers(query, get_rrsig, &mut dnssec_con).await?;
        response.add_answers(answers);
    }

    // we haven't found a matching answer, therefore try to find the SOA record for the query's zone
    // and respond with that instead
    if !answer_stored {
        let mut authoritative_zones = get_authoritative_zones(&mut con)
            .await
            .context("Could not get authoritative zones")?
            .into_iter()
            .map(|zone| {
                Name::from_utf8(zone).map_err(|_| anyhow!("Name in db is not a valid DNS name"))
            })
            .collect::<Result<Vec<_>, _>>()?;
        // the - makes it sort the zones with the most labels first
        authoritative_zones.sort_by_key(|zone| -(zone.num_labels() as i16));

        let authoritative_zone = authoritative_zones
            .into_iter()
            .find(|zone| zone.zone_of(query.name()));

        if let Some(auth_zone) = authoritative_zone {
            add_soa_and_nsec3(
                response,
                query,
                auth_zone,
                do_flag,
                &mut con,
                &mut dnssec_con,
            )
            .await?;
        } else {
            // the query was for a zone we're not authoritative for
            response.set_response_code(ResponseCode::Refused);
        }
    }

    Ok(())
}

/// Checks that the given query is valid.
///
/// Returns true, if it valid, else false. A response to an invalid query should have a response
/// code of [`ResponseCode::FormErr`].
///
/// Currently, this only checks that it contains exactly one entry in the question section.
fn validate_query_message(query: &Message) -> bool {
    query.queries().len() == 1
}

/// Tries to find answers to the given query with the provided function.
async fn find_answers<'c, 'n, O, F>(
    query: &'n Query,
    get_fn: F,
    con: &'c mut Connection,
) -> PektinResult<Vec<Record>>
where
    O: futures_util::Future<Output = PektinResult<QueryResponse>>,
    F: Fn(&'c mut Connection, &'n Name, RecordType) -> O,
{
    let db_response = get_fn(con, query.name(), query.query_type()).await?;
    let db_entry = match db_response {
        QueryResponse::Empty => return Ok(vec![]),
        QueryResponse::Definitive(def) => def,
        QueryResponse::Wildcard(wild) => wild,
        QueryResponse::Both { definitive, .. } => definitive,
    };
    Ok(db_entry.convert()?)
}

/// Assumes the given query matched no known records. Adds the SOA record for the given zone to the
/// response, and if `do_flag` is true, also appropriate NSEC3 and RRSIG records.
async fn add_soa_and_nsec3(
    response: &mut Message,
    query: &Query,
    authoritative_zone: Name,
    do_flag: bool,
    con: &mut Connection,
    dnssec_con: &mut Connection,
) -> anyhow::Result<()> {
    // TODO: generate NSEC3 record and include it as well as its RRSIG record

    let db_response = get_rrset(con, &authoritative_zone, RecordType::SOA)
        .await
        .context("Could not get SOA record")?;

    let db_entry = match db_response {
        QueryResponse::Empty => bail!(PektinError::Bug(
            "No SOA record for a zone that we're supposedly authoritative for",
        )),
        QueryResponse::Definitive(def) => def,
        QueryResponse::Wildcard(wild) => wild,
        QueryResponse::Both { definitive, .. } => definitive,
    };
    let (ttl, mut rr_set) = match db_entry {
        DbEntry {
            rr_set: RrSet::SOA { rr_set },
            ttl,
            ..
        } => (ttl, rr_set),
        _ => bail!(PektinError::Bug(
            "DB response for SOA query gave non-SOA DbEntry",
        )),
    };

    ensure!(rr_set.len() == 1, "Expected exactly one SOA record");

    // get the name of the authoritative zone, preserving the case of the queried name
    let mut soa_name = query.name().clone();
    while soa_name.num_labels() != authoritative_zone.num_labels() {
        soa_name = soa_name.base_name();
    }
    let rr = Record::from_rdata(
        soa_name.clone(),
        ttl,
        RData::SOA(rr_set.pop().unwrap().value),
    );
    // the name is a bit misleading; this adds the record to the authority section
    response.add_name_server(rr);

    if do_flag {
        let rrsig = find_answers(
            &Query::query(soa_name, RecordType::SOA),
            get_rrsig,
            dnssec_con,
        )
        .await?;

        // the name is a bit misleading; this adds the records to the authority section
        response.add_name_servers(rrsig);
    }

    Ok(())
}
