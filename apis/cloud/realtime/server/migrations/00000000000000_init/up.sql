-- Initial realtime-server schema. Channels + per-channel events.
-- The engine tables (access_policies, audit_log, user_groups,
-- listing_cover_tables) are added in
-- 00000000000001_engine_schema so this migration stands on its
-- own and a fresh `cargo check` passes before the engine wiring
-- is in place.
--
-- Once the engine migration lands, channels.owner_id +
-- channel_events.author_id pick up FK constraints to users(id)
-- (see migration 00001 §6).

CREATE TABLE "channels" (
    "id"            UUID NOT NULL PRIMARY KEY,
    "owner_id"      UUID NOT NULL,
    "name"          TEXT NOT NULL,
    "topic"         TEXT,
    "created_time"  TIMESTAMP NOT NULL,
    "modified_time" TIMESTAMP NOT NULL
);
CREATE INDEX "channels_owner_idx" ON "channels" ("owner_id");

-- channel_events: the durable record of every event published to
-- a channel. The payload is opaque JSONB so the API can carry
-- arbitrary use-case-specific data:
--
--   * chat-style messages → event_kind = 'chat.message',
--     payload = {"body": "hello"}
--   * WebRTC signaling   → event_kind = 'webrtc.offer' /
--     'webrtc.answer' / 'webrtc.ice', payload = the SDP/ICE
--   * presence pings     → event_kind = 'presence.heartbeat'
--   * arbitrary app data → app-defined event_kind, app-defined
--     payload
--
-- The realtime API doesn't interpret payload; the channel is a
-- pub/sub primitive that consumers layer use cases onto.
--
-- event_kind is nullable so callers can choose to omit it (the
-- channel is then a single-stream untagged log); when present it
-- gives subscribers a cheap server-side filter
-- (`WHERE event_kind = 'chat.message'`) without parsing payload.
CREATE TABLE "channel_events" (
    "id"          UUID NOT NULL PRIMARY KEY,
    "channel_id"  UUID NOT NULL
        REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "author_id"   UUID NOT NULL,
    "event_kind"  TEXT,
    "payload"     JSONB NOT NULL,
    "sent_at"     TIMESTAMP NOT NULL
);
-- Keyset-paginate by recency; tied-break on id so adjacent
-- timestamps stay stable.
CREATE INDEX "channel_events_by_channel_sent_at"
    ON "channel_events" ("channel_id", "sent_at" DESC, "id" DESC);
-- Optional event_kind filter index. Partial — only events with
-- a tag are indexed. Speeds up "give me the last N chat.message
-- events on this channel" without scanning every event row.
CREATE INDEX "channel_events_by_kind"
    ON "channel_events" ("channel_id", "event_kind", "sent_at" DESC)
    WHERE "event_kind" IS NOT NULL;
