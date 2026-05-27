DROP INDEX IF EXISTS user_user_group_invitations_by_user;
DROP INDEX IF EXISTS user_user_group_join_requests_by_user;

DROP TABLE IF EXISTS user_user_group_invitations;
DROP TABLE IF EXISTS user_user_group_join_requests;

ALTER TABLE user_groups DROP COLUMN IF EXISTS join_policy;
ALTER TABLE user_groups DROP COLUMN IF EXISTS visibility;
