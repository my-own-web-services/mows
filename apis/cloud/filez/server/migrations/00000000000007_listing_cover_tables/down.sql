-- Reverse order of up.sql.

DROP TRIGGER IF EXISTS files_listing_sort_mirror             ON files;
DROP FUNCTION IF EXISTS files_listing_sort_mirror_fn();

DROP TRIGGER IF EXISTS access_policies_cover_maintenance     ON access_policies;
DROP FUNCTION IF EXISTS access_policies_cover_maintenance_fn();

DROP FUNCTION IF EXISTS refresh_listing_cover_row(SMALLINT, UUID, SMALLINT, UUID);
DROP FUNCTION IF EXISTS access_policy_contributes_to_cover(SMALLINT, UUID, SMALLINT, BOOLEAN, TIMESTAMP);
DROP FUNCTION IF EXISTS fetch_listing_sort_keys(SMALLINT, UUID);

DROP TABLE IF EXISTS user_group_accessible_resources;
DROP TABLE IF EXISTS server_member_resources;
DROP TABLE IF EXISTS public_resources;
