-- Phase 4 multi-review MIN-5 / TASTE-8 fix.
--
-- The original `invited_by` column on `user_user_group_invitations`
-- carried `NOT NULL REFERENCES users(id)` with no ON DELETE clause.
-- Combined with USER_GROUPS.md §7.5 (which transfers owned groups
-- to the system `nobody` sentinel when a user is soft-deleted but
-- does NOT touch invitations the user issued), this left a
-- consistency hole:
--
--   * The inviter soft-deletes their account.
--   * `users.deleted` flips to TRUE for that row.
--   * Old invitations still reference the row via `invited_by`.
--   * If a future migration ever HARD-deletes soft-deleted rows
--     the FK fires and either errors out or cascades unexpectedly.
--   * The invitee accepting an invitation now points at a deleted
--     inviter — should we accept? Decline? The schema doesn't say.
--
-- Make `invited_by` nullable + add `ON DELETE SET NULL`. The
-- existence of the invitation row is still authoritative for
-- acceptance; `invited_by IS NULL` means "the inviter is gone, but
-- the offer stands" which matches USER_GROUPS.md §7.4 ("Leave it;
-- if the user acts on it we accept; if they ignore it the
-- invitation expires").

ALTER TABLE user_user_group_invitations
    ALTER COLUMN invited_by DROP NOT NULL;

ALTER TABLE user_user_group_invitations
    DROP CONSTRAINT IF EXISTS user_user_group_invitations_invited_by_fkey;

ALTER TABLE user_user_group_invitations
    ADD CONSTRAINT user_user_group_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;
