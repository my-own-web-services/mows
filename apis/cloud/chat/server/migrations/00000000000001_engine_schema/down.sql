ALTER TABLE channel_messages DROP CONSTRAINT IF EXISTS channel_messages_author_id_fkey;
ALTER TABLE channels         DROP CONSTRAINT IF EXISTS channels_owner_id_fkey;

DROP INDEX IF EXISTS access_policies_policy_bundle_id_idx;
DROP INDEX IF EXISTS access_policies_owner_idx;
DROP INDEX IF EXISTS access_policies_subject_idx;
DROP INDEX IF EXISTS access_policies_lookup_idx;

DROP TABLE IF EXISTS access_policies;
DROP TABLE IF EXISTS apps;
DROP INDEX IF EXISTS users_idp_external_id_idx;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS idp_providers;
