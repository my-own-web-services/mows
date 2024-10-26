use crate::{process_request, PektinResult};
use actix_cors::Cors;
use actix_web::dev::Server;
use actix_web::{get, post, web, App, HttpResponse, HttpServer};
use data_encoding::BASE64URL_NOPAD;
use pektin_common::deadpool_redis::Pool;
use pektin_common::proto::op::Message;
use serde::Deserialize;
use std::net::Ipv6Addr;

#[derive(Deserialize)]
struct GetQueries {
    dns: String,
}

struct AppState {
    pub db_pool: Pool,
    pub db_pool_dnssec: Pool,
}

pub async fn use_doh(
    bind_address: Ipv6Addr,
    bind_port: u16,
    db_pool: Pool,
    db_pool_dnssec: Pool,
) -> PektinResult<Server> {
    Ok(HttpServer::new(move || {
        App::new()
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allowed_header("content-type")
                    .allowed_methods(vec!["GET", "POST"]),
            )
            .app_data(web::Data::new(AppState {
                db_pool: db_pool.clone(),
                db_pool_dnssec: db_pool_dnssec.clone(),
            }))
            .service(doh_post)
            .service(doh_get)
    })
    .bind((bind_address, bind_port))?
    .run())
}

#[post("/dns-query")]
async fn doh_post(body: web::Bytes, state: web::Data<AppState>) -> HttpResponse {
    handle_request(&body, state).await
}

#[get("/dns-query")]
async fn doh_get(queries: web::Query<GetQueries>, state: web::Data<AppState>) -> HttpResponse {
    let query_bytes = match BASE64URL_NOPAD.decode(queries.dns.as_bytes()) {
        Ok(b) => b,
        Err(e) => {
            return HttpResponse::BadRequest()
                .content_type("application/dns-message")
                .body(format!("Invalid Base64: {e}"))
        }
    };
    handle_request(&query_bytes, state).await
}

async fn handle_request(bytes: &[u8], state: web::Data<AppState>) -> HttpResponse {
    let message = match Message::from_vec(bytes) {
        Ok(m) => m,
        Err(e) => {
            return HttpResponse::BadRequest()
                .content_type("application/dns-message")
                .body(format!("Invalid DNS message: {e}"))
        }
    };

    match process_request(message, state.db_pool.clone(), state.db_pool_dnssec.clone())
        .await
        .to_vec()
        .ok()
    {
        Some(bytes) => HttpResponse::Ok()
            .content_type("application/dns-message")
            .body(bytes),
        None => HttpResponse::InternalServerError()
            .content_type("application/dns-message")
            .body("Could not process request"),
    }
}
