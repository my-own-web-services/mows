DROP INDEX IF EXISTS apps_idp_external_client_id_idx;
ALTER TABLE apps DROP COLUMN external_client_id;
