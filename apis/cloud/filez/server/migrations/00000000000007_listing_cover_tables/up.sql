-- Materialised cover tables for the hot listing sources per
-- LISTING.md §6. Three tables, one trigger function, one trigger on
-- access_policies, plus a sort-column mirror trigger on `files`.
--
-- Scope of v1:
--   - resource_type = 0 (FilezFile) is fully populated and maintained.
--   - Other resource types: the schema accommodates them, but the
--     maintenance function no-ops for those types until they grow a
--     Public/ServerMember/large-group sharing surface in real flows.
--     LISTING.md §6 keeps the schema generic; extending coverage to
--     another type is one branch in `refresh_listing_cover_rows`.
--
-- Read path (engine) is NOT changed by this migration — the cover
-- tables exist and stay consistent; LISTING.md §3 (k-way merge) will
-- start reading them in Phase 3. Keeping the read path on the Phase-1
-- engine fold means this migration is observable only via the cover
-- tables themselves; if a trigger bug under-populates a row, no live
-- user flow regresses.

-- 1. public_resources --------------------------------------------------
-- One row per (resource_type, resource_id) pair covered by AT LEAST
-- one active Public Allow policy. `app_ids` / `actions` aggregate the
-- distinct contexts across every contributing policy. The row is
-- DELETEd when the last contributing policy goes away.
CREATE TABLE public_resources (
    resource_type   SMALLINT       NOT NULL,
    resource_id     UUID           NOT NULL,
    sort_created    TIMESTAMP      NOT NULL,
    sort_modified   TIMESTAMP      NOT NULL,
    sort_name       TEXT           NOT NULL,
    app_ids         UUID[]         NOT NULL,
    actions         SMALLINT[]     NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
);
CREATE INDEX public_resources_by_created
    ON public_resources (resource_type, sort_created DESC, resource_id DESC);
CREATE INDEX public_resources_by_modified
    ON public_resources (resource_type, sort_modified DESC, resource_id DESC);
CREATE INDEX public_resources_by_name
    ON public_resources (resource_type, sort_name, resource_id);
CREATE INDEX public_resources_apps_gin
    ON public_resources USING GIN (app_ids);
CREATE INDEX public_resources_actions_gin
    ON public_resources USING GIN (actions);

-- 2. server_member_resources -------------------------------------------
-- Same shape, separate table to avoid an extra WHERE on subject_type
-- in the hot path.
CREATE TABLE server_member_resources (
    resource_type   SMALLINT       NOT NULL,
    resource_id     UUID           NOT NULL,
    sort_created    TIMESTAMP      NOT NULL,
    sort_modified   TIMESTAMP      NOT NULL,
    sort_name       TEXT           NOT NULL,
    app_ids         UUID[]         NOT NULL,
    actions         SMALLINT[]     NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
);
CREATE INDEX server_member_resources_by_created
    ON server_member_resources (resource_type, sort_created DESC, resource_id DESC);
CREATE INDEX server_member_resources_by_modified
    ON server_member_resources (resource_type, sort_modified DESC, resource_id DESC);
CREATE INDEX server_member_resources_by_name
    ON server_member_resources (resource_type, sort_name, resource_id);
CREATE INDEX server_member_resources_apps_gin
    ON server_member_resources USING GIN (app_ids);
CREATE INDEX server_member_resources_actions_gin
    ON server_member_resources USING GIN (actions);

-- 3. user_group_accessible_resources -----------------------------------
-- Keyed by (user_group_id, resource_type, resource_id). LISTING.md §6.2
-- describes a membership-cardinality threshold so small groups skip
-- materialisation — that gate lands with the Phase-3 read path; until
-- then we materialise unconditionally so the data is complete and the
-- read path can switch over without a backfill.
CREATE TABLE user_group_accessible_resources (
    user_group_id   UUID           NOT NULL,
    resource_type   SMALLINT       NOT NULL,
    resource_id     UUID           NOT NULL,
    sort_created    TIMESTAMP      NOT NULL,
    sort_modified   TIMESTAMP      NOT NULL,
    sort_name       TEXT           NOT NULL,
    app_ids         UUID[]         NOT NULL,
    actions         SMALLINT[]     NOT NULL,
    PRIMARY KEY (user_group_id, resource_type, resource_id)
);
CREATE INDEX uga_resources_by_created
    ON user_group_accessible_resources
       (user_group_id, resource_type, sort_created DESC, resource_id DESC);
CREATE INDEX uga_resources_by_modified
    ON user_group_accessible_resources
       (user_group_id, resource_type, sort_modified DESC, resource_id DESC);
CREATE INDEX uga_resources_by_name
    ON user_group_accessible_resources
       (user_group_id, resource_type, sort_name, resource_id);
CREATE INDEX uga_resources_apps_gin
    ON user_group_accessible_resources USING GIN (app_ids);
CREATE INDEX uga_resources_actions_gin
    ON user_group_accessible_resources USING GIN (actions);

-- 4. Resource-side sort-key reads -------------------------------------
-- The maintenance function reads sort_created/sort_modified/sort_name
-- from the resource table for the given resource_type. v1 supports
-- resource_type = 0 (files). Returns NULL if the resource is missing,
-- which the trigger uses to skip the cover-table write (rare race
-- between policy insert and resource delete).
CREATE OR REPLACE FUNCTION fetch_listing_sort_keys(
    p_resource_type SMALLINT,
    p_resource_id   UUID,
    OUT sort_created  TIMESTAMP,
    OUT sort_modified TIMESTAMP,
    OUT sort_name     TEXT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    IF p_resource_type = 0 THEN
        SELECT f.created_time, f.modified_time, f.name
            INTO sort_created, sort_modified, sort_name
            FROM files f
            WHERE f.id = p_resource_id;
    ELSE
        -- Other resource types not yet covered (see migration header).
        sort_created  := NULL;
        sort_modified := NULL;
        sort_name     := NULL;
    END IF;
END;
$$;

-- 5. Lifecycle predicate -----------------------------------------------
-- An access_policies row "contributes" to the cover tables iff:
--   - effect = 1 (Allow)
--   - resource_id IS NOT NULL (Single scope; LISTING.md §6 only
--     mirrors Single — owner-scoped policies are handled in Phase 3)
--   - resource_scope = 0 (Single)
--   - NOT revoked
--   - expires_at IS NULL OR expires_at > now()
CREATE OR REPLACE FUNCTION access_policy_contributes_to_cover(
    p_effect          SMALLINT,
    p_resource_id     UUID,
    p_resource_scope  SMALLINT,
    p_revoked         BOOLEAN,
    p_expires_at      TIMESTAMP
) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN p_effect = 1
       AND p_resource_id IS NOT NULL
       AND p_resource_scope = 0
       AND p_revoked = FALSE
       AND (p_expires_at IS NULL OR p_expires_at > now());
END;
$$;

-- 6. Recompute one cover row -------------------------------------------
-- Given a (subject_type, subject_id, resource_type, resource_id),
-- recompute the matching cover row from the *current* set of
-- contributing access_policies for that (subject, resource). UPSERTs
-- with the aggregated app_ids + actions; DELETEs the row if no
-- contributing policy remains.
--
-- subject_type is 2 (ServerMember), 3 (Public), or 1 (UserGroup). The
-- subject_id argument is used only when subject_type = 1.
CREATE OR REPLACE FUNCTION refresh_listing_cover_row(
    p_subject_type   SMALLINT,
    p_subject_id     UUID,
    p_resource_type  SMALLINT,
    p_resource_id    UUID
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_app_ids       UUID[];
    v_actions       SMALLINT[];
    v_sort_created  TIMESTAMP;
    v_sort_modified TIMESTAMP;
    v_sort_name     TEXT;
BEGIN
    -- Aggregate the contributing policies' app_ids and actions for
    -- this (subject, resource). UNION-style: distinct elements only,
    -- preserving order-insensitivity (GIN-indexed downstream).
    IF p_subject_type = 1 THEN
        SELECT
            COALESCE(array_agg(DISTINCT ctx) FILTER (WHERE ctx IS NOT NULL), ARRAY[]::UUID[]),
            COALESCE(array_agg(DISTINCT act) FILTER (WHERE act IS NOT NULL), ARRAY[]::SMALLINT[])
            INTO v_app_ids, v_actions
            FROM (
                SELECT unnest(ap.context_app_ids) AS ctx, unnest(ap.actions) AS act
                FROM access_policies ap
                WHERE ap.subject_type    = p_subject_type
                  AND ap.subject_id      = p_subject_id
                  AND ap.resource_type   = p_resource_type
                  AND ap.resource_id     = p_resource_id
                  AND access_policy_contributes_to_cover(
                        ap.effect, ap.resource_id, ap.resource_scope,
                        ap.revoked, ap.expires_at)
            ) AS unrolled;
    ELSE
        SELECT
            COALESCE(array_agg(DISTINCT ctx) FILTER (WHERE ctx IS NOT NULL), ARRAY[]::UUID[]),
            COALESCE(array_agg(DISTINCT act) FILTER (WHERE act IS NOT NULL), ARRAY[]::SMALLINT[])
            INTO v_app_ids, v_actions
            FROM (
                SELECT unnest(ap.context_app_ids) AS ctx, unnest(ap.actions) AS act
                FROM access_policies ap
                WHERE ap.subject_type    = p_subject_type
                  AND ap.resource_type   = p_resource_type
                  AND ap.resource_id     = p_resource_id
                  AND access_policy_contributes_to_cover(
                        ap.effect, ap.resource_id, ap.resource_scope,
                        ap.revoked, ap.expires_at)
            ) AS unrolled;
    END IF;

    IF array_length(v_app_ids, 1) IS NULL THEN
        -- No contributing policies left — DELETE the cover row.
        IF p_subject_type = 3 THEN
            DELETE FROM public_resources
                WHERE resource_type = p_resource_type
                  AND resource_id   = p_resource_id;
        ELSIF p_subject_type = 2 THEN
            DELETE FROM server_member_resources
                WHERE resource_type = p_resource_type
                  AND resource_id   = p_resource_id;
        ELSIF p_subject_type = 1 THEN
            DELETE FROM user_group_accessible_resources
                WHERE user_group_id = p_subject_id
                  AND resource_type = p_resource_type
                  AND resource_id   = p_resource_id;
        END IF;
        RETURN;
    END IF;

    SELECT s.sort_created, s.sort_modified, s.sort_name
        INTO v_sort_created, v_sort_modified, v_sort_name
        FROM fetch_listing_sort_keys(p_resource_type, p_resource_id) s;

    IF v_sort_created IS NULL THEN
        -- Resource type not covered in v1 (or the resource row was
        -- deleted between policy write and trigger fire). Skip.
        RETURN;
    END IF;

    IF p_subject_type = 3 THEN
        INSERT INTO public_resources (
            resource_type, resource_id, sort_created, sort_modified,
            sort_name, app_ids, actions
        ) VALUES (
            p_resource_type, p_resource_id, v_sort_created, v_sort_modified,
            v_sort_name, v_app_ids, v_actions
        )
        ON CONFLICT (resource_type, resource_id) DO UPDATE SET
            sort_created  = EXCLUDED.sort_created,
            sort_modified = EXCLUDED.sort_modified,
            sort_name     = EXCLUDED.sort_name,
            app_ids       = EXCLUDED.app_ids,
            actions       = EXCLUDED.actions;
    ELSIF p_subject_type = 2 THEN
        INSERT INTO server_member_resources (
            resource_type, resource_id, sort_created, sort_modified,
            sort_name, app_ids, actions
        ) VALUES (
            p_resource_type, p_resource_id, v_sort_created, v_sort_modified,
            v_sort_name, v_app_ids, v_actions
        )
        ON CONFLICT (resource_type, resource_id) DO UPDATE SET
            sort_created  = EXCLUDED.sort_created,
            sort_modified = EXCLUDED.sort_modified,
            sort_name     = EXCLUDED.sort_name,
            app_ids       = EXCLUDED.app_ids,
            actions       = EXCLUDED.actions;
    ELSIF p_subject_type = 1 THEN
        INSERT INTO user_group_accessible_resources (
            user_group_id, resource_type, resource_id, sort_created,
            sort_modified, sort_name, app_ids, actions
        ) VALUES (
            p_subject_id, p_resource_type, p_resource_id, v_sort_created,
            v_sort_modified, v_sort_name, v_app_ids, v_actions
        )
        ON CONFLICT (user_group_id, resource_type, resource_id) DO UPDATE SET
            sort_created  = EXCLUDED.sort_created,
            sort_modified = EXCLUDED.sort_modified,
            sort_name     = EXCLUDED.sort_name,
            app_ids       = EXCLUDED.app_ids,
            actions       = EXCLUDED.actions;
    END IF;
END;
$$;

-- 7. Trigger on access_policies ----------------------------------------
-- Fires AFTER every INSERT/UPDATE/DELETE. Identifies the (subject,
-- resource) pairs whose coverage may have changed and recomputes the
-- matching cover row. INSERT / DELETE touch one pair; UPDATE touches
-- up to two (OLD and NEW) — both are recomputed in case the policy
-- moved between subjects or resources.
CREATE OR REPLACE FUNCTION access_policies_cover_maintenance_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Only the three covered subject_types are interesting.
    -- subject_type = 0 (User) never lands in a cover table.
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.subject_type IN (1, 2, 3) AND NEW.resource_id IS NOT NULL THEN
            PERFORM refresh_listing_cover_row(
                NEW.subject_type, NEW.subject_id,
                NEW.resource_type, NEW.resource_id
            );
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF OLD.subject_type IN (1, 2, 3) AND OLD.resource_id IS NOT NULL
           AND (
                TG_OP = 'DELETE'
                OR OLD.subject_type   IS DISTINCT FROM NEW.subject_type
                OR OLD.subject_id     IS DISTINCT FROM NEW.subject_id
                OR OLD.resource_type  IS DISTINCT FROM NEW.resource_type
                OR OLD.resource_id    IS DISTINCT FROM NEW.resource_id
           )
        THEN
            PERFORM refresh_listing_cover_row(
                OLD.subject_type, OLD.subject_id,
                OLD.resource_type, OLD.resource_id
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER access_policies_cover_maintenance
    AFTER INSERT OR UPDATE OR DELETE ON access_policies
    FOR EACH ROW EXECUTE FUNCTION access_policies_cover_maintenance_fn();

-- 8. Sort-key mirror trigger on files ---------------------------------
-- When a file's name or modified_time changes, propagate to any cover
-- rows that reference it. created_time is immutable so we don't need
-- to mirror it. Only fires when one of the mirrored columns actually
-- changes (no-op on metadata-only writes).
CREATE OR REPLACE FUNCTION files_listing_sort_mirror_fn()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.name          IS DISTINCT FROM OLD.name
       OR NEW.modified_time IS DISTINCT FROM OLD.modified_time
    THEN
        UPDATE public_resources
            SET sort_name = NEW.name, sort_modified = NEW.modified_time
            WHERE resource_type = 0 AND resource_id = NEW.id;
        UPDATE server_member_resources
            SET sort_name = NEW.name, sort_modified = NEW.modified_time
            WHERE resource_type = 0 AND resource_id = NEW.id;
        UPDATE user_group_accessible_resources
            SET sort_name = NEW.name, sort_modified = NEW.modified_time
            WHERE resource_type = 0 AND resource_id = NEW.id;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER files_listing_sort_mirror
    AFTER UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION files_listing_sort_mirror_fn();

-- 9. Backfill ----------------------------------------------------------
-- Build cover rows from the current state of access_policies. Walks
-- the distinct (subject_type, subject_id, resource_type, resource_id)
-- tuples that contribute and recomputes each. Idempotent — the
-- function handles both INSERT and UPDATE branches via UPSERT.
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT DISTINCT subject_type, subject_id, resource_type, resource_id
        FROM   access_policies
        WHERE  subject_type IN (1, 2, 3)
          AND  resource_id IS NOT NULL
          AND  access_policy_contributes_to_cover(
                  effect, resource_id, resource_scope, revoked, expires_at)
    LOOP
        PERFORM refresh_listing_cover_row(
            r.subject_type, r.subject_id, r.resource_type, r.resource_id
        );
    END LOOP;
END;
$$;
