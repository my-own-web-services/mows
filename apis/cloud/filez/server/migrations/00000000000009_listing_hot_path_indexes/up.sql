-- Phase 2 schema gap-fill: the hot-path indexes promised by
-- DATA_MODEL.md §2.4 + LISTING.md §11.
--
-- All read-only — no behaviour change. They support queries the
-- engine already issues (check_access on resource_id, listing on
-- subject); without them the queries fall back to seq scans at the
-- target scale (10M resources, 1M policies).

-- 1. Point check: "is there a policy on this (resource_type,
--    resource_id) for this (subject_type, subject_id)?" Used by
--    every check_access call. Partial on NOT revoked so the index
--    stays tight as revoked rows accumulate over time.
CREATE INDEX ap_lookup_idx
    ON access_policies (resource_type, resource_id, subject_type, subject_id)
    WHERE NOT revoked;

-- 2. Listing: "every policy this subject holds." Subject-first to
--    serve list_visible / list_access_policies pages. Same partial
--    predicate for the same reason.
CREATE INDEX ap_subject_idx
    ON access_policies (subject_type, subject_id, resource_type)
    WHERE NOT revoked;

-- 3 + 4. The two array-contains filters every PolicyStore method
--        applies: context_app_ids @> [app_id] and actions @> [action].
--        GIN is the canonical index for `@>` over postgres arrays.
CREATE INDEX ap_context_apps_gin
    ON access_policies USING GIN (context_app_ids);

CREATE INDEX ap_actions_gin
    ON access_policies USING GIN (actions);

-- 5–7. Per-resource sort indexes for `files` — the only resource
--      type whose listings hit the cover-table fast path today.
--      Triple-key (sort_col DESC, id DESC) supports keyset pagination
--      directly without a separate id-tiebreak step (LISTING.md §11).
CREATE INDEX files_owner_created_id_idx
    ON files (owner_id, created_time DESC, id DESC);
CREATE INDEX files_created_id_idx
    ON files (created_time DESC, id DESC);
CREATE INDEX files_modified_id_idx
    ON files (modified_time DESC, id DESC);

-- 8. Membership-table covering index for the group-mediated listing
--    path. The PK is already (file_id, file_group_id) — we add the
--    reverse so "all files in this group" is also O(matching rows).
CREATE INDEX file_file_group_members_by_group
    ON file_file_group_members (file_group_id, file_id);
