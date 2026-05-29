# Chat service — architecture

## Process shape

One Rust binary (`chat-server`) using axum + utoipa + diesel-async.
One Postgres database. One process per replica; broadcast fanout
for WebSocket subscribers is **in-process only** for v1.

```
        ┌────────────────────────────────────────────┐
        │                Chat clients                │
        │  (browsers, mobile, CLIs — REST + WS)      │
        └─────────────┬───────────────┬──────────────┘
                      │ HTTPS REST    │ WSS
                      │               │
              ┌───────▼───────────────▼────────┐
              │       chat-server (axum)        │
              │ ┌─────────────────────────────┐ │
              │ │ auth middleware (Zitadel)   │ │
              │ └─────────────────────────────┘ │
              │ ┌─────────────────────────────┐ │
              │ │ REST handlers + utoipa      │ │
              │ │   - channels/{create,…}     │ │
              │ │   - channels/{id}/messages  │ │
              │ │ WS handler                  │ │
              │ │   - channels/{id}/live      │ │
              │ └──────┬──────────────────────┘ │
              │        │ check / list_visible   │
              │ ┌──────▼──────────────────────┐ │
              │ │      mows-auth-core         │ │
              │ │   (PolicyStore impl backed  │ │
              │ │    by chat's Postgres)      │ │
              │ └──────┬──────────────────────┘ │
              │        │ SQL                    │
              │ ┌──────▼──────────────────────┐ │
              │ │ ChannelBroadcastRegistry    │ │
              │ │   per-channel               │ │
              │ │   tokio::broadcast::Sender  │ │
              │ └─────────────────────────────┘ │
              └─────────────┬───────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │ Postgres (chat DB)│
                  │  - channels       │
                  │  - channel_messages
                  │  - access_policies (engine)
                  │  - audit_log      (engine)
                  │  - user_groups    (engine)
                  │  - user_user_group_members
                  │  - cover_tables   (engine)
                  └───────────────────┘
```

## Request flow

### REST handler

1. `tower-http` cors + compression.
2. `authentication_middleware` extracts the Bearer token, calls
   `ZitadelIntrospector::introspect`, resolves to a chat-local
   `User` row (creating one on first sight), and injects an
   `AuthenticationInformation` extension.
3. The handler extracts `AuthenticationInformation` + the typed
   request body.
4. The handler calls
   `AccessPolicy::check(&database, &auth, ResourceType::Channel,
   resource_ids, action).await?.verify()?` — the `verify()` call
   returns `Err(FilezError::AuthDenied)` on deny.
5. The handler performs the domain action (insert / select).
6. The handler writes an `audit_log` row when the action is
   security-relevant (create / delete / share / explicit deny).
7. The handler returns `ApiResponse<T>` via the project's standard
   envelope.

### WebSocket subscribe

1. Client `Upgrade: websocket` to `/api/channels/{id}/live` with
   the Bearer token in `Sec-WebSocket-Protocol: bearer.<token>`
   (the only browser-friendly way to authenticate a WS — axum's
   `WebSocketUpgrade::protocols(["bearer.*"])` extracts it).
2. `authentication_middleware` validates the token same as REST.
3. Handler calls `check(... ResourceType::Channel, [channel_id],
   ChannelsRead)` — denies upgrade with HTTP 403 if rejected.
4. On upgrade success the handler:
   - Calls `ChannelBroadcastRegistry::subscribe(channel_id)` to
     get a `tokio::broadcast::Receiver<ChannelMessageEvent>`.
   - Sends recent backlog (last N messages from
     `channel_messages` as JSON frames).
   - Forwards every broadcast item to the WS frame stream.
   - On client disconnect or send error, drops the receiver
     (broadcast slot is reclaimed automatically).

### POST a message

1. Handler runs `check(... [channel_id], ChannelsPost)`.
2. Inserts a `channel_messages` row.
3. Calls `ChannelBroadcastRegistry::publish(channel_id,
   ChannelMessageEvent)` — sender is per-channel; if no
   subscribers exist, publish is a no-op (broadcast::Sender's
   `send` returns `Err(SendError)` but we ignore it — the message
   IS durably stored in `channel_messages` so a future
   `messages/list` returns it).

## Broadcast registry

`ChannelBroadcastRegistry` is one `DashMap<ChannelId,
broadcast::Sender<ChannelMessageEvent>>` stored on the
`AppState`. Lazy creation: first subscribe for a channel inserts a
sender with channel capacity 256 (drops oldest on overflow — fine
because backlog is in Postgres).

Reclamation: a sender stays alive as long as any receiver exists.
When the last receiver disconnects, the sender's strong count drops
and we *could* remove the entry to save memory. v1 doesn't bother;
the map is bounded by active channels (typically << total channels
in the DB), and a follow-up tick can prune empty entries every
few minutes if needed.

### Why not Postgres LISTEN/NOTIFY?

LISTEN/NOTIFY scales fanout across processes — exactly what v1
explicitly defers. Adding it now would require a separate
`tokio-postgres` connection (diesel-async has no LISTEN/NOTIFY
support), serialise events through a 8KB payload limit, and add an
async background loop driving NOTIFY → broadcast bridge. None of
which is needed to validate the engine. v2 with horizontal
scaling will add it.

### Why not Redis pub/sub?

Same answer — adds a new infrastructure dependency for the demo
phase. Postgres is already there; tokio::broadcast is in-process
and zero-config. Cross-process fanout slots in via a single trait
boundary on `ChannelBroadcastRegistry` when needed.

## mows-auth-core integration points

- `ResourceTypeRegistry` impl maps `ResourceType::Channel = 0` to
  the `channels` table (column `id`, owner column `owner_id`).
- `AccessPolicyAction` enum mirrors filez's pattern: a discriminant
  per action with gaps for future siblings.
  - `ChannelsCreate = 100`
  - `ChannelsGet = 110`
  - `ChannelsUpdate = 120`
  - `ChannelsDelete = 130`
  - `ChannelsList = 140`
  - `ChannelsRead = 150` (read message history + subscribe WS)
  - `ChannelsPost = 160` (send a message)
- `PolicyStore` impl ports the filez query shapes against chat's
  own tables. Tracked as a duplication finding — see IDEA.md
  §"Engine duplication is itself a finding".

## Tables (chat-specific)

```sql
CREATE TABLE channels (
    id            UUID PRIMARY KEY,
    owner_id      UUID NOT NULL REFERENCES users(id)
                                ON DELETE CASCADE,
    name          TEXT NOT NULL,
    topic         TEXT,
    created_time  TIMESTAMP NOT NULL,
    modified_time TIMESTAMP NOT NULL
);
CREATE INDEX channels_owner_idx ON channels(owner_id);

CREATE TABLE channel_messages (
    id          UUID PRIMARY KEY,
    channel_id  UUID NOT NULL REFERENCES channels(id)
                              ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id)
                              ON DELETE CASCADE,
    body        TEXT NOT NULL,
    sent_at     TIMESTAMP NOT NULL
);
CREATE INDEX channel_messages_by_channel_sent_at
    ON channel_messages (channel_id, sent_at DESC, id DESC);
```

The `users` + `user_groups` + `access_policies` + … tables are the
engine schema (copied from filez's migrations). Same shape, same
triggers, same reconciler.

## What's NOT in chat-server

- File attachments (lives in filez; a future `attachments` table
  would store filez file IDs).
- Push notifications. Subscriber gets backlog + live; missed
  messages while offline come from the next `/messages` REST call.
- DMs as a separate concept. A "DM" is a channel with two
  members + ChannelsRead/Post granted to each via DirectPolicy on
  the user subject.
- Federation. Each chat-server instance owns its channels;
  cross-instance is an integration concern out of scope.

## Failure modes + auditability

- **Auth denial**: `check()` returns `AccessDenied`. Handler maps
  to HTTP 403. An audit row goes in iff the action is in the
  "security-relevant" set (create, delete, share, deny). Standard
  list/get denials are NOT audited (would be noisy in a chat app).
- **Database loss**: every action is in a single Postgres
  transaction. WS publish only happens after the DB commit
  succeeds, so subscribers never see ghost messages.
- **Broadcast overflow**: a slow subscriber that can't drain its
  receiver fast enough hits the 256-frame buffer; oldest frames
  are dropped. The client sees a `MessageDropped` notification
  and is expected to re-fetch via REST to fill the gap. (Phase 7
  UI: surface the gap with a "loading missed messages" indicator.)
- **Subscriber disconnect**: WS handler exits, receiver dropped,
  no DB cleanup needed (no per-subscriber state in DB).

## Test strategy

Mirrors filez (Phase 5):

- **Unit tests** in each module for handler-shape + pure logic.
- **Wire-stability tests** for enum discriminants + serde tags.
- **SQL tests** under `tests/sql/`:
  - `channel_listing_visibility.sql` — seed channels + policies
    of every subject type; assert `mows_auth_core::list_visible`
    returns exactly the expected set per caller perspective.
  - `channel_post_authorization.sql` — assert post is denied
    without ChannelsPost; allowed with it.
- **WS round-trip test** in Rust: spin up the server with an
  in-memory introspector stub, subscribe + publish + receive in
  the same process, assert event reaches subscriber.
