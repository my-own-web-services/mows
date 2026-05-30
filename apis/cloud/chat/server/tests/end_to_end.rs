//! End-to-end integration test: full handler pipeline + WebSocket
//! round-trip exercised against a real running chat-server bound
//! to an ephemeral port.
//!
//! Skipped (printed notice + early return) when `CHAT_TEST_DB_URL`
//! isn't set. To opt in:
//!
//!     bash scripts/start-dev-db.sh
//!     CHAT_TEST_DB_URL='postgres://chat:chat@127.0.0.1:5433/chat' \
//!         cargo test --test end_to_end -- --nocapture
//!
//! What the test proves:
//!   1. Server boots + applies migrations.
//!   2. /api/dev/seed creates Alice + Bob.
//!   3. Alice creates a channel via REST.
//!   4. Bob without policy is denied (403) on /messages/send.
//!   5. Alice grants Bob ChannelsRead + ChannelsPost.
//!   6. Bob can now send a message — and a WS subscriber receives
//!      that message in realtime.
//!   7. The full engine pipeline (check_access +
//!      list_visible_resource_ids) is in play; this is the Phase 6
//!      "engine validated against a second consumer" exit gate.

use std::time::Duration;

use chat_server_lib::{api_router::build_api_router, state::AppState};
use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
use diesel_async::{AsyncConnection, AsyncPgConnection};
use diesel_migrations::MigrationHarness;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};
use utoipa_axum::router::OpenApiRouter;

const TEST_DB_ENV: &str = "CHAT_TEST_DB_URL";

#[tokio::test]
async fn end_to_end_demo_flow() {
    let Ok(db_url) = std::env::var(TEST_DB_ENV) else {
        eprintln!(
            "SKIP end_to_end_demo_flow: set {TEST_DB_ENV} to a reachable Postgres URL to run \
             (e.g. `bash scripts/start-dev-db.sh` + \
             `CHAT_TEST_DB_URL=postgres://chat:chat@127.0.0.1:5433/chat`)",
        );
        return;
    };

    // Wipe + re-apply migrations so the test starts from a clean
    // schema. Honest about the destructive intent: don't point
    // CHAT_TEST_DB_URL at anything you care about.
    reset_schema(&db_url).await;

    // Bring up the runtime + bind to an ephemeral port.
    std::env::set_var("DATABASE_URL", &db_url);
    std::env::set_var("ENABLE_DEV", "true");
    std::env::set_var("LISTEN_PORT", "0");
    // Override the config-loaded db_url (the config() OnceLock
    // reads DATABASE_URL on first access; we set it above).
    let state = AppState::new(&db_url)
        .await
        .expect("AppState::new failed");

    let router = build_api_router().with_state(state.clone());
    let (axum_router, _) = OpenApiRouter::split_for_parts(router);
    let axum_router = axum_router.layer(axum::middleware::from_fn_with_state(
        state,
        chat_server_lib::http_api::authentication::middleware::authentication_middleware,
    ));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral");
    let addr = listener.local_addr().expect("local_addr");
    let server_handle = tokio::spawn(async move {
        axum::serve(listener, axum_router).await.expect("axum::serve");
    });

    let base = format!("http://{addr}");
    let client = reqwest::Client::new();

    // 1. Seed Alice + Bob.
    let seed: serde_json::Value = client
        .post(format!("{base}/api/dev/seed"))
        .send()
        .await
        .expect("seed")
        .json()
        .await
        .expect("seed json");
    let alice = seed["data"]["alice_id"].as_str().unwrap().to_string();
    let bob = seed["data"]["bob_id"].as_str().unwrap().to_string();

    // 2. Alice creates a channel.
    let ch: serde_json::Value = client
        .post(format!("{base}/api/channels/create"))
        .header("x-chat-user-id", &alice)
        .json(&json!({"name": "demo", "topic": null}))
        .send()
        .await
        .expect("create channel")
        .json()
        .await
        .expect("channel json");
    let channel_id = ch["data"]["channel"]["id"].as_str().unwrap().to_string();

    // 3. Bob without policy is denied on send.
    let bob_denied = client
        .post(format!("{base}/api/channels/{channel_id}/messages/send"))
        .header("x-chat-user-id", &bob)
        .json(&json!({"body": "hi"}))
        .send()
        .await
        .expect("bob send");
    assert_eq!(bob_denied.status().as_u16(), 403, "bob should be denied");

    // 4. Alice grants Bob ChannelsRead + ChannelsPost.
    let _ = client
        .post(format!("{base}/api/access_policies/create"))
        .header("x-chat-user-id", &alice)
        .json(&json!({
            "name": "share-with-bob",
            "subject_type": "User",
            "subject_id": bob,
            "resource_type": "Channel",
            "resource_id": channel_id,
            "actions": ["ChannelsRead", "ChannelsPost"],
            "effect": "Allow",
        }))
        .send()
        .await
        .expect("grant")
        .error_for_status()
        .expect("policy 200");

    // 5. WebSocket: subscribe as Bob BEFORE sending so we can
    //    observe the realtime delivery.
    let ws_url = format!("ws://{addr}/api/channels/{channel_id}/live");
    let mut request = ws_url.into_client_request().expect("ws req");
    request
        .headers_mut()
        .insert("x-chat-user-id", bob.parse().unwrap());
    let (mut ws, _) = tokio_tungstenite::connect_async(request)
        .await
        .expect("ws connect");

    // Race-free handshake (review A4): the WS handler emits a
    // `{"kind":"ready"}` frame immediately after the broadcast
    // subscription is installed. Wait for that BEFORE the
    // publisher fires so the subscribe-vs-publish race window is
    // closed deterministically (no `sleep` needed).
    let ready_frame = tokio::time::timeout(Duration::from_secs(5), ws.next())
        .await
        .expect("ws ready timeout")
        .expect("ws stream ended before ready")
        .expect("ws ready frame");
    let ready_text = match ready_frame {
        Message::Text(t) => t.to_string(),
        other => panic!("expected ready Text frame, got {other:?}"),
    };
    let ready_event: serde_json::Value =
        serde_json::from_str(&ready_text).expect("ready frame json");
    assert_eq!(ready_event["kind"], "ready");

    // 6. Bob sends a message via REST.
    let send = client
        .post(format!("{base}/api/channels/{channel_id}/messages/send"))
        .header("x-chat-user-id", &bob)
        .json(&json!({"body": "hello realtime"}))
        .send()
        .await
        .expect("send");
    assert_eq!(send.status().as_u16(), 200, "send should succeed");

    // 7. The subscribed WS receives the message.
    let frame = tokio::time::timeout(Duration::from_secs(5), ws.next())
        .await
        .expect("ws recv timeout")
        .expect("ws stream ended")
        .expect("ws frame");
    let text = match frame {
        Message::Text(t) => t.to_string(),
        other => panic!("expected Text frame, got {other:?}"),
    };
    let event: serde_json::Value = serde_json::from_str(&text).expect("ws frame json");
    assert_eq!(event["kind"], "message");
    assert_eq!(event["message"]["body"], "hello realtime");
    assert_eq!(event["message"]["author_id"], bob);

    // 8. Revoke the policy — Bob loses access. Proves the
    //    lifecycle filter (`revoked = false`) is wired through
    //    list_visible + check + the engine fold. Review A12 /
    //    QA-4.
    let policies: serde_json::Value = client
        .post(format!("{base}/api/access_policies/list"))
        .header("x-chat-user-id", &alice)
        .send()
        .await
        .expect("list policies")
        .json()
        .await
        .expect("policies json");
    let policy_id = policies["data"]["policies"][0]["id"]
        .as_str()
        .expect("policy id");
    let revoke = client
        .delete(format!("{base}/api/access_policies/delete/{policy_id}"))
        .header("x-chat-user-id", &alice)
        .send()
        .await
        .expect("revoke");
    assert_eq!(revoke.status().as_u16(), 200, "revoke should succeed");

    let bob_after_revoke = client
        .post(format!("{base}/api/channels/{channel_id}/messages/send"))
        .header("x-chat-user-id", &bob)
        .json(&json!({"body": "should be denied"}))
        .send()
        .await
        .expect("bob after revoke");
    assert_eq!(
        bob_after_revoke.status().as_u16(),
        403,
        "lifecycle filter should re-deny bob after policy delete",
    );

    // 9. ServeDir path-traversal safety check (review A17 /
    //    SLOP-8): tower-http's ServeDir normalises `..` and
    //    returns 404; assert that contract.
    let traversal = client
        .get(format!("{base}/demo/..%2f..%2fetc%2fpasswd"))
        .send()
        .await
        .expect("traversal probe");
    assert_ne!(
        traversal.status().as_u16(),
        200,
        "ServeDir should refuse path-traversal requests",
    );

    // Cleanup.
    ws.send(Message::Close(None)).await.ok();
    server_handle.abort();
}

async fn reset_schema(db_url: &str) {
    use diesel::sql_query;
    use diesel_async::RunQueryDsl;

    // Production-safety guard (review A5 / QA-2): refuse to drop
    // the public schema unless the target is clearly a throw-
    // away local DB. A typo'd CHAT_TEST_DB_URL pointing at a
    // real instance should NOT silently destroy it.
    if !is_safe_test_database(db_url) {
        panic!(
            "REFUSING TO DROP SCHEMA: CHAT_TEST_DB_URL={db_url:?} doesn't look \
             like a local test DB. Test DB URLs must point at 127.0.0.1 or \
             localhost AND have a database name containing 'test' or 'chat'."
        );
    }

    let mut connection = AsyncPgConnection::establish(db_url)
        .await
        .expect("connect for reset");
    sql_query("DROP SCHEMA public CASCADE")
        .execute(&mut connection)
        .await
        .expect("drop schema");
    sql_query("CREATE SCHEMA public")
        .execute(&mut connection)
        .await
        .expect("create schema");
    let async_conn = AsyncPgConnection::establish(db_url)
        .await
        .expect("connect for migrations");
    let wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
        AsyncConnectionWrapper::from(async_conn);
    tokio::task::spawn_blocking(move || {
        let mut wrapper = wrapper;
        wrapper
            .run_pending_migrations(chat_server_lib::database::MIGRATIONS)
            .map(|_| ())
            .map_err(|e| format!("migrations: {e}"))
    })
    .await
    .expect("migrations join")
    .expect("migrations");
}

/// Heuristic for "this URL clearly points at a throwaway local
/// test database." We require BOTH the host to be localhost AND
/// the database name to look test-shaped, so a vanity rename of
/// either alone can't slip past the guard.
fn is_safe_test_database(db_url: &str) -> bool {
    let Ok(url) = url::Url::parse(db_url) else {
        return false;
    };
    let host_ok = matches!(url.host_str(), Some("127.0.0.1") | Some("::1") | Some("localhost"));
    let db_name = url.path().trim_start_matches('/').to_lowercase();
    let name_ok = db_name.contains("test") || db_name.contains("chat");
    host_ok && name_ok
}
