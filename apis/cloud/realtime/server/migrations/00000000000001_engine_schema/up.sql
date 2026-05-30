-- Engine schema for chat-server (Phase 6 Round 2).
--
-- One consolidated migration that brings the chat DB to the
-- mows-auth-core engine surface required by the chat MVP. Mirrors
-- the engine-relevant subset of filez's accumulated migrations
-- (00001 idp_providers, 00002+00003 idp wiring + hardening,
-- 00004 lifecycle columns on access_policies, 00005 apps columns,
-- 00006 resource_scope, 00009 hot-path indexes, 00010 nobody
-- sentinel). Compacted into one file because chat starts fresh —
-- there's no need to replay filez's incremental history.
--
-- Deliberately OUT of scope for the chat MVP (follow-up rounds):
--   * user_groups + members + invitations + join_requests
--     (filez migrations 00008, 00011-00013, 00017)
--   * audit_log (migration 00014)
--   * listing cover tables + reconciler + bulk-rebuild
--     (migrations 00007, 00015, 00018)
--   * seed user_groups list policy (migration 00016)
-- Each will land in its own chat migration when the corresponding
-- feature is wired (.plans/chat-service/PLAN.md Rounds 4-6).
--
-- The chat MVP exercises ONLY the User-subject path through the
-- engine (Alice grants Bob ChannelsRead on channel X). That's
-- the minimum honest validation that the engine generalises
-- across services; UserGroup support is the obvious follow-up.

-- 1. idp_providers ----------------------------------------------------
-- v1 ships with exactly one row: Zitadel. Mirrors the filez table
-- byte-for-byte so a future shared bootstrap can hoist the seed.
CREATE TABLE idp_providers (
    id            UUID PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    discovery_url TEXT NULL,
    created_time  TIMESTAMP NOT NULL
);
INSERT INTO idp_providers (id, name, discovery_url, created_time) VALUES (
    '7a17ade1-0000-0000-0000-000000000001',
    'zitadel',
    NULL,
    '1970-01-01 00:00:00'
);

-- 2. users ------------------------------------------------------------
-- Minimal: id, display name, IdP linkage, soft-delete flag, type.
-- No profile_picture / created_by / pre_identifier_email — those
-- are filez-specific accidents we don't need to inherit. user_type
-- discriminant matches filez's (0 = Regular, 1 = Service,
-- ... per AUTHENTICATION.md) so future cross-service user sync
-- can move rows without translation.
CREATE TABLE users (
    id               UUID PRIMARY KEY,
    external_user_id TEXT,
    display_name     TEXT NOT NULL,
    created_time     TIMESTAMP NOT NULL,
    modified_time    TIMESTAMP NOT NULL,
    deleted          BOOL NOT NULL,
    user_type        SMALLINT NOT NULL,
    idp_id           UUID NOT NULL REFERENCES idp_providers(id)
);
CREATE UNIQUE INDEX users_idp_external_id_idx
    ON users (idp_id, external_user_id)
    WHERE external_user_id IS NOT NULL;

-- 3. apps -------------------------------------------------------------
-- Minimal apps row used as the context_app_ids target on
-- access_policies. Same shape filez ended up with after migrations
-- 00001, 00002, 00005.
CREATE TABLE apps (
    id                 UUID PRIMARY KEY,
    name               TEXT NOT NULL,
    description        TEXT,
    origins            TEXT[],
    trusted            BOOL NOT NULL,
    app_type           SMALLINT NOT NULL,
    created_time       TIMESTAMP NOT NULL,
    modified_time      TIMESTAMP NOT NULL,
    idp_id             UUID NOT NULL REFERENCES idp_providers(id),
    external_client_id TEXT
);
CREATE UNIQUE INDEX apps_idp_external_client_id_idx
    ON apps (idp_id, external_client_id)
    WHERE external_client_id IS NOT NULL;

-- 4. access_policies --------------------------------------------------
-- The engine's primary table. Schema matches filez's post-Phase-2
-- shape exactly so `mows_auth_core::PolicyStore` queries are
-- portable verbatim.
--
-- resource_scope: 0 = Single, 1 = OwnedByOwner,
--                 2 = AccessibleByOwner (Phase 2; deferred for chat
--                 v1 but column exists so future policies can flip
--                 without a migration).
CREATE TABLE access_policies (
    id                UUID PRIMARY KEY,
    owner_id          UUID NOT NULL REFERENCES users(id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
    name              TEXT NOT NULL,
    created_time      TIMESTAMP NOT NULL,
    modified_time     TIMESTAMP NOT NULL,
    subject_type      SMALLINT NOT NULL,
    subject_id        UUID NOT NULL,
    context_app_ids   UUID[] NOT NULL,
    resource_type     SMALLINT NOT NULL,
    resource_id       UUID,
    actions           SMALLINT[] NOT NULL,
    effect            SMALLINT NOT NULL,
    resource_scope    SMALLINT NOT NULL DEFAULT 0,
    expires_at        TIMESTAMP NULL,
    revoked           BOOL NOT NULL DEFAULT FALSE,
    policy_bundle_id  UUID NULL
);

-- Hot-path partial indexes (filez migration 00009, trimmed to the
-- ones the User-subject MVP needs). Both filter `NOT revoked` so a
-- revoke is index-bypass cheap.
CREATE INDEX access_policies_lookup_idx
    ON access_policies
        (subject_type, subject_id, resource_type, resource_id,
         effect)
    WHERE NOT revoked;

CREATE INDEX access_policies_subject_idx
    ON access_policies
        (subject_type, subject_id, resource_type)
    WHERE NOT revoked;

CREATE INDEX access_policies_owner_idx
    ON access_policies (owner_id)
    WHERE NOT revoked;

CREATE INDEX access_policies_policy_bundle_id_idx
    ON access_policies (policy_bundle_id)
    WHERE policy_bundle_id IS NOT NULL;

-- 5. nobody sentinel --------------------------------------------------
-- Engine convention (filez migration 00010): the all-zero UUID is
-- the system sentinel for ownerless / system-initiated rows. The
-- engine's recompute / reconciler audit rows write actor_id = NULL
-- but resource_id points at this sentinel where applicable.
INSERT INTO users (id, display_name, created_time, modified_time,
                   deleted, user_type, idp_id)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '__nobody__',
    '1970-01-01 00:00:00',
    '1970-01-01 00:00:00',
    false,
    0,  -- Regular; the sentinel impersonates a real user only for FK
    '7a17ade1-0000-0000-0000-000000000001'
);

-- 6. channels.owner_id + channel_events.author_id FK to users --------
-- Migration 00000's init created the realtime tables but couldn't
-- reference users(id) because users didn't exist yet. Add the FKs
-- now that the engine schema is in place.
ALTER TABLE channels
    ADD CONSTRAINT channels_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE channel_events
    ADD CONSTRAINT channel_events_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
