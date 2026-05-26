DROP INDEX IF EXISTS users_idp_external_id_idx;
ALTER TABLE apps  DROP COLUMN idp_id;
ALTER TABLE users DROP COLUMN idp_id;
