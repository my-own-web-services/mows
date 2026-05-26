DROP INDEX IF EXISTS ap_policy_bundle_id_idx;
ALTER TABLE access_policies
    DROP COLUMN policy_bundle_id,
    DROP COLUMN revoked,
    DROP COLUMN expires_at;
