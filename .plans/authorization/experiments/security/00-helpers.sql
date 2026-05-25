-- Security test helpers. These wrap the PRIMITIVE — the same
-- `check_access(...)` function the production code calls and that
-- RLS calls for defence in depth. Asserting the primitive directly
-- means the security suite catches every regression in the canonical
-- implementation.

CREATE OR REPLACE FUNCTION user_group_ids_of(p_user uuid)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
    SELECT coalesce(array_agg(user_group_id), '{}'::uuid[])
    FROM   user_user_group_members
    WHERE  user_id = p_user
$$;

CREATE OR REPLACE FUNCTION assert_access(
    p_label text,
    p_user uuid, p_app uuid, p_resource_t smallint, p_resource uuid, p_action smallint,
    p_expected_outcome text,
    p_expected_allows bool
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_outcome text;
    v_allows  bool;
BEGIN
    -- THE primitive — same function the application calls.
    v_outcome := check_access(p_user, p_app, p_resource_t, p_resource, p_action);
    v_allows  := v_outcome IN ('SuperAdmin', 'TrustedAppOwned', 'Owned',
                               'AllowedByPolicy', 'AllowedByResourceGroup');
    IF v_outcome <> p_expected_outcome OR v_allows <> p_expected_allows THEN
        RAISE EXCEPTION
            '[%] FAIL — outcome=% allows=% expected_outcome=% expected_allows=%',
            p_label, v_outcome, v_allows, p_expected_outcome, p_expected_allows;
    ELSE
        RAISE NOTICE '[%] OK (%)', p_label, v_outcome;
    END IF;
END $$;
