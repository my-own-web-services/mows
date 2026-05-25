-- Cover tables — PKs only here. Secondary indexes live in 02-indexes.sql
-- so the seed flow can drop+recreate them in one pass.

BEGIN;

CREATE TABLE public_resources (
    resource_type        SMALLINT NOT NULL,
    resource_id          UUID     NOT NULL,
    sort_created         TIMESTAMP NOT NULL,
    sort_modified        TIMESTAMP NOT NULL,
    sort_name            TEXT      NOT NULL,
    app_ids              UUID[]    NOT NULL,
    actions              SMALLINT[] NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
);

CREATE TABLE server_member_resources (
    resource_type        SMALLINT NOT NULL,
    resource_id          UUID     NOT NULL,
    sort_created         TIMESTAMP NOT NULL,
    sort_modified        TIMESTAMP NOT NULL,
    sort_name            TEXT      NOT NULL,
    app_ids              UUID[]    NOT NULL,
    actions              SMALLINT[] NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
);

CREATE TABLE user_group_accessible_resources (
    user_group_id        UUID     NOT NULL,
    resource_type        SMALLINT NOT NULL,
    resource_id          UUID     NOT NULL,
    sort_created         TIMESTAMP NOT NULL,
    sort_modified        TIMESTAMP NOT NULL,
    sort_name            TEXT      NOT NULL,
    app_ids              UUID[]    NOT NULL,
    actions              SMALLINT[] NOT NULL,
    PRIMARY KEY (user_group_id, resource_type, resource_id)
);

COMMIT;
