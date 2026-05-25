-- filez schema — owned by the filez repo.
-- Cross-references mows_auth via foreign keys & cross-schema reads.

BEGIN;

CREATE SCHEMA filez;

-- Resources
CREATE TABLE filez.files (
    id                       UUID PRIMARY KEY,
    owner_id                 UUID NOT NULL REFERENCES mows_auth.users(id),
    name                     TEXT NOT NULL,
    size_bytes               BIGINT NOT NULL DEFAULT 0,
    created_time             TIMESTAMP NOT NULL DEFAULT now(),
    storage_location_id      UUID NOT NULL,
    created_via_policy_id    UUID NULL REFERENCES mows_auth.access_policies(id)
);
CREATE INDEX files_owner_created_idx
    ON filez.files (owner_id, created_time DESC, id DESC);

CREATE TABLE filez.file_groups (
    id        UUID PRIMARY KEY,
    owner_id  UUID NOT NULL REFERENCES mows_auth.users(id),
    name      TEXT NOT NULL
);

CREATE TABLE filez.file_file_group_members (
    file_id        UUID NOT NULL REFERENCES filez.files(id) ON DELETE CASCADE,
    file_group_id  UUID NOT NULL REFERENCES filez.file_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, file_group_id)
);

-- Per-owner per-storage-location quota (existing concept)
CREATE TABLE filez.storage_quotas (
    id                   UUID PRIMARY KEY,
    owner_id             UUID NOT NULL REFERENCES mows_auth.users(id),
    storage_location_id  UUID NOT NULL,
    quota_bytes          BIGINT NOT NULL,
    used_bytes           BIGINT NOT NULL DEFAULT 0,
    UNIQUE (owner_id, storage_location_id)
);

-- Per-policy quota side table — the new piece.
-- One row per policy that allows file creation. Owned by filez.
-- The mows_auth schema knows nothing about this.
CREATE TABLE filez.filez_policy_quotas (
    policy_id                 UUID PRIMARY KEY
                                  REFERENCES mows_auth.access_policies(id) ON DELETE CASCADE,
    max_bytes                 BIGINT NULL,
    max_files                 INT    NULL,
    max_per_file_bytes        BIGINT NULL,
    used_bytes                BIGINT NOT NULL DEFAULT 0,
    used_files                INT    NOT NULL DEFAULT 0,
    CHECK (max_bytes        IS NULL OR max_bytes >= 0),
    CHECK (max_files        IS NULL OR max_files >= 0),
    CHECK (max_per_file_bytes IS NULL OR max_per_file_bytes >= 0),
    CHECK (used_bytes >= 0 AND used_files >= 0)
);

COMMIT;
