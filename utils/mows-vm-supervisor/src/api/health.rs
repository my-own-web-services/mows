use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::state::SharedState;

pub fn router() -> Router<SharedState> {
    Router::new().route("/v1/healthz", get(healthz))
}

async fn healthz() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "mows-vm-supervisor",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
