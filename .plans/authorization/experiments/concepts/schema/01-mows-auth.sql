-- mows_auth schema — owned by the auth-service repo.
-- Knows nothing about files, bytes, or filez.

BEGIN;

DROP SCHEMA IF EXISTS mows_auth CASCADE;
DROP SCHEMA IF EXISTS filez     CASCADE;

CREATE SCHEMA mows_auth;

CREATE TABLE mows_auth.users (
    id                   UUID PRIMARY KEY,
    external_user_id     TEXT UNIQUE,
    display_name         TEXT NOT NULL DEFAULT '',
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
    user_type            SMALLINT NOT NULL DEFAULT 1
);

CREATE TABLE mows_auth.apps (
    id                   UUID PRIMARY KEY,
    name                 TEXT NOT NULL UNIQUE,
    trusted              BOOL NOT NULL DEFAULT FALSE,
    app_type             SMALLINT NOT NULL DEFAULT 0   -- 0 Frontend, 1 Backend
);

CREATE TABLE mows_auth.user_groups (
    id           UUID PRIMARY KEY,
    owner_id     UUID NOT NULL REFERENCES mows_auth.users(id),
    name         TEXT NOT NULL,
    created_time TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE mows_auth.user_user_group_members (
    user_id        UUID NOT NULL REFERENCES mows_auth.users(id) ON DELETE CASCADE,
    user_group_id  UUID NOT NULL REFERENCES mows_auth.user_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, user_group_id)
);

CREATE TABLE mows_auth.access_policies (
    id                   UUID PRIMARY KEY,
    owner_id             UUID NOT NULL REFERENCES mows_auth.users(id),
    name                 TEXT NOT NULL DEFAULT '',
    created_time         TIMESTAMP NOT NULL DEFAULT now(),
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
    -- CRIT-8: ServerMember and Public must use the nil UUID for subject_id;
    -- otherwise a buggy Picker silently creates an over-permissive ServerMember
    -- policy that the engine evaluates as "any logged-in user".
    CHECK ((subject_type NOT IN (2, 3))
        OR (subject_id = '00000000-0000-0000-0000-000000000000'::uuid)),
    CHECK (subject_type   IN (0, 1, 2, 3)),
    CHECK (resource_scope IN (0, 1, 2)),
    CHECK (effect         IN (0, 1))
);

CREATE INDEX ap_lookup_idx
    ON mows_auth.access_policies (resource_type, resource_id, subject_type, subject_id)
    WHERE NOT revoked;
CREATE INDEX ap_subject_idx
    ON mows_auth.access_policies (subject_type, subject_id, resource_type)
    WHERE NOT revoked;

CREATE OR REPLACE FUNCTION mows_auth.auth_user_group_ids(p_user uuid)
RETURNS uuid[] LANGUAGE sql STABLE PARALLEL SAFE AS $$
    SELECT coalesce(array_agg(user_group_id), '{}'::uuid[])
    FROM   mows_auth.user_user_group_members WHERE user_id = p_user
$$;

COMMIT;
