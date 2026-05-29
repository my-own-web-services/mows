# Chat service — Phase 6 of authorization

## What this is

A small realtime messaging service whose primary purpose is to be
the **second consumer of `mows-auth-core`** (PLAN.md §Phase 6 in
`.plans/authorization/`).

The service stands on its own — a working chat backend where users
can create channels, post messages, and subscribe to live updates.
But every authorization decision goes through `mows-auth-core`, so
the act of building it validates that the engine generalises beyond
filez.

## Why a chat service (and not Pektin / manager)

- **Pektin** uses Redis-only persistence (actix-web + pektin-common).
  Adding Postgres + diesel + a wire-stable schema migration is a
  weeks-long change on its own, before any auth wiring lands.
- **mows-manager** has no persistent storage at all (in-memory
  state per the project's auto-memory). Adding Postgres conflicts
  with the project's deliberate manager design.
- **Chat** has the right shape (per-resource ownership, per-resource
  read/write actions, group-shared resources) and zero legacy.
  Starting from a clean slate is the fastest path to "engine
  validated against two consumers" — which is the whole point of
  Phase 6.

## Scope of v1 (this milestone)

1. **Resource**: `Channel` (one record per chat room).
2. **Sub-resource**: `ChannelMessage` (one record per message; not
   independently policy-able — access is derived from the parent
   channel).
3. **Actions on Channel**:
   - `ChannelsCreate` — gated by app + caller context.
   - `ChannelsGet` — read channel metadata.
   - `ChannelsList` — list channels the caller can see (uses
     `mows_auth_core::list_visible`).
   - `ChannelsUpdate` — rename, change topic.
   - `ChannelsDelete` — hard-delete + cascade messages.
   - `ChannelsRead` — pull message history + subscribe via WS.
   - `ChannelsPost` — send a message.
4. **HTTP surface** (utoipa + axum):
   - `POST /api/channels/create`
   - `GET /api/channels/get/{channel_id}`
   - `POST /api/channels/list` (paginated; uses `list_visible`)
   - `PUT /api/channels/update/{channel_id}`
   - `DELETE /api/channels/delete/{channel_id}`
   - `GET /api/channels/{channel_id}/messages` (paginated history)
   - `POST /api/channels/{channel_id}/messages/send`
   - `GET /api/channels/{channel_id}/live` (WebSocket; upgrade after
     a successful `ChannelsRead` check)
5. **Realtime fanout**: per-channel `tokio::broadcast::Sender`, one
   per process. Single-process scope only. Cross-process scaling
   (Postgres LISTEN/NOTIFY or Redis pub/sub) is explicitly deferred —
   call out the limitation in the WS handler header.
6. **Auth**: Zitadel introspection (same `ZitadelIntrospector` filez
   uses). Per-request `AuthenticationInformation` extension carries
   the resolved user + app.
7. **mows-auth-core**: full embed (PolicyStore impl + check + list).
   Same access_policies / audit_log / user_groups schema as filez
   (those tables ship in the chat migrations too).

## Non-scope (deferred)

- Frontend. The chat service exposes a REST + WS API only; UI is
  Phase 7 (the existing manager-UI surface gets `Channels` building
  blocks the same way it gets `UserGroup` ones from Phase 4).
- File attachments. Add later via a `file_id` column referencing a
  filez file; orthogonal to engine validation.
- Direct messages (1-to-1 channels). The Channel resource is enough
  to model DMs (a channel with two members) but no special UI
  handling.
- Message editing / deletion. Append-only message log for v1; edits
  add a new `versions` table later if needed.
- Threading, reactions, presence, typing indicators. All would slot
  in around the existing channel model without engine changes.
- Cross-process WS scaling. The single-process limitation is honest
  scope; horizontal scaling needs a fanout bus and is tracked
  separately.

## Architectural choices to call out

### Same schema as filez, not a shared one

Each `mows-auth-core` consumer ships its own copy of the
`access_policies` + `audit_log` + `user_groups` tables in its own
Postgres database. There is no shared "auth DB" the two services
connect to.

This is **deliberate** per `.plans/authorization/DEPLOYMENT.md`
("crate, not sidecar"). The trade-off:

- Pro: each service is independently deployable, has its own
  Postgres pool, no cross-service connection sprawl.
- Pro: a chat-only or filez-only deployment is just one service +
  one database.
- Pro: schema drift between services is allowed (one can be on
  migration 00018 while the other is on 00020 of the engine).
- Con: a "user X is in group Y in filez" fact does not
  automatically apply in chat. Users + groups must be synced
  cross-service (Phase 7 deliverable: a SyncBroker or similar).
- Con: every consumer copies the same ~10 migration files. The
  duplication is the cost of independence.

### Engine duplication is itself a finding

The chat service will copy a lot of boilerplate from filez:
`config.rs`, `database/`, `state.rs`, `errors.rs`, auth
middleware, plus all the engine-coupled models. This is a Phase 6
**outcome** — the second consumer is what surfaces what's worth
extracting.

A `mows-service-core` crate (config + database pool + auth
middleware + introspector wiring) is the obvious extraction. We
do NOT extract it in this milestone (CLAUDE.md: "Don't add
features, refactor, or introduce abstractions beyond what the
task requires"). We document the duplication explicitly so the
extraction lands when a third consumer arrives.

## Success criteria

Engine validation gates (Phase 6 done):

- [ ] Chat server boots, applies migrations, registers `Channel`
      resource type with `mows-auth-core`.
- [ ] A user can `POST /api/channels/create` and the channel
      appears in `GET /api/channels/list` for them but NOT for an
      unrelated user.
- [ ] A user shares a channel with a user-group; every member of
      that group can now see the channel via `list_visible`.
- [ ] A user without `ChannelsPost` is rejected from
      `POST /api/channels/{id}/messages/send` (403, audit row).
- [ ] A WebSocket subscriber receives messages posted by another
      WebSocket subscriber on the same channel (in-process
      round-trip).
- [ ] SQL test similar to Phase 5's `cover_consistency_random_walk`
      asserts `list_visible` for `Channel` matches a brute-force
      reference.
- [ ] All tests green in CI parity to filez (unit + integration +
      SQL suite).

Stretch:

- [ ] Audit-event emission on every channel CRUD + every message
      send-rejection.
- [ ] mpm-style compose file for local dev.

## Layout

```
apis/cloud/chat/
└── server/
    ├── Cargo.toml
    ├── build.sh
    ├── Dockerfile
    ├── dev-db.compose.yaml
    ├── migrations/
    │   ├── 00000000000000_init/
    │   ├── 00000000000001_access_policies_engine/   # copied from filez
    │   ├── 00000000000002_audit_log/                 # copied from filez
    │   ├── 00000000000003_user_groups_lifecycle/    # copied from filez
    │   ├── 00000000000004_listing_cover_tables/     # copied from filez
    │   ├── 00000000000005_listing_cover_reconciler/ # copied from filez
    │   └── 00000000000010_channels/                  # new
    ├── scripts/
    │   ├── start-dev-db.sh
    │   ├── run-sql-tests.sh
    │   └── codegen.sh
    ├── src/
    │   ├── api_router.rs
    │   ├── background_tasks.rs           # cover reconciler tick
    │   ├── config.rs
    │   ├── database/mod.rs
    │   ├── errors.rs
    │   ├── http_api/
    │   │   ├── authentication/middleware.rs
    │   │   ├── channels/                  # NEW
    │   │   │   ├── create.rs
    │   │   │   ├── delete.rs
    │   │   │   ├── get.rs
    │   │   │   ├── list.rs
    │   │   │   ├── update.rs
    │   │   │   ├── messages/
    │   │   │   │   ├── list.rs
    │   │   │   │   ├── send.rs
    │   │   │   ├── live.rs                # WebSocket
    │   │   │   └── mod.rs
    │   │   ├── health/mod.rs
    │   │   ├── mod.rs
    │   │   └── users/                     # minimal; engine needs them
    │   ├── lib.rs
    │   ├── main.rs
    │   ├── macros.rs
    │   ├── models/
    │   │   ├── access_policies/mod.rs    # copied from filez
    │   │   ├── audit_log/mod.rs          # copied from filez
    │   │   ├── apps/mod.rs               # copied from filez (minimal)
    │   │   ├── channels/                  # NEW
    │   │   │   ├── messages/mod.rs
    │   │   │   └── mod.rs
    │   │   ├── cover_tables/mod.rs       # copied from filez
    │   │   ├── mod.rs
    │   │   ├── user_groups/mod.rs        # copied from filez
    │   │   └── users/mod.rs              # copied from filez
    │   ├── realtime/                      # NEW — broadcast registry
    │   │   └── mod.rs
    │   ├── schema.rs                      # hand-curated
    │   ├── state.rs
    │   ├── trace.rs
    │   ├── types.rs
    │   └── utils.rs
    └── tests/
        ├── sql/
        │   ├── channel_listing_visibility.sql
        │   └── channel_post_authorization.sql
        └── sql_tests.rs
```

## What goes in `.plans/chat-service/`

- `IDEA.md` (this file) — the why + scope contract.
- `ARCHITECTURE.md` — request flow, where auth checks fire,
  realtime fanout shape, threading model.
- `DATA_MODEL.md` — channels + messages tables; mapping to
  ResourceType / actions.
- `PLAN.md` — running task board with ✅ / ❌ per the project's
  convention.
