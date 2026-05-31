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
    })
    .expect("from_config");
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
        // Identity header is required (review-3 R2); supply it so
        // the unknown-upstream branch is the one that fires.
        .header("x-realtime-user-id", "00000000-0000-0000-0000-000000000001")
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

/// review-3 R2 / SEC-2: anonymous requests must be refused at
/// the BFF layer. Without this guard the BFF would forward
/// anonymous explain queries and surface whatever the upstream
/// returned for Subject::Anonymous — useful as a fingerprinting
/// probe even if the upstream returns an empty evaluations
/// array.
#[tokio::test]
async fn explain_rejects_anonymous_caller_with_401() {
    let (mock_addr, mock_state) = spawn_mock_upstream().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/explain"))
        // No Authorization / x-realtime-user-id / x-filez-user-id.
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "action": "ChannelsList",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 401);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "Unauthorized");
    assert!(
        body["message"]
            .as_str()
            .unwrap_or("")
            .contains("identity header"),
        "error must explain the missing-identity reason, got: {body:?}",
    );

    // And critically the upstream must NOT have been called — if
    // it was, the BFF leaked a fingerprinting opportunity even
    // though the response was 401.
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(
        seen.is_none(),
        "BFF must not call upstream on anonymous request; mock saw: {seen:?}",
    );
}

/// review-3 R11 / QA-3 (c): the BFF must surface a non-2xx
/// upstream response as `upstream_status` instead of swallowing
/// it. The frontend renders that status alongside the (likely
/// empty) evaluations so the operator sees "the upstream said
/// 401, not 'no policies match.'"
#[tokio::test]
async fn explain_surfaces_upstream_401_under_upstream_status() {
    let mock_state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route(
            "/api/access_policies/explain",
            post(|axum::Json(_): axum::Json<Value>| async {
                (
                    axum::http::StatusCode::UNAUTHORIZED,
                    axum::Json(json!({
                        "status": {"Error": "Unauthorized"},
                        "message": "session expired",
                        "data": null
                    })),
                )
            }),
        )
        .with_state(mock_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;

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
    // BFF itself returns 200 — it succeeded at forwarding. The
    // upstream's 401 lives inside upstream_status.
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_status"], 401);
    assert_eq!(
        body["data"]["upstream_body"]["message"],
        "session expired",
        "the BFF must surface the upstream envelope verbatim",
    );
}

/// review-3 R11 / QA-4 (a): a request missing one of the
/// required fields must come back as 400 cleanly, not 500.
#[tokio::test]
async fn explain_rejects_missing_required_field() {
    let (mock_addr, _) = spawn_mock_upstream().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/explain"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        // Omits `action`.
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("body parse"),
        "error should be a body-parse failure, got: {body:?}",
    );
}

// ---------------------------------------------------------------
// by_resource — Phase 7 "Who can see X?" forwarder. Same shape as
// the explain tests; deliberately verbose rather than parameterised
// so each test name documents one contract that ships.
// ---------------------------------------------------------------

async fn mock_by_resource(
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
        "message": "mocked by_resource",
        "data": {
            "resource_owner_id": "a11ce000-0000-0000-0000-000000000001",
            "policies": [
                {
                    "id": "00000000-0000-0000-0000-000000000099",
                    "subject_type": "User",
                    "subject_id": "b0b00000-0000-0000-0000-000000000002",
                    "effect": "Allow",
                    "actions": ["ChannelsRead"]
                }
            ]
        }
    }))
}

async fn spawn_mock_with_by_resource() -> (SocketAddr, MockState) {
    let state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route("/api/access_policies/explain", post(mock_explain))
        .route("/api/access_policies/by_resource", post(mock_by_resource))
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        axum::serve(listener, router).await.expect("mock serve");
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    (addr, state)
}

#[tokio::test]
async fn by_resource_forwards_identity_header_and_returns_policies() {
    let (mock_addr, mock_state) = spawn_mock_with_by_resource().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000042",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");

    assert_eq!(body["data"]["upstream"], "realtime");
    assert_eq!(body["data"]["upstream_status"], 200);
    // Wire shape — the SPA reads exactly these keys.
    let upstream_data = &body["data"]["upstream_body"]["data"];
    assert_eq!(
        upstream_data["resource_owner_id"],
        "a11ce000-0000-0000-0000-000000000001",
    );
    let policies = upstream_data["policies"]
        .as_array()
        .expect("policies array");
    assert_eq!(policies.len(), 1);
    assert_eq!(policies[0]["subject_type"], "User");

    let seen = mock_state.last_user_header.lock().await.clone();
    assert_eq!(seen.as_deref(), Some("a11ce000-0000-0000-0000-000000000001"));
}

#[tokio::test]
async fn by_resource_rejects_anonymous_caller_with_401() {
    let (mock_addr, mock_state) = spawn_mock_with_by_resource().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000042",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 401);

    // Same anti-fingerprinting check as explain: the upstream must
    // not have been touched at all on an anonymous request.
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(
        seen.is_none(),
        "BFF must not call upstream on anonymous by_resource; mock saw: {seen:?}",
    );
}

#[tokio::test]
async fn by_resource_rejects_unknown_upstream_with_typed_error() {
    let (mock_addr, _) = spawn_mock_with_by_resource().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .header("x-realtime-user-id", "00000000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "ghost",
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000042",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("ghost"),
        "error message should name the offending upstream key, got: {body:?}",
    );
}

#[tokio::test]
async fn by_resource_surfaces_upstream_403_under_upstream_status() {
    // Upstream returns 403 (the canonical "no such resource OR not
    // your resource" collapse). BFF itself must reply 200 with the
    // 403 surfaced via upstream_status so the SPA can render
    // "the upstream said 403" rather than misreporting "no
    // policies".
    let mock_state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route(
            "/api/access_policies/by_resource",
            post(|axum::Json(_): axum::Json<Value>| async {
                (
                    axum::http::StatusCode::FORBIDDEN,
                    axum::Json(json!({
                        "status": {"Error": "Forbidden"},
                        "message": "no such resource, or caller is not its owner",
                        "data": null
                    })),
                )
            }),
        )
        .with_state(mock_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;

    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000042",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_status"], 403);
    assert!(
        body["data"]["upstream_body"]["message"]
            .as_str()
            .unwrap_or("")
            .contains("no such resource"),
        "the BFF must surface the upstream's 403 envelope verbatim, got: {body:?}",
    );
}

#[tokio::test]
async fn by_resource_rejects_invalid_uuid_with_400() {
    // Review R9 — BFF parses resource_id as Uuid, so a non-UUID
    // input fails at deserialization (clean 400) instead of being
    // forwarded as a String and 500-ing on the upstream's parse.
    let (mock_addr, mock_state) = spawn_mock_with_by_resource().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "not-a-uuid",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("body parse"),
        "expected a body-parse failure naming the bad uuid, got: {body:?}",
    );
    // Critical: the upstream must NOT have been touched. A malformed
    // request is rejected at the BFF without burning an upstream
    // call.
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(
        seen.is_none(),
        "BFF must not call upstream when resource_id parsing fails; mock saw: {seen:?}",
    );
}

#[tokio::test]
async fn by_resource_rejects_oversize_body() {
    // Review R2 / QA-1 — the shared `read_bounded_body` 16 KB cap
    // must also fire on the by_resource path. Sibling of
    // `explain_rejects_oversize_body`; we keep both even though the
    // forwarder code is shared, because a future refactor that
    // moves body-reading into per-endpoint layers would otherwise
    // regress by_resource silently.
    let (mock_addr, _) = spawn_mock_with_by_resource().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let huge_resource_type = "x".repeat(64 * 1024); // 64 KB > 16 KB cap
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": huge_resource_type,
            "resource_id": "00000000-0000-0000-0000-000000000042",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("body read"),
        "expected a body-read error, got: {body:?}",
    );
}

#[tokio::test]
async fn by_resource_rejects_missing_required_field() {
    let (mock_addr, _) = spawn_mock_with_by_resource().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/by_resource"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        // Omits `resource_id`.
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("body parse"),
        "error should be a body-parse failure, got: {body:?}",
    );
}

// ---------------------------------------------------------------
// audit_log/list — Phase 7 audit-log timeline forwarder. Same shape
// as the explain + by_resource forwarders. Deliberately verbose
// per-test so each name documents one shipped contract.
// ---------------------------------------------------------------

async fn mock_audit_log(
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
        "message": "mocked audit_log",
        "data": {
            "entries": [
                {
                    "id": "00000000-0000-0000-0000-000000000099",
                    "event_type": "channel_created",
                    "actor_id": "a11ce000-0000-0000-0000-000000000001",
                    "resource_type": "Channel",
                    "resource_id": "00000000-0000-0000-0000-000000000042",
                    "ts": "2026-05-31T12:00:00",
                    "metadata": { "name": "team-room" }
                }
            ],
            "next_cursor": null
        }
    }))
}

async fn spawn_mock_with_audit_log() -> (SocketAddr, MockState) {
    let state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route("/api/access_policies/explain", post(mock_explain))
        .route("/api/audit_log/list", post(mock_audit_log))
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        axum::serve(listener, router).await.expect("mock serve");
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    (addr, state)
}

#[tokio::test]
async fn audit_log_forwards_identity_header_and_returns_entries() {
    let (mock_addr, mock_state) = spawn_mock_with_audit_log().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000042",
            "limit": 25
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream"], "realtime");
    assert_eq!(body["data"]["upstream_status"], 200);
    let entries = body["data"]["upstream_body"]["data"]["entries"]
        .as_array()
        .expect("entries array");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0]["event_type"], "channel_created");
    assert_eq!(entries[0]["metadata"]["name"], "team-room");
    // The identity header reached the upstream — proves the
    // forwarder's whitelist is wired the same way as explain +
    // by_resource (the shared http_api::forwarder helpers).
    let seen = mock_state.last_user_header.lock().await.clone();
    assert_eq!(seen.as_deref(), Some("a11ce000-0000-0000-0000-000000000001"));
}

#[tokio::test]
async fn audit_log_rejects_anonymous_caller_with_401() {
    let (mock_addr, mock_state) = spawn_mock_with_audit_log().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .json(&json!({"upstream": "realtime"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 401);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(
        seen.is_none(),
        "BFF must not call upstream on anonymous audit_log; mock saw: {seen:?}",
    );
}

#[tokio::test]
async fn audit_log_rejects_unknown_upstream_with_400() {
    let (mock_addr, _) = spawn_mock_with_audit_log().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .header("x-realtime-user-id", "00000000-0000-0000-0000-000000000001")
        .json(&json!({"upstream": "ghost"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert!(
        body["message"].as_str().unwrap_or("").contains("ghost"),
        "error message should name the offending upstream key, got: {body:?}",
    );
}

#[tokio::test]
async fn audit_log_rejects_invalid_resource_id_with_400() {
    // Same R9 stance as by_resource — UUID parse fails at the BFF
    // deserializer, never reaches the upstream.
    let (mock_addr, mock_state) = spawn_mock_with_audit_log().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "not-a-uuid"
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(seen.is_none(), "BFF must not call upstream when resource_id parse fails");
}

// ---------------------------------------------------------------
// granted_apps + revoke_by_app — Phase 7 App-revocation panel
// forwarders. Same shape as the others; per-test verbosity keeps
// each name documenting one shipped contract.
// ---------------------------------------------------------------

async fn mock_granted_apps(
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
        "message": "mocked granted_apps",
        "data": {
            "apps": [
                { "app_id": "00000000-0000-0000-0000-000000000099", "policy_count": 3 }
            ]
        }
    }))
}

async fn mock_revoke_by_app(
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
        "message": "mocked revoke_by_app",
        "data": { "revoked_count": 3 }
    }))
}

async fn spawn_mock_with_app_revocation() -> (SocketAddr, MockState) {
    let state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route("/api/access_policies/granted_apps/list", post(mock_granted_apps))
        .route("/api/access_policies/revoke_by_app", post(mock_revoke_by_app))
        .with_state(state.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("local_addr");
    tokio::spawn(async move {
        axum::serve(listener, router).await.expect("mock serve");
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    (addr, state)
}

#[tokio::test]
async fn granted_apps_forwards_identity_header_and_returns_apps_array() {
    let (mock_addr, mock_state) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/granted_apps/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({"upstream": "realtime"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    let apps = body["data"]["upstream_body"]["data"]["apps"]
        .as_array()
        .expect("apps array");
    assert_eq!(apps.len(), 1);
    assert_eq!(apps[0]["policy_count"], 3);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert_eq!(seen.as_deref(), Some("a11ce000-0000-0000-0000-000000000001"));
}

#[tokio::test]
async fn granted_apps_rejects_anonymous_with_401_without_calling_upstream() {
    let (mock_addr, mock_state) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/granted_apps/list"))
        .json(&json!({"upstream": "realtime"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 401);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(seen.is_none(), "BFF must not call upstream on anonymous granted_apps");
}

#[tokio::test]
async fn revoke_by_app_forwards_uuid_and_returns_revoked_count() {
    let (mock_addr, mock_state) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/revoke_by_app"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "context_app_id": "00000000-0000-0000-0000-000000000042"
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_body"]["data"]["revoked_count"], 3);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert_eq!(seen.as_deref(), Some("a11ce000-0000-0000-0000-000000000001"));
}

#[tokio::test]
async fn revoke_by_app_rejects_invalid_uuid_with_400() {
    let (mock_addr, mock_state) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/revoke_by_app"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({"upstream": "realtime", "context_app_id": "not-a-uuid"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(seen.is_none(), "BFF must not call upstream when context_app_id parse fails");
}

#[tokio::test]
async fn revoke_by_app_rejects_anonymous_with_401_without_calling_upstream() {
    let (mock_addr, mock_state) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/revoke_by_app"))
        .json(&json!({
            "upstream": "realtime",
            "context_app_id": "00000000-0000-0000-0000-000000000042"
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 401);
    let seen = mock_state.last_user_header.lock().await.clone();
    assert!(seen.is_none(), "BFF must not call upstream on anonymous revoke");
}

#[tokio::test]
async fn granted_apps_rejects_unknown_upstream_with_400() {
    // Review R3 / QA-1 — parity with the other forwarders.
    let (mock_addr, _) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/granted_apps/list"))
        .header("x-realtime-user-id", "00000000-0000-0000-0000-000000000001")
        .json(&json!({"upstream": "ghost"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert!(
        body["message"].as_str().unwrap_or("").contains("ghost"),
        "error must name the offending upstream key, got: {body:?}",
    );
}

#[tokio::test]
async fn revoke_by_app_rejects_unknown_upstream_with_400() {
    let (mock_addr, _) = spawn_mock_with_app_revocation().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/revoke_by_app"))
        .header("x-realtime-user-id", "00000000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "ghost",
            "context_app_id": "00000000-0000-0000-0000-000000000042"
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert!(
        body["message"].as_str().unwrap_or("").contains("ghost"),
        "error must name the offending upstream key, got: {body:?}",
    );
}

#[tokio::test]
async fn granted_apps_surfaces_upstream_500_under_upstream_status() {
    // Review R3 / QA-1 — same pattern as the other forwarders'
    // upstream-error tests. The BFF returns 200 with the
    // upstream's 500 surfaced via upstream_status so the SPA
    // renders a real error instead of misreporting "no apps".
    let mock_state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route(
            "/api/access_policies/granted_apps/list",
            post(|axum::Json(_): axum::Json<Value>| async {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    axum::Json(json!({
                        "status": {"Error": "InternalServerError"},
                        "message": "DB unreachable",
                        "data": null
                    })),
                )
            }),
        )
        .with_state(mock_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/granted_apps/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({"upstream": "realtime"}))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_status"], 500);
}

#[tokio::test]
async fn revoke_by_app_surfaces_upstream_500_under_upstream_status() {
    let mock_state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route(
            "/api/access_policies/revoke_by_app",
            post(|axum::Json(_): axum::Json<Value>| async {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    axum::Json(json!({
                        "status": {"Error": "InternalServerError"},
                        "message": "DB unreachable",
                        "data": null
                    })),
                )
            }),
        )
        .with_state(mock_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/revoke_by_app"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "context_app_id": "00000000-0000-0000-0000-000000000042"
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_status"], 500);
}

#[tokio::test]
async fn audit_log_surfaces_upstream_403_when_caller_is_not_owner() {
    // Review R3 / QA-1 — the upstream's owner-gate collapses
    // not-found + not-owner into a single 403. The BFF must
    // surface that as `upstream_status=403` so the SPA can render
    // "the upstream said 403". A regression that silently swallowed
    // the 403 would let the SPA misreport "no entries" — confusing
    // the operator into thinking the resource has no audit trail.
    let mock_state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route(
            "/api/audit_log/list",
            post(|axum::Json(_): axum::Json<Value>| async {
                (
                    axum::http::StatusCode::FORBIDDEN,
                    axum::Json(json!({
                        "status": {"Error": "Forbidden"},
                        "message": "no such resource, or caller is not its owner",
                        "data": null
                    })),
                )
            }),
        )
        .with_state(mock_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;

    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000042"
        }))
        .send()
        .await
        .expect("send");
    // BFF itself returns 200 — it succeeded at forwarding. The
    // upstream's 403 lives inside upstream_status, with the
    // verbatim envelope under upstream_body.
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_status"], 403);
    assert!(
        body["data"]["upstream_body"]["message"]
            .as_str()
            .unwrap_or("")
            .contains("no such resource"),
        "the BFF must surface the upstream's 403 envelope verbatim, got: {body:?}",
    );
}

#[tokio::test]
async fn audit_log_surfaces_upstream_400_on_partial_scope() {
    // Review R11 / QA-4 — the upstream rejects (resource_type
    // without resource_id) and the inverse with a 400. The BFF
    // forwards the call (it has no opinion on the upstream's
    // validation logic); we pin that the 400 surfaces under
    // upstream_status so the SPA renders the right error
    // instead of treating it as "no results".
    let mock_state = MockState::default();
    let router = Router::new()
        .route("/api/health", get(mock_health))
        .route(
            "/api/audit_log/list",
            post(|axum::Json(_): axum::Json<Value>| async {
                (
                    axum::http::StatusCode::BAD_REQUEST,
                    axum::Json(json!({
                        "status": {"Error": "BadRequest"},
                        "message": "resource_type and resource_id must be supplied together",
                        "data": null
                    })),
                )
            }),
        )
        .with_state(mock_state);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let mock_addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;

    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel"
            // resource_id deliberately omitted
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["data"]["upstream_status"], 400);
    assert!(
        body["data"]["upstream_body"]["message"]
            .as_str()
            .unwrap_or("")
            .contains("resource_type and resource_id"),
        "the BFF must surface the upstream's 400 message verbatim, got: {body:?}",
    );
}

#[tokio::test]
async fn audit_log_rejects_oversize_body() {
    let (mock_addr, _) = spawn_mock_with_audit_log().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let huge_cursor = "x".repeat(64 * 1024);
    let resp = client
        .post(format!("http://{bff_addr}/api/audit_log/list"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "cursor": huge_cursor
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert!(
        body["message"].as_str().unwrap_or("").contains("body read"),
        "expected body-read error, got: {body:?}",
    );
}

/// review-3 R11 / QA-4 (c): the inbound body cap should fire on
/// payloads above `MAX_BODY_BYTES` (16 KB today). A request
/// shaped like a tiny JSON object but with megabytes of padding
/// is a misbehaving client; the BFF refuses without buffering
/// the whole thing.
#[tokio::test]
async fn explain_rejects_oversize_body() {
    let (mock_addr, _) = spawn_mock_upstream().await;
    let bff_addr = spawn_bff(format!("http://{mock_addr}")).await;

    let client = reqwest::Client::new();
    let huge_action = "x".repeat(64 * 1024); // 64 KB > 16 KB cap
    let resp = client
        .post(format!("http://{bff_addr}/api/access_policies/explain"))
        .header("x-realtime-user-id", "a11ce000-0000-0000-0000-000000000001")
        .json(&json!({
            "upstream": "realtime",
            "resource_type": "Channel",
            "action": huge_action,
        }))
        .send()
        .await
        .expect("send");
    assert_eq!(resp.status().as_u16(), 400);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["status"]["Error"], "BadRequest");
    assert!(
        body["message"].as_str().unwrap_or("").contains("body read"),
        "expected a body-read error, got: {body:?}",
    );
}
