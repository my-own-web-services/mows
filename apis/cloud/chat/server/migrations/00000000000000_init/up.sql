-- Initial chat-service schema. Channels + messages only — the
-- engine tables (access_policies, audit_log, user_groups,
-- listing cover tables) are added in a follow-up migration
-- (`.plans/chat-service/PLAN.md` Round 2) so this migration can
-- land on its own and a fresh `cargo check` passes before the
-- engine wiring is in place.
--
-- Once Round 2 lands, the FK `channels.owner_id REFERENCES
-- users(id)` becomes a hard constraint; today the column carries
-- the producer's UUID without a referential check so the
-- skeleton builds.

CREATE TABLE "channels" (
    "id"            UUID NOT NULL PRIMARY KEY,
    "owner_id"      UUID NOT NULL,
    "name"          TEXT NOT NULL,
    "topic"         TEXT,
    "created_time"  TIMESTAMP NOT NULL,
    "modified_time" TIMESTAMP NOT NULL
);
CREATE INDEX "channels_owner_idx" ON "channels" ("owner_id");

CREATE TABLE "channel_messages" (
    "id"          UUID NOT NULL PRIMARY KEY,
    "channel_id"  UUID NOT NULL
        REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "author_id"   UUID NOT NULL,
    "body"        TEXT NOT NULL,
    "sent_at"     TIMESTAMP NOT NULL
);
-- Keyset-paginate by recency; tied-break on id so adjacent
-- timestamps stay stable. Same pattern as filez's listing
-- indexes — once channels grow large this is what the WS
-- backlog query rides on.
CREATE INDEX "channel_messages_by_channel_sent_at"
    ON "channel_messages" ("channel_id", "sent_at" DESC, "id" DESC);
