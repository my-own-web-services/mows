-- Phase 6 Round 7 — user_groups + memberships.
--
-- The minimal slice needed to prove UserGroup-subject access
-- policies work in realtime-server, mirroring filez's group-share
-- semantics. Two tables only:
--
--   user_groups               - identity + ownership of a group
--   user_user_group_members   - who is in which group
--
-- Group-lifecycle UX (invite, request-to-join, leave, visibility,
-- join_policy) is NOT in scope here; realtime-server doesn't expose
-- group-mgmt today, so the only consumer is the auth middleware
-- (resolves the caller's memberships when building
-- mows_auth_core::Subject) plus direct SQL fixtures used by tests.
-- When realtime-server grows a group-mgmt surface, the filez set
-- is the template to copy from.

CREATE TABLE "user_groups" (
    "id" UUID NOT NULL PRIMARY KEY,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_time" TIMESTAMP NOT NULL,
    "modified_time" TIMESTAMP NOT NULL
);

CREATE INDEX "user_groups_by_owner" ON "user_groups" ("owner_id");

CREATE TABLE "user_user_group_members" (
    "user_id" UUID NOT NULL,
    "user_group_id" UUID NOT NULL REFERENCES "user_groups"("id") ON DELETE CASCADE,
    "joined_at" TIMESTAMP NOT NULL,
    PRIMARY KEY ("user_id", "user_group_id")
);

-- The middleware queries memberships by user_id on every
-- authenticated request:
--   SELECT user_group_id FROM user_user_group_members WHERE user_id = $1
-- The PRIMARY KEY (user_id, user_group_id) already serves this
-- lookup via prefix scan, so no extra by-user index is needed.
