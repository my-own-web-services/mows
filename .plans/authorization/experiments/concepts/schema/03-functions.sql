-- Per-service auth functions live in the service's schema and
-- cross-schema-JOIN to mows_auth. This is what makes lists blazing
-- fast — one Postgres connection, one query plan, native cross-schema.

BEGIN;

-- check_access for files. Returns the AuthReason string.
CREATE OR REPLACE FUNCTION filez.check_access(
    p_user uuid, p_app uuid, p_file uuid, p_action smallint
) RETURNS text LANGUAGE plpgsql STABLE PARALLEL SAFE
SET row_security = off
AS $$
DECLARE
    v_user_type smallint;
    v_owner     uuid;
    v_groups    uuid[];
    v_nil       uuid := '00000000-0000-0000-0000-000000000000';
    v_match     uuid;
    v_app_trust bool;
BEGIN
    IF p_user IS NOT NULL THEN
        SELECT user_type INTO v_user_type FROM mows_auth.users WHERE id = p_user;
        IF v_user_type = 0 THEN RETURN 'SuperAdmin'; END IF;
    END IF;
    SELECT owner_id INTO v_owner FROM filez.files WHERE id = p_file;
    IF v_owner IS NULL THEN RETURN 'ResourceNotFound'; END IF;
    SELECT trusted INTO v_app_trust FROM mows_auth.apps WHERE id = p_app;
    IF coalesce(v_app_trust, false) AND p_user = v_owner THEN
        RETURN 'TrustedAppOwned';
    END IF;
    v_groups := CASE WHEN p_user IS NOT NULL
                     THEN mows_auth.auth_user_group_ids(p_user)
                     ELSE '{}'::uuid[] END;

    -- DENY (direct) — cross-schema lookup to mows_auth.access_policies
    SELECT ap.id INTO v_match
    FROM   mows_auth.access_policies ap
    WHERE  ap.resource_type = 0
      AND  ap.resource_id   = p_file
      AND  ap.effect = 0
      AND  ap.actions @> ARRAY[p_action]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  NOT ap.revoked
      AND  (ap.expires_at IS NULL OR ap.expires_at > now())
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
         OR (ap.subject_type = 2 AND p_user IS NOT NULL)
         OR (ap.subject_type = 3))
    LIMIT 1;
    IF v_match IS NOT NULL THEN RETURN 'DeniedByPolicy'; END IF;

    IF p_user IS NOT NULL AND v_owner = p_user THEN RETURN 'Owned'; END IF;

    -- ALLOW (direct)
    SELECT ap.id INTO v_match
    FROM   mows_auth.access_policies ap
    WHERE  ap.resource_type = 0
      AND  ap.resource_id   = p_file
      AND  ap.effect = 1
      AND  ap.actions @> ARRAY[p_action]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  NOT ap.revoked
      AND  (ap.expires_at IS NULL OR ap.expires_at > now())
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
         OR (ap.subject_type = 2 AND p_user IS NOT NULL)
         OR (ap.subject_type = 3))
    LIMIT 1;
    IF v_match IS NOT NULL THEN RETURN 'AllowedByPolicy'; END IF;

    RETURN 'DefaultDeny';
END $$;

-- The atomic create-with-quota function. Owned by filez.
-- Returns the created file's id, or RAISEs on quota exhaustion.
CREATE OR REPLACE FUNCTION filez.create_file_with_quota(
    p_uploader        uuid,   -- the user attempting the create (NULL for anonymous)
    p_app             uuid,
    p_owner           uuid,   -- whose account this is debited to
    p_storage_loc     uuid,
    p_size            bigint,
    p_name            text,
    p_via_policy_id   uuid,
    p_file_group      uuid    -- optional file_group to add the file to
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
    v_file_id    uuid := gen_random_uuid();
    pq           filez.filez_policy_quotas%ROWTYPE;
    sq           filez.storage_quotas%ROWTYPE;
BEGIN
    -- 1. Engine permission check is the caller's job (filez.check_access).
    --    Here we trust the caller passed a valid via_policy_id.

    -- 2. Lock the per-policy quota row (if any) and check
    IF p_via_policy_id IS NOT NULL THEN
        SELECT * INTO pq FROM filez.filez_policy_quotas
            WHERE policy_id = p_via_policy_id FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PolicyHasNoQuotaRow';
        END IF;

        IF pq.max_bytes IS NOT NULL
            AND pq.used_bytes + p_size > pq.max_bytes
        THEN
            RAISE EXCEPTION 'PolicyByteQuotaExceeded: % + % > %',
                pq.used_bytes, p_size, pq.max_bytes;
        END IF;
        IF pq.max_files IS NOT NULL
            AND pq.used_files + 1 > pq.max_files
        THEN
            RAISE EXCEPTION 'PolicyFileQuotaExceeded';
        END IF;
        IF pq.max_per_file_bytes IS NOT NULL
            AND p_size > pq.max_per_file_bytes
        THEN
            RAISE EXCEPTION 'PolicyPerFileSizeExceeded';
        END IF;
    END IF;

    -- 3. Lock the storage_location row + check
    SELECT * INTO sq FROM filez.storage_quotas
        WHERE owner_id = p_owner AND storage_location_id = p_storage_loc
        FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OwnerHasNoStorageQuotaForLocation';
    END IF;

    IF sq.used_bytes + p_size > sq.quota_bytes THEN
        RAISE EXCEPTION 'StorageLocationQuotaExceeded';
    END IF;

    -- 4. Insert the file
    INSERT INTO filez.files (id, owner_id, name, size_bytes,
                             storage_location_id, created_via_policy_id)
    VALUES (v_file_id, p_owner, p_name, p_size,
            p_storage_loc, p_via_policy_id);

    -- Optionally add to a file_group
    IF p_file_group IS NOT NULL THEN
        INSERT INTO filez.file_file_group_members (file_id, file_group_id)
        VALUES (v_file_id, p_file_group);
    END IF;

    -- 5. Commit reservations
    IF p_via_policy_id IS NOT NULL THEN
        UPDATE filez.filez_policy_quotas
        SET    used_bytes = used_bytes + p_size,
               used_files = used_files + 1
        WHERE  policy_id = p_via_policy_id;
    END IF;

    UPDATE filez.storage_quotas
    SET    used_bytes = used_bytes + p_size
    WHERE  id = sq.id;

    RETURN v_file_id;
END $$;

COMMIT;
