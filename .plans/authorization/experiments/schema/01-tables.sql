-- MOWS Authorization experiment schema — TABLES + PKs only.
-- FKs live in 04-fks.sql, secondary indexes in 02-indexes.sql, cover
-- secondary indexes in 03-covers.sql. This split lets seed.sh drop
-- everything before bulk insert and recreate after for 10× faster
-- target-scale runs.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE TABLE users (
    id                   UUID PRIMARY KEY,
    external_user_id     TEXT,
    display_name         TEXT NOT NULL DEFAULT '',
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
    user_type            SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE apps (
    id                   UUID PRIMARY KEY,
    name                 TEXT NOT NULL,
    trusted              BOOL NOT NULL DEFAULT FALSE,
    app_type             SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE user_groups (
    id                   UUID PRIMARY KEY,
    owner_id             UUID NOT NULL,
    name                 TEXT NOT NULL,
    visibility           SMALLINT NOT NULL DEFAULT 0,
    join_policy          SMALLINT NOT NULL DEFAULT 0,
    created_time         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE user_user_group_members (
    user_id              UUID NOT NULL,
    user_group_id        UUID NOT NULL,
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, user_group_id)
);

CREATE TABLE files (
    id                   UUID PRIMARY KEY,
    owner_id             UUID NOT NULL,
    name                 TEXT NOT NULL,
    mime_type            TEXT NOT NULL DEFAULT 'application/octet-stream',
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
    modified_time        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE file_groups (
    id                   UUID PRIMARY KEY,
    owner_id             UUID NOT NULL,
    name                 TEXT NOT NULL,
    created_time         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE file_file_group_members (
    file_id              UUID NOT NULL,
    file_group_id        UUID NOT NULL,
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (file_id, file_group_id)
);

CREATE TABLE access_policies (
    id                   UUID PRIMARY KEY,
    owner_id             UUID NOT NULL,
    name                 TEXT NOT NULL DEFAULT '',
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
    modified_time        TIMESTAMP NOT NULL DEFAULT now(),
    subject_type         SMALLINT NOT NULL,
    subject_id           UUID NOT NULL,
    context_app_ids      UUID[] NOT NULL,
    resource_type        SMALLINT NOT NULL,
    resource_id          UUID NULL,
    resource_scope       SMALLINT NOT NULL DEFAULT 0,
    actions              SMALLINT[] NOT NULL,
    effect               SMALLINT NOT NULL,
    expires_at           TIMESTAMP NULL,
    revoked              BOOL NOT NULL DEFAULT FALSE,

    CHECK (cardinality(context_app_ids) > 0),
    CHECK (cardinality(actions) > 0),
    CHECK (
        (resource_scope = 0)
        OR (resource_scope IN (1, 2) AND resource_id IS NULL)
    ),
    CHECK (expires_at IS NULL OR expires_at > created_time),
    -- CRIT-8: ServerMember and Public subjects must use the nil UUID
    -- as subject_id. Without this CHECK, a Picker bug could create
    -- (subject_type=2, subject_id=some_specific_uuid) which the engine
    -- ignores subject_id for — silently granting access to all logged-in users.
    CHECK ((subject_type NOT IN (2, 3))
        OR (subject_id = '00000000-0000-0000-0000-000000000000'::uuid)),
    -- SLOP-15: enum domain constraints catch corruption from out-of-range writes.
    CHECK (subject_type   IN (0, 1, 2, 3)),
    CHECK (resource_scope IN (0, 1, 2)),
    CHECK (effect         IN (0, 1))
);

COMMIT;
