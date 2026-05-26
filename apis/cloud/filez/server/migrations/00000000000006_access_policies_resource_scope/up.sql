-- resource_scope per DATA_MODEL.md §2.4 + POLICY_SEMANTICS.md §4.
--
-- Three values, wire-stable per mows_auth_core::types::ResourceScope:
--   0 = Single (current behaviour: resource_id pins the target)
--   1 = OwnedByOwner (resource_id IS NULL; policy applies to every
--                     resource of resource_type owned by the policy's owner)
--   2 = AccessibleByOwner (resource_id IS NULL; recursive — applies to
--                          every resource the policy's owner can access;
--                          cycle-broken depth-1 per POLICY_SEMANTICS.md §4)
--
-- Default 0 (Single) so every existing row keeps its current semantics.

ALTER TABLE access_policies
    ADD COLUMN resource_scope SMALLINT NOT NULL DEFAULT 0;
