-- Phase 2 schema gap-fill: user-group lifecycle columns + the two
-- pending-action tables (USER_GROUPS.md §2, DATA_MODEL.md §2.3).
--
-- Additive schema only — Phase 4 lands the HTTP endpoints + UI that
-- exercise these. The columns default to (Private, InviteOnly) so
-- every existing group keeps its current effective behaviour.

-- 1. Two-axis lifecycle columns. Wire-stable per
--    mows_auth_core::types::GroupVisibility / GroupJoinPolicy:
--      visibility  0 = Private, 1 = ListedRestricted, 2 = Public
--      join_policy 0 = InviteOnly, 1 = RequestToJoin, 2 = OpenJoin
ALTER TABLE user_groups
    ADD COLUMN visibility  SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN join_policy SMALLINT NOT NULL DEFAULT 0;

-- 2. Pending join requests. Populated by users hitting
--    POST /api/user_groups/{id}/join_requests on RequestToJoin
--    groups (USER_GROUPS.md §6). One row per (user, group) — a
--    second request for the same group is a no-op.
CREATE TABLE user_user_group_join_requests (
    user_id        UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE ON UPDATE CASCADE,
    user_group_id  UUID NOT NULL REFERENCES user_groups(id)  ON DELETE CASCADE ON UPDATE CASCADE,
    requested_time TIMESTAMP NOT NULL,
    message        TEXT NULL,
    PRIMARY KEY (user_id, user_group_id)
);

-- 3. Pending invitations from owners to users. Populated by owners
--    hitting POST /api/user_groups/{id}/invitations on InviteOnly or
--    RequestToJoin groups. Acceptance moves the row to
--    user_user_group_members in a single transaction.
CREATE TABLE user_user_group_invitations (
    user_id        UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE ON UPDATE CASCADE,
    user_group_id  UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE ON UPDATE CASCADE,
    invited_time   TIMESTAMP NOT NULL,
    invited_by     UUID NOT NULL REFERENCES users(id),
    message        TEXT NULL,
    PRIMARY KEY (user_id, user_group_id)
);

-- Per USER_GROUPS.md §7 edge cases: directory listings of pending
-- invitations / join requests filter by user_id, so an index on the
-- non-PK leading column helps the per-user dashboard query.
CREATE INDEX user_user_group_join_requests_by_user
    ON user_user_group_join_requests (user_id);
CREATE INDEX user_user_group_invitations_by_user
    ON user_user_group_invitations (user_id);
