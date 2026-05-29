# PLAN — chat service (Phase 6 of authorization)

Status board for the second `mows-auth-core` consumer.
Convention: ✅ done, ❌ not done, ⏸ deferred.

See `IDEA.md` for the why + scope contract,
`ARCHITECTURE.md` for the request flow / table shapes.

## Round 1 — crate skeleton + design docs

- ✅ Workspace registration (`apis/cloud/chat/server` added to
     `Cargo.toml`)
- ✅ `Cargo.toml` mirroring filez's stack (axum + utoipa +
     diesel-async + mows-auth-core + zitadel)
- ✅ `.plans/chat-service/{IDEA.md, ARCHITECTURE.md, PLAN.md}`
- ✅ `src/lib.rs` + `src/main.rs` minimal bootstrap (compiles,
     binds to a port, serves `/api/health`)
- ✅ `src/config.rs` — env-var loading via mows-common-rust
- ✅ `src/errors.rs` — `ChatError` enum (thiserror)
- ✅ `src/database/mod.rs` — pool + `MIGRATIONS = embed_migrations!`
- ✅ `migrations/00000000000000_init/` — channels + messages tables
- ✅ `cargo check` clean
- ✅ Verified end-to-end: dev DB up via `scripts/start-dev-db.sh`,
     migrations applied via `bin/run_migrations`, server boots and
     `GET /api/health` returns `{"status":"Success","data":{"ok":true}}`

## Round 2 — engine schema + registration

- ❌ Copy engine migrations from filez (access_policies,
     audit_log, user_groups lifecycle, listing_cover_tables,
     listing_cover_reconciler, listing_hot_path_indexes, nobody
     sentinel, materialize threshold, per-cover bulk-rebuild)
- ❌ `src/schema.rs` hand-curated for all tables
- ❌ `src/models/users/mod.rs` — minimal FilezUser-equivalent
- ❌ `src/models/user_groups/mod.rs` — copied + trimmed
- ❌ `src/models/apps/mod.rs` — minimal
- ❌ `src/models/access_policies/mod.rs` — copied + trimmed
- ❌ `src/models/audit_log/mod.rs` — copied + trimmed
- ❌ `src/models/access_policies/store.rs` — `ChatPolicyStore`
     impl of `mows_auth_core::PolicyStore`. Tracked as the
     duplication finding that triggers extracting
     `EngineBackedPolicyStore` into `mows-auth-core` when a third
     consumer arrives.
- ❌ Resource type registry impl mapping `Channel = 0`
- ❌ `AccessPolicyAction` enum with the chat actions
     (Create/Get/Update/Delete/List/Read/Post)

## Round 3 — REST surface

- ❌ `src/http_api/authentication/middleware.rs` — copied from
     filez
- ❌ `src/state.rs` — `AppState` (database + introspector +
     broadcast registry)
- ❌ `src/http_api/health/mod.rs`
- ❌ `src/http_api/channels/create.rs` — POST /api/channels/create
     (calls `check(ChannelsCreate)`)
- ❌ `src/http_api/channels/get.rs` — GET /api/channels/get/{id}
     (calls `check(ChannelsGet)`)
- ❌ `src/http_api/channels/list.rs` — POST /api/channels/list
     (uses `mows_auth_core::list_visible_resource_ids`)
- ❌ `src/http_api/channels/update.rs` — PUT
     /api/channels/update/{id} (calls `check(ChannelsUpdate)`)
- ❌ `src/http_api/channels/delete.rs` — DELETE
     /api/channels/delete/{id} (calls `check(ChannelsDelete)` +
     audit row)
- ❌ `src/http_api/channels/messages/list.rs` — GET
     /api/channels/{id}/messages (calls `check(ChannelsRead)`)
- ❌ `src/http_api/channels/messages/send.rs` — POST
     /api/channels/{id}/messages/send (calls
     `check(ChannelsPost)` + broadcast publish)
- ❌ `src/api_router.rs` — utoipa-axum router registration

## Round 4 — realtime fanout

- ❌ `src/realtime/mod.rs` — `ChannelBroadcastRegistry` + event
     types
- ❌ `src/http_api/channels/live.rs` — WebSocket handler;
     subscribe-then-stream
- ❌ Stream backpressure + drop notification per ARCHITECTURE.md
     §Failure modes

## Round 5 — tests

- ❌ Wire-stability + metadata-shape tests for
     `AccessPolicyAction` + `AuditEvent` (the chat-specific
     variants)
- ❌ `tests/sql/channel_listing_visibility.sql`
- ❌ `tests/sql/channel_post_authorization.sql`
- ❌ `tests/sql_tests.rs` — wrapper running the SQL suite
     (skip-when-DB-down, same pattern as filez Phase 5)
- ❌ WS round-trip integration test in Rust

## Round 6 — build infra

- ❌ `Dockerfile` (from-scratch + alpine variant flag)
- ❌ `build.sh` (calls `cargo build --release` + docker buildx)
- ❌ `dev-db.compose.yaml`
- ❌ `scripts/start-dev-db.sh`
- ❌ `scripts/run-sql-tests.sh` (mirrors filez)
- ❌ `scripts/codegen.sh` (OpenAPI → TS client)

## Round 7 — Phase 6 cross-service E2E (validates the engine)

- ❌ Authorization PLAN.md Phase 6 ✅ for every box
- ❌ Documented finding: what was painful to duplicate from
     filez, what to extract into `mows-auth-core` or a new
     `mows-service-core` crate next
- ❌ A user shares a channel with a user-group; every member of
     that group sees the channel via list (end-to-end test
     against a running chat-server + Postgres)

## Deferred to follow-up phases

- ⏸ Frontend (Phase 7 territory; once filez's UI is settled,
     adapt the same UserGroupPicker + share dialog)
- ⏸ File attachments (cross-service integration with filez)
- ⏸ Cross-process WS scaling (LISTEN/NOTIFY or Redis pub/sub)
- ⏸ Message editing / deletion (versions table)
- ⏸ Threading, reactions, presence
- ⏸ DMs as a UI concept (data model already supports it via
     direct-policy on user subject)
