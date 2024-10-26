use std::str::FromStr;

use actix_web::{post, web, HttpResponse, Responder};
use pektin_common::proto::rr::{
    dnssec::{rdata::SIG, tbs::rrset_tbs_with_sig, Algorithm},
    DNSClass, Name, RData, Record, RecordType,
};

use crate::{
    errors_and_responses::{auth_err, internal_err},
    types::AppState,
    vault::{login_userpass, sign_with_vault},
};

#[post("/sign")]
pub async fn sign(state: web::Data<AppState>) -> impl Responder {
    let name = Name::from_ascii("pektin.club.").unwrap();
    // TODO this must be the name of the zone
    let signer_name = name.clone();

    let record_tbs = Record::new()
        .set_name(name.clone())
        .set_ttl(3600)
        .set_rr_type(RecordType::AAAA)
        .set_dns_class(DNSClass::IN)
        .set_data(Some(RData::AAAA(
            std::net::Ipv6Addr::from_str("1::1").unwrap(),
        )))
        .clone();

    let sig_valid_from = chrono::Utc::now();
    let sig_valid_until = sig_valid_from + chrono::Duration::minutes(5);
    let sig = SIG::new(
        RecordType::AAAA,
        Algorithm::ECDSAP256SHA256,
        name.num_labels(),
        record_tbs.ttl(),
        sig_valid_until.timestamp() as _,
        sig_valid_from.timestamp() as _,
        // if we had a dnskey we could use `dnskey.calculate_key_tag().unwrap()`
        0,
        signer_name.clone(),
        vec![],
    );

    let records_tbs = vec![record_tbs];
    let tbs = rrset_tbs_with_sig(&name, DNSClass::IN, &sig, &records_tbs).unwrap();
    dbg!(tbs.as_ref());
    let vault_token = match login_userpass(
        &state.vault_uri,
        &state.vault_user_name,
        &state.vault_password,
    )
    .await
    {
        Ok(token) => token,
        // TODO do we want to leave this as auth_err()?
        Err(e) => return auth_err(e.to_string()),
    };
    let signature = match sign_with_vault(&tbs, &signer_name, &state.vault_uri, &vault_token).await
    {
        Ok(sig) => sig,
        Err(e) => return internal_err(e.to_string()),
    };
    let sig = sig.set_sig(signature);

    HttpResponse::Ok().body(serde_json::to_string_pretty(&sig).unwrap())
}
