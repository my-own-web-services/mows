//! Integration test for the authz-admin BFF.
//!
//! Spins up two ephemeral axum servers:
//!
//!   1. The "mock realtime" upstream — a single
//!      `POST /api/access_policies/explain` handler that asserts
//!      it received the dev `x-realtime-user-id` header and
//!      echoes a canned response. A `GET /api/health` companion
//!      so the BFF's reachability probe passes.
//!
//!   2. The authz-admin BFF itself, pointed at the mock as its
//!      sole upstream.
//!
//! Then exercises three contracts the rest of Phase 7 depends on:
//!
//!   * `GET /api/upstreams` reports the mock as `reachable=true`
//!     when its health passes, and `reachable=false` after we
//!     stop responding (caught structurally by hitting an
//!     unrelated port).
//!   * `POST /api/access_policies/explain` forwards the dev
//!     identity header through and returns the upstream body
//!     verbatim.
//!   * Unknown-upstream → 400 with the typed error envelope.

use std::net::SocketAddr;
use std::time::Duration;

use axum::extract::State;
use axum::routing::{get, post};
use axum::Router;
use serde_json::{json, Value};

use authz_admin_server_lib::{
    api_router::build_api_router, state::AppState, upstream::Registry,
};

/// Shared between the mock upstream's handlers via axum's State.
#[derive(Clone, Default)]
struct MockState {
    last_user_header: std::sync::Arc<tokio::sync::Mutex<Option<String>>>,
}

async fn mock_health() -> axum::Json<Value> {
    axum::Json(json!({"status":"Success","message":"ok","data":{"status":"ok"}}))
}

async fn mock_explain(
    State(state): State<MockState>,
    headers: axum::http::HeaderMap,
    axum::Json(_body): axum::Json<Value>,
) -> axum::Json<Value> {
    let uid = headers
        .get("x-realtime-user-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    *state.last_user_header.lock().await = uid.clone();
    axum::Json(json!({
        "status": "Success",
        "message": "mocked",
        "data": {
            "evaluations": [
                {
                    "resource_id": "00000000-0000-0000-0000-000000000001",
                    "is_allowed": true,
                    "reason": "Owned"
                }
            ]
        }
    }))
}

async fn spawn_mock_upstream() -> (SocketAddr, MockState) {
    let state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route("/api/access_policies/explain", post(mock_explain))
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        axum::serve(listener, router).await.expect("mock serve");
    });
    // Give axum a tick to start accepting; reqwest's first connect
    // is immediate so we don't need a `wait_for_ready` loop.
    tokio::time::sleep(Duration::from_millis(50)).await;
    (addr, state)
}

async fn spawn_bff(realtime_url: String) -> SocketAddr {
    let registry = Registry::from_config(&authz_admin_server_lib::config::AuthzAdminConfig {
        listen_port: 0,
        bind_address: "127.0.0.1".to_string(),
        realtime_base_url: realtime_url,
        filez_base_url: String::new(),
    });
    let state = AppState::new(registry).expect("AppState::new");
    let router = build_api_router().with_state(state);
    let (axum_router, _) = utoipa_axum::router::OpenApiRouter::split_for_parts(router);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind bff");
    let addr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        axum::serve(listener, axum_router).await.expect("bff serve");
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    addr
}

#[tokio::test]
async fn upstreams_endpoint_probes_reachability() {
    let (mock_addr, _state) = spawn_mock_upstream().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp: Value = client
        .get(format!("http://{bff_addr}/api/upstreams"))
        .send()
        .await
        .expect("send")
        .json()
        .await
        .expect("json");
    let ups = resp["data"]["upstreams"].as_array().expect("upstreams array");
    assert_eq!(ups.len(), 1);
    assert_eq!(ups[0]["key"], "realtime");
    assert_eq!(ups[0]["reachable"], true, "mock with /api/health must probe as reachable");
}

#[tokio::test]
async fn upstreams_endpoint_marks_unreachable_when_mock_is_down() {
    // No mock — point the BFF at a port nothing is listening on.
    // Pick a high-numbered port unlikely to clash in CI.
    let bff_addr = spawn_bff("http://127.0.0.1:1".to_string()).await;

    let client = reqwest::Client::new();
    let resp: Value = client
        .get(format!("http://{bff_addr}/api/upstreams"))
        .send()
        .await
        .expect("send")
        .json()
        .await
        .expect("json");
    let ups = resp["data"]["upstreams"].as_array().expect("upstreams array");
    assert_eq!(ups.len(), 1);
    assert_eq!(ups[0]["reachable"], false);
}

#[tokio::test]
async fn explain_forwards_identity_header_and_body_verbatim() {
    let (mock_addr, mock_state) = spawn_mock_upstream().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/explain"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "action": "ChannelsList",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");

    assert_eq!(body["data"]["upstream"], "realtime");
    assert_eq!(body["data"]["upstream_status"], 200);
    // The mock's reply is surfaced verbatim under upstream_body.
    let evals = body["data"]["upstream_body"]["data"]["evaluations"]
        .as_array()
        .expect("evaluations");
    assert_eq!(evals.len(), 1);
    assert_eq!(evals[0]["reason"], "Owned");

    // The dev identity header reached the upstream — proves the
    // BFF's whitelist passthrough works for this header name.
    let seen = mock_state.last_user_header.lock().await.clone();
    assert_eq!(seen.as_deref(), Some("a11ce000-0000-0000-0000-000000000001"));
}

#[tokio::test]
async fn explain_rejects_unknown_upstream_with_typed_error() {
    let (mock_addr, _) = spawn_mock_upstream().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/explain"))
        .json(&json!({
            "upstream": "ghost",
            "resource_type": "Channel",
            "action": "ChannelsList",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    // Envelope shape: { status: { Error: "BadRequest" }, message: "...", data: null }
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("ghost"),
        "error message should name the offending upstream key, got: {body:?}",
    );
}
