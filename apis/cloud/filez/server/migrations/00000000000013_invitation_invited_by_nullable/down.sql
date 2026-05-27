ALTER TABLE user_user_group_invitations
    DROP CONSTRAINT IF EXISTS user_user_group_invitations_invited_by_fkey;

-- Set any NULL inviters to a placeholder so the NOT NULL constraint
-- can be re-applied without failing on existing data. We use the
-- nobody sentinel as the placeholder — preferable to discarding the
-- invitation row.
UPDATE user_user_group_invitations
    SET invited_by = '0000bad1-0000-0000-0000-000000000001'
    WHERE invited_by IS NULL;

ALTER TABLE user_user_group_invitations
    ALTER COLUMN invited_by SET NOT NULL;

ALTER TABLE user_user_group_invitations
    ADD CONSTRAINT user_user_group_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES users(id);
