DROP INDEX IF EXISTS user_groups_materialized;
DROP FUNCTION IF EXISTS recompute_user_group_materialize_flags();
DROP FUNCTION IF EXISTS user_group_materialize_threshold();
ALTER TABLE user_groups DROP COLUMN IF EXISTS materialize_uga;
