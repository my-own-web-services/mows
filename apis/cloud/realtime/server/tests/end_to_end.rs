//! End-to-end integration test: full handler pipeline + WebSocket
//! round-trip exercised against a real running realtime-server bound
//! to an ephemeral port.
//!
//! Skipped (printed notice + early return) when `REALTIME_TEST_DB_URL`
//! isn't set. To opt in:
//!
//!     bash scripts/start-dev-db.sh
//!     REALTIME_TEST_DB_URL='postgres://chat:chat@127.0.0.1:5433/chat' \
//!         cargo test --test end_to_end -- --nocapture
//!
//! What the test proves:
//!   1. Server boots + applies migrations.
//!   2. /api/dev/seed creates Alice + Bob.
//!   3. Alice creates a channel via REST.
//!   4. Bob without policy is denied (403) on /events/publish.
//!   5. Alice grants Bob ChannelsRead + ChannelsPublish.
//!   6. Bob can now publish an event — and a WS subscriber receives
//!      that event in realtime, wrapped in a `ChannelFrame::Event`.
//!   7. The full engine pipeline (check_access +
//!      list_visible_resource_ids) is in play; this is the Phase 6
//!      "engine validated against a second consumer" exit gate.

use std::time::Duration;

use realtime_server_lib::{api_router::build_api_router, errors::AuthResultExt, state::AppState};
use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
use diesel_async::{AsyncConnection, AsyncPgConnection};
use diesel_migrations::MigrationHarness;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};
use utoipa_axum::router::OpenApiRouter;

const TEST_DB_ENV: &str = "REALTIME_TEST_DB_URL";

#[tokio::test]
async fn end_to_end_demo_flow() {
    let Ok(db_url) = std::env::var(TEST_DB_ENV) else {
        eprintln!(
            "SKIP end_to_end_demo_flow: set {TEST_DB_ENV} to a reachable Postgres URL to run \
             (e.g. `bash scripts/start-dev-db.sh` + \
             `REALTIME_TEST_DB_URL=postgres://chat:chat@127.0.0.1:5433/chat`)",
        );
        return;
    };

    // Wipe + re-apply migrations so the test starts from a clean
    // schema. Honest about the destructive intent: don't point
    // REALTIME_TEST_DB_URL at anything you care about.
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
    // Extra clone for the Round 7 section, which goes around the
    // HTTP surface and hits the database / engine directly. Has to
    // happen here because the original `state` is moved into the
    // middleware layer below.
    let state_for_round_7 = state.clone();

    let router = build_api_router().with_state(state.clone());
    let (axum_router, _) = OpenApiRouter::split_for_parts(router);
    let axum_router = axum_router.layer(axum::middleware::from_fn_with_state(
        state,
        realtime_server_lib::http_api::authentication::middleware::authentication_middleware,
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
        .header("x-realtime-user-id", &alice)
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
        .post(format!("{base}/api/channels/{channel_id}/events/publish"))
        .header("x-realtime-user-id", &bob)
        .json(&json!({"event_kind": "chat.message", "payload": {"body": "hi"}}))
        .send()
        .await
        .expect("bob send");
    assert_eq!(bob_denied.status().as_u16(), 403, "bob should be denied");

    // 4. Alice grants Bob ChannelsRead + ChannelsPublish.
    let _ = client
        .post(format!("{base}/api/access_policies/create"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({
            "name": "share-with-bob",
            "subject_type": "User",
            "subject_id": bob,
            "resource_type": "Channel",
            "resource_id": channel_id,
            "actions": ["ChannelsRead", "ChannelsPublish"],
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
        .insert("x-realtime-user-id", bob.parse().unwrap());
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
        .post(format!("{base}/api/channels/{channel_id}/events/publish"))
        .header("x-realtime-user-id", &bob)
        .json(&json!({"event_kind": "chat.message", "payload": {"body": "hello realtime"}}))
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
    let frame_json: serde_json::Value =
        serde_json::from_str(&text).expect("ws frame json");
    assert_eq!(frame_json["kind"], "event");
    assert_eq!(frame_json["event"]["event_kind"], "chat.message");
    assert_eq!(frame_json["event"]["payload"]["body"], "hello realtime");
    assert_eq!(frame_json["event"]["author_id"], bob);

    // 7b. Input-validation regression suite (review C5). Alice
    // is the channel owner so all of these come back as 400, not
    // 403 — we're pinning the input contracts, not authz.

    // B8: oversize event_kind (filter) is rejected.
    let kind_too_long = "k".repeat(65);
    let oversize_filter = client
        .get(format!(
            "{base}/api/channels/{channel_id}/events?event_kind={kind_too_long}"
        ))
        .header("x-realtime-user-id", &alice)
        .send()
        .await
        .expect("list events oversize filter");
    assert_eq!(
        oversize_filter.status().as_u16(),
        400,
        "list_events should reject event_kind > 64 chars",
    );

    // B8: empty event_kind (filter) is rejected.
    let empty_filter = client
        .get(format!("{base}/api/channels/{channel_id}/events?event_kind="))
        .header("x-realtime-user-id", &alice)
        .send()
        .await
        .expect("list events empty filter");
    assert_eq!(
        empty_filter.status().as_u16(),
        400,
        "list_events should reject empty event_kind",
    );

    // B8: oversize event_kind on publish is rejected.
    let publish_kind_too_long = client
        .post(format!("{base}/api/channels/{channel_id}/events/publish"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({
            "event_kind": kind_too_long,
            "payload": {"body": "hi"},
        }))
        .send()
        .await
        .expect("publish oversize kind");
    assert_eq!(
        publish_kind_too_long.status().as_u16(),
        400,
        "publish should reject event_kind > 64 chars",
    );

    // B9: payload above the 64 KB cap is rejected.
    let huge_body = "x".repeat(65 * 1024);
    let huge_publish = client
        .post(format!("{base}/api/channels/{channel_id}/events/publish"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({
            "event_kind": "chat.message",
            "payload": {"body": huge_body},
        }))
        .send()
        .await
        .expect("publish huge");
    assert_eq!(
        huge_publish.status().as_u16(),
        400,
        "publish should reject payloads > 64 KB",
    );

    // B9: JSON null payload is rejected — an event with nothing
    // in it is almost always a caller bug we want surfaced.
    let null_publish = client
        .post(format!("{base}/api/channels/{channel_id}/events/publish"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({
            "event_kind": "chat.message",
            "payload": serde_json::Value::Null,
        }))
        .send()
        .await
        .expect("publish null");
    assert_eq!(
        null_publish.status().as_u16(),
        400,
        "publish should reject JSON null payload",
    );

    // 8. Revoke the policy — Bob loses access. Proves the
    //    lifecycle filter (`revoked = false`) is wired through
    //    list_visible + check + the engine fold. Review A12 /
    //    QA-4.
    let policies: serde_json::Value = client
        .post(format!("{base}/api/access_policies/list"))
        .header("x-realtime-user-id", &alice)
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
        .header("x-realtime-user-id", &alice)
        .send()
        .await
        .expect("revoke");
    assert_eq!(revoke.status().as_u16(), 200, "revoke should succeed");

    let bob_after_revoke = client
        .post(format!("{base}/api/channels/{channel_id}/events/publish"))
        .header("x-realtime-user-id", &bob)
        .json(&json!({"event_kind": "chat.message", "payload": {"body": "should be denied"}}))
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

    // 10. Phase 6 Round 7 — share a channel with a *user-group*,
    //     not a single User. Proves the UserGroup-subject path
    //     works end-to-end: the middleware resolves Bob's
    //     memberships, the engine matches the UserGroup policy
    //     against Bob's groups, and Bob sees the channel that
    //     Alice never shared with him directly.
    use diesel::prelude::*;
    use diesel_async::RunQueryDsl;
    use realtime_server_lib::{
        models::{
            access_policies::{check::check_resources_access_control, AccessPolicyAction, AccessPolicyResourceType},
            users::{User as TestUser, UserId as TestUserId},
        },
        schema as test_schema,
    };

    // Insert Carol via raw SQL. dev/seed only knows Alice + Bob;
    // we need a third user who is in NO group so we can confirm
    // the negative case (Carol must NOT see the group-shared
    // channel).
    let carol_id = uuid::Uuid::from_u128(0xCAA0_0000_0000_0000_0000_0000_0000_0001);
    let group_id = uuid::Uuid::from_u128(0x6900_0000_0000_0000_0000_0000_0000_0001);
    let alice_uuid: uuid::Uuid = alice.parse().expect("alice uuid");
    let bob_uuid: uuid::Uuid = bob.parse().expect("bob uuid");
    let mut conn = state_for_round_7
        .database
        .get_connection()
        .await
        .expect("conn for round-7 setup");

    let now = chrono::Utc::now().naive_utc();
    let carol = TestUser {
        id: TestUserId(carol_id),
        external_user_id: None,
        display_name: "Carol".to_string(),
        created_time: now,
        modified_time: now,
        deleted: false,
        user_type: 0,
        idp_id: uuid::Uuid::from_u128(0x7a17_ade1_0000_0000_0000_0000_0000_0001),
    };
    diesel::insert_into(test_schema::users::table)
        .values(&carol)
        .execute(&mut conn)
        .await
        .expect("insert carol");

    // user_group "team-a", owned by Alice, with Bob as the only
    // member. No UI / endpoint creates user_groups in realtime
    // today (Round 7 lands the schema; group-mgmt UX is later);
    // direct inserts are the contract.
    diesel::sql_query(
        "INSERT INTO user_groups (id, owner_id, name, created_time, modified_time) \
         VALUES ($1, $2, 'team-a', $3, $3)",
    )
    .bind::<diesel::sql_types::Uuid, _>(group_id)
    .bind::<diesel::sql_types::Uuid, _>(alice_uuid)
    .bind::<diesel::sql_types::Timestamp, _>(now)
    .execute(&mut conn)
    .await
    .expect("insert user_group");
    diesel::sql_query(
        "INSERT INTO user_user_group_members (user_id, user_group_id, joined_at) \
         VALUES ($1, $2, $3)",
    )
    .bind::<diesel::sql_types::Uuid, _>(bob_uuid)
    .bind::<diesel::sql_types::Uuid, _>(group_id)
    .bind::<diesel::sql_types::Timestamp, _>(now)
    .execute(&mut conn)
    .await
    .expect("insert membership");

    // Alice creates a fresh channel + grants the user_group
    // ChannelsRead + ChannelsList. (We can't reuse `channel_id`
    // from earlier because the previous policy was revoked at
    // step 8; a fresh channel keeps the test independent of step
    // ordering.)
    let team_channel_resp: serde_json::Value = client
        .post(format!("{base}/api/channels/create"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({"name": "team-room", "topic": null}))
        .send()
        .await
        .expect("alice create team-room")
        .json()
        .await
        .expect("team-room json");
    let team_channel_id =
        team_channel_resp["data"]["channel"]["id"].as_str().unwrap().to_string();

    let group_grant = client
        .post(format!("{base}/api/access_policies/create"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({
            "name": "team-a-on-team-room",
            "subject_type": "UserGroup",
            "subject_id": group_id,
            "resource_type": "Channel",
            "resource_id": team_channel_id,
            "actions": ["ChannelsRead", "ChannelsList"],
            "effect": "Allow",
        }))
        .send()
        .await
        .expect("group grant");
    assert_eq!(
        group_grant.status().as_u16(),
        200,
        "UserGroup-subject policy must be createable via the REST surface",
    );

    // Bob's /channels/list must include the team-room. This is
    // the proof that the engine's UserGroup-subject path runs
    // through `RealtimePolicyStore::list_visible_resource_ids`,
    // matches the policy against Bob's resolved groups, and
    // returns the channel id.
    let bob_visible: serde_json::Value = client
        .post(format!("{base}/api/channels/list"))
        .header("x-realtime-user-id", &bob)
        .send()
        .await
        .expect("bob list")
        .json()
        .await
        .expect("bob list json");
    let bob_visible_ids: Vec<String> = bob_visible["data"]["channels"]
        .as_array()
        .expect("channels array")
        .iter()
        .map(|c| c["id"].as_str().unwrap().to_string())
        .collect();
    assert!(
        bob_visible_ids.contains(&team_channel_id),
        "Bob (member of team-a) must see the team-room — got: {bob_visible_ids:?}",
    );

    // Carol (not in team-a) must NOT see the team-room. This
    // catches a class of failure modes where the UserGroup
    // policy would leak to non-members (e.g. an `OR TRUE` in
    // the subject filter, or the middleware ignoring its
    // resolved groups).
    let carol_visible: serde_json::Value = client
        .post(format!("{base}/api/channels/list"))
        .header("x-realtime-user-id", carol_id.to_string())
        .send()
        .await
        .expect("carol list")
        .json()
        .await
        .expect("carol list json");
    let carol_visible_ids: Vec<String> = carol_visible["data"]["channels"]
        .as_array()
        .expect("channels array (carol)")
        .iter()
        .map(|c| c["id"].as_str().unwrap().to_string())
        .collect();
    assert!(
        !carol_visible_ids.contains(&team_channel_id),
        "Carol (non-member) must NOT see the team-room — got: {carol_visible_ids:?}",
    );

    // And the engine-level check_resources_access_control —
    // called directly — must agree: Bob is allowed, Carol is
    // denied. Mirrors the REST list assertion but exercises the
    // check_access code path explicitly so a future regression
    // that breaks `check` without breaking `list_visible` (or
    // vice versa) still surfaces.
    let team_channel_uuid: uuid::Uuid = team_channel_id.parse().expect("team channel uuid");
    let bob_groups = vec![group_id];
    let bob_user: TestUser = test_schema::users::table
        .filter(test_schema::users::id.eq(TestUserId(bob_uuid)))
        .select(TestUser::as_select())
        .first::<TestUser>(&mut conn)
        .await
        .expect("load bob");
    let carol_user: TestUser = test_schema::users::table
        .filter(test_schema::users::id.eq(TestUserId(carol_id)))
        .select(TestUser::as_select())
        .first::<TestUser>(&mut conn)
        .await
        .expect("load carol");
    let bob_check = check_resources_access_control(
        &state_for_round_7.database,
        Some(&bob_user),
        &bob_groups,
        &state_for_round_7.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[team_channel_uuid]),
        AccessPolicyAction::ChannelsRead,
    )
    .await
    .expect("bob check");
    bob_check.verify().expect("Bob must be allowed via UserGroup policy");

    let carol_check = check_resources_access_control(
        &state_for_round_7.database,
        Some(&carol_user),
        &[], // Carol has zero memberships
        &state_for_round_7.context_app,
        AccessPolicyResourceType::Channel,
        Some(&[team_channel_uuid]),
        AccessPolicyAction::ChannelsRead,
    )
    .await
    .expect("carol check");
    assert!(
        carol_check.verify().is_err(),
        "Carol (no memberships) must be denied — engine returned: {carol_check:?}",
    );

    // 11. /api/access_policies/explain — the prerequisite for the
    //     cross-service authz admin UI (Phase 7,
    //     `apis/cloud/authz-admin/`). Verifies the endpoint returns
    //     per-resource AuthReason variants that match what the
    //     direct check returns, and that the answers are
    //     subject-scoped (Alice sees Owned for her channels; Bob
    //     sees AllowedByDirectUserGroupPolicy for the team-room).

    let alice_explain: serde_json::Value = client
        .post(format!("{base}/api/access_policies/explain"))
        .header("x-realtime-user-id", &alice)
        .json(&json!({"resource_type": "Channel", "action": "ChannelsList"}))
        .send()
        .await
        .expect("alice explain")
        .json()
        .await
        .expect("alice explain json");
    let alice_evals = alice_explain["data"]["evaluations"]
        .as_array()
        .expect("alice evaluations array");
    // Alice should at least see the team-room she just created;
    // every entry must be allowed; the team-room must come back
    // as Owned (her owner shortcut), not via any policy row.
    let alice_team_room = alice_evals
        .iter()
        .find(|e| e["resource_id"].as_str() == Some(&team_channel_id))
        .expect("alice's explain must include team-room");
    assert_eq!(
        alice_team_room["is_allowed"], true,
        "Alice must be allowed on her own team-room",
    );
    assert_eq!(
        alice_team_room["reason"], "Owned",
        "Alice's reason on her own channel must be the Owner shortcut",
    );

    let bob_explain: serde_json::Value = client
        .post(format!("{base}/api/access_policies/explain"))
        .header("x-realtime-user-id", &bob)
        .json(&json!({"resource_type": "Channel", "action": "ChannelsList"}))
        .send()
        .await
        .expect("bob explain")
        .json()
        .await
        .expect("bob explain json");
    let bob_evals = bob_explain["data"]["evaluations"]
        .as_array()
        .expect("bob evaluations array");
    let bob_team_room = bob_evals
        .iter()
        .find(|e| e["resource_id"].as_str() == Some(&team_channel_id))
        .expect("bob's explain must include team-room (via UserGroup policy)");
    assert_eq!(bob_team_room["is_allowed"], true);
    // The reason must name the UserGroup variant + cite the group
    // id we set up at step 10. The variant is internally tagged
    // (serde default for `AuthReason`) — `{"AllowedByDirectUserGroupPolicy":{"policy_id":..,"via_user_group_id":..}}`.
    let bob_reason_variant = bob_team_room["reason"]
        .as_object()
        .expect("bob's reason should be the tagged-enum object form");
    let via_group_block = bob_reason_variant
        .get("AllowedByDirectUserGroupPolicy")
        .expect("bob must be allowed via DirectUserGroupPolicy, not a direct or owner shortcut");
    assert_eq!(
        via_group_block["via_user_group_id"]
            .as_str()
            .expect("via_user_group_id field"),
        group_id.to_string(),
        "bob's reason must cite team-a as the connecting group",
    );

    // Carol has no policy on any channel and isn't in any group,
    // so the explain endpoint returns an empty evaluations array.
    let carol_explain: serde_json::Value = client
        .post(format!("{base}/api/access_policies/explain"))
        .header("x-realtime-user-id", carol_id.to_string())
        .json(&json!({"resource_type": "Channel", "action": "ChannelsList"}))
        .send()
        .await
        .expect("carol explain")
        .json()
        .await
        .expect("carol explain json");
    let carol_evals = carol_explain["data"]["evaluations"]
        .as_array()
        .expect("carol evaluations array");
    assert!(
        carol_evals.is_empty(),
        "Carol has no policies and no group memberships, so explain must return []. Got: {carol_evals:?}",
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
    // away local DB. A typo'd REALTIME_TEST_DB_URL pointing at a
    // real instance should NOT silently destroy it.
    if !is_safe_test_database(db_url) {
        panic!(
            "REFUSING TO DROP SCHEMA: REALTIME_TEST_DB_URL={db_url:?} doesn't look \
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
            .run_pending_migrations(realtime_server_lib::database::MIGRATIONS)
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
    let name_ok = db_name.contains("test") || db_name.contains("realtime");
    host_ok && name_ok
}
