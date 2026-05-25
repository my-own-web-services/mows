-- All secondary indexes (resource sort, access_policies, ffgm
-- inverse, cover-table indexes). Applied AFTER the bulk seed for
-- 10× faster seed time at target scale.

BEGIN;

-- access_policies
CREATE INDEX ap_lookup_idx
    ON access_policies (resource_type, resource_id, subject_type, subject_id)
    WHERE NOT revoked;

CREATE INDEX ap_subject_idx
    ON access_policies (subject_type, subject_id, resource_type)
    WHERE NOT revoked;

-- TECH-7: GIN indexes are partial on NOT revoked. Every query that uses
-- these GIN paths also filters revoked, and including revoked rows would
-- bloat the GIN structure unnecessarily as the policy table ages.
CREATE INDEX ap_context_apps_gin
    ON access_policies USING GIN (context_app_ids)
    WHERE NOT revoked;

CREATE INDEX ap_actions_gin
    ON access_policies USING GIN (actions)
    WHERE NOT revoked;

-- files sort indexes
CREATE INDEX files_owner_created_id_idx
    ON files (owner_id, created_time DESC, id DESC);
CREATE INDEX files_created_id_idx
    ON files (created_time DESC, id DESC);
CREATE INDEX files_modified_id_idx
    ON files (modified_time DESC, id DESC);

-- file_groups, ffgm
CREATE INDEX file_groups_owner_idx
    ON file_groups (owner_id, created_time DESC);
CREATE INDEX ffgm_group_idx
    ON file_file_group_members (file_group_id, file_id);

-- user_groups
CREATE INDEX user_groups_owner_idx ON user_groups (owner_id);
CREATE INDEX uugm_group_idx ON user_user_group_members (user_group_id, user_id);

-- public_resources cover
CREATE INDEX public_resources_by_created
    ON public_resources (resource_type, sort_created DESC, resource_id DESC);
CREATE INDEX public_resources_by_modified
    ON public_resources (resource_type, sort_modified DESC, resource_id DESC);
CREATE INDEX public_resources_by_name
    ON public_resources (resource_type, sort_name, resource_id);
CREATE INDEX public_resources_apps_gin
    ON public_resources USING GIN (app_ids);
CREATE INDEX public_resources_actions_gin
    ON public_resources USING GIN (actions);

-- server_member_resources cover
CREATE INDEX server_member_resources_by_created
    ON server_member_resources (resource_type, sort_created DESC, resource_id DESC);
CREATE INDEX server_member_resources_apps_gin
    ON server_member_resources USING GIN (app_ids);
CREATE INDEX server_member_resources_actions_gin
    ON server_member_resources USING GIN (actions);

-- user_group_accessible_resources cover
CREATE INDEX uga_resources_by_created
    ON user_group_accessible_resources
       (user_group_id, resource_type, sort_created DESC, resource_id DESC);

-- helpful uniques
CREATE UNIQUE INDEX users_external_user_id_uniq
    ON users (external_user_id) WHERE external_user_id IS NOT NULL;
CREATE UNIQUE INDEX apps_name_uniq ON apps (name);

COMMIT;
