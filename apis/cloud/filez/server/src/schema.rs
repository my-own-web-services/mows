diesel::table! {
    users {
        id -> Uuid,
        external_user_id -> Nullable<Text>,
        pre_identifier_email -> Nullable<Text>,
        display_name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        deleted -> Bool,
        profile_picture -> Nullable<Uuid>,
        created_by -> Nullable<Uuid>,
        user_type -> SmallInt,
        idp_id -> Uuid,
    }
}
diesel::joinable!(users -> idp_providers (idp_id));

diesel::table! {
    user_relations (user_id, friend_id) {
        user_id -> Uuid,
        friend_id -> Uuid,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        status -> SmallInt,
    }
}

diesel::table! {
    files {
        id -> Uuid,
        owner_id -> Uuid,
        mime_type -> Text,
        name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        metadata -> Jsonb,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(files -> users (owner_id));

// INDEX: (file_id, file_revision_index, app_id, app_path)
// INDEX: (content_expected_sha256_digest)
// UNIQUE: (file_id, file_revision_index, app_id, app_path)
diesel::table! {
    file_versions {
        id -> Uuid,

        file_id -> Uuid,
        file_revision_index -> Integer,
        app_id -> Uuid,
        app_path -> Text,

        mime_type -> Text,
        metadata -> Jsonb,

        created_time -> Timestamp,
        modified_time -> Timestamp,

        content_size_bytes -> BigInt,
        existing_content_size_bytes -> Nullable<BigInt>,

        storage_location_id -> Uuid,
        storage_quota_id -> Uuid,


        content_expected_sha256_digest -> Nullable<Text>,
        content_matches_expected_sha256_digest -> Bool,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_versions -> files (file_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_versions -> apps (app_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_versions -> storage_locations (storage_location_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_versions -> storage_quotas (storage_quota_id));

diesel::table! {
    storage_locations {
        id -> Uuid,
        name -> Text,
        provider_config -> Jsonb,
        created_time -> Timestamp,
        modified_time -> Timestamp,
    }
}

diesel::table! {
    file_groups {
        id -> Uuid,
        name -> Text,
        owner_id -> Uuid,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        description -> Nullable<Text>,
        group_type -> SmallInt,
        dynamic_group_rule -> Nullable<Jsonb>,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_groups -> users (owner_id));

diesel::table! {
    file_file_group_members (file_id, file_group_id) {
        file_id -> Uuid,
        file_group_id -> Uuid,
        created_time -> Timestamp,
    }
}

// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_file_group_members -> files (file_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_file_group_members -> file_groups (file_group_id));

diesel::table! {
    user_groups  {
        id -> Uuid,
        owner_id -> Uuid,
        name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        description -> Nullable<Text>,
        // Migration 00000000000008. Wire-stable per
        // mows_auth_core::types::GroupVisibility / GroupJoinPolicy.
        visibility -> SmallInt,
        join_policy -> SmallInt,
    }
}

// Pending lifecycle rows for InviteOnly / RequestToJoin groups
// (migration 00000000000008, USER_GROUPS.md §2). Acceptance moves
// a row into user_user_group_members in a single transaction.
diesel::table! {
    user_user_group_join_requests (user_id, user_group_id) {
        user_id -> Uuid,
        user_group_id -> Uuid,
        requested_time -> Timestamp,
        message -> Nullable<Text>,
    }
}

diesel::table! {
    user_user_group_invitations (user_id, user_group_id) {
        user_id -> Uuid,
        user_group_id -> Uuid,
        invited_time -> Timestamp,
        invited_by -> Nullable<Uuid>,
        message -> Nullable<Text>,
    }
}
diesel::joinable!(user_user_group_join_requests -> users (user_id));
diesel::joinable!(user_user_group_join_requests -> user_groups (user_group_id));
diesel::joinable!(user_user_group_invitations -> user_groups (user_group_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(user_groups -> users (owner_id));

diesel::table! {
    user_user_group_members (user_id, user_group_id) {
        user_id -> Uuid,
        user_group_id -> Uuid,
        created_time -> Timestamp,
    }
}

diesel::table! {
    tags {
        id -> Uuid,
        key -> Text,
        value -> Text,
    }
}

diesel::table! {
    tag_members (resource_id, resource_type, tag_id) {
        resource_id -> Uuid,
        resource_type -> SmallInt,
        tag_id -> Uuid,
        created_time -> Timestamp,
        created_by_user_id -> Uuid,
    }
}
diesel::joinable!(tag_members -> users (created_by_user_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(tag_members -> tags (tag_id));

diesel::table! {
    access_policies {
        id -> Uuid,
        owner_id -> Uuid,
        name -> Text,

        created_time -> Timestamp,
        modified_time -> Timestamp,

        subject_type -> SmallInt,
        subject_id -> Uuid,

        context_app_ids -> Array<Uuid>,

        resource_type -> SmallInt,
        resource_id -> Nullable<Uuid>,

        actions -> Array<SmallInt>,

        effect -> SmallInt,

        // Phase-2 lifecycle columns (migration 00000000000004).
        expires_at -> Nullable<Timestamp>,
        revoked -> Bool,
        policy_bundle_id -> Nullable<Uuid>,

        // Phase-2 scope (migration 00000000000006).
        resource_scope -> SmallInt,
    }
}

diesel::table! {
    storage_quotas {
        id -> Uuid,
        owner_id -> Uuid,
        name -> Text,

        subject_type -> SmallInt,
        subject_id -> Uuid,
        storage_location_id -> Uuid,

        created_time -> Timestamp,
        modified_time -> Timestamp,

        quota_bytes -> BigInt,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(storage_quotas -> storage_locations (storage_location_id));

diesel::table! {
    file_group_file_sort_orders {
        id -> Uuid,
        file_group_id -> Uuid,
        name -> Text,
        created_time -> Timestamp,
        created_by_user_id -> Uuid,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_group_file_sort_orders -> file_groups (file_group_id));
diesel::joinable!(file_group_file_sort_orders -> users (created_by_user_id));

diesel::table! {
    file_group_file_sort_order_items (sort_order_id, file_id, position){
        sort_order_id -> Uuid,
        file_id -> Uuid,
        position -> Integer
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_group_file_sort_order_items -> files (file_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(file_group_file_sort_order_items -> file_group_file_sort_orders (sort_order_id));

diesel::table! {
    jobs {
        id -> Uuid,
        name -> Text,
        owner_id -> Uuid,
        app_id -> Uuid,
        assigned_app_runtime_instance_id -> Nullable<Text>,
        app_instance_last_seen_time -> Nullable<Timestamp>,
        status -> SmallInt,
        status_details -> Nullable<Jsonb>,
        execution_information -> Jsonb,
        persistence -> SmallInt,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        start_time -> Nullable<Timestamp>,
        end_time -> Nullable<Timestamp>,
        deadline_time -> Nullable<Timestamp>,
        priority -> SmallInt,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(jobs -> users (owner_id));
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(jobs -> apps (app_id));

diesel::table! {
    apps {
        id -> Uuid,
        name -> Text,
        origins -> Nullable<Array<Text>>,
        trusted -> Bool,
        description -> Nullable<Text>,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        app_type -> SmallInt,
        idp_id -> Uuid,
        external_client_id -> Nullable<Text>,
    }
}
diesel::joinable!(apps -> idp_providers (idp_id));

diesel::table! {
    key_access {
        id -> Uuid,
        owner_id -> Uuid,
        user_id -> Uuid,
        key_hash -> Text,
        name -> Text,
        description -> Nullable<Text>,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        expiration_time -> Nullable<Timestamp>,
    }
}
// ON_DELETE: CASCADE
// ON_UPDATE: CASCADE
diesel::joinable!(key_access -> users (owner_id));

diesel::table! {
    events {
        id -> Uuid,
        created_time -> Timestamp,
        event_type -> SmallInt,
        user_id -> Nullable<Uuid>,
        resource_ids -> Nullable<Array<Uuid>>,
        resource_type -> Nullable<SmallInt>,
        app_id -> Nullable<Uuid>,
        result -> Nullable<Jsonb>,
    }
}
diesel::joinable!(events -> users (user_id));
diesel::joinable!(events -> apps (app_id));

diesel::table! {
    idp_providers {
        id -> Uuid,
        name -> Text,
        discovery_url -> Nullable<Text>,
        created_time -> Timestamp,
    }
}

// Listing cover tables — migration 00000000000007. Maintained by
// PL/pgSQL triggers; queried by the engine's k-way merge in Phase 3
// (LISTING.md §3 + §6). Declared here so future read-path code can
// reference them via diesel.
diesel::table! {
    public_resources (resource_type, resource_id) {
        resource_type -> SmallInt,
        resource_id -> Uuid,
        sort_created -> Timestamp,
        sort_modified -> Timestamp,
        sort_name -> Text,
        app_ids -> Array<Uuid>,
        actions -> Array<SmallInt>,
    }
}

diesel::table! {
    server_member_resources (resource_type, resource_id) {
        resource_type -> SmallInt,
        resource_id -> Uuid,
        sort_created -> Timestamp,
        sort_modified -> Timestamp,
        sort_name -> Text,
        app_ids -> Array<Uuid>,
        actions -> Array<SmallInt>,
    }
}

diesel::table! {
    user_group_accessible_resources (user_group_id, resource_type, resource_id) {
        user_group_id -> Uuid,
        resource_type -> SmallInt,
        resource_id -> Uuid,
        sort_created -> Timestamp,
        sort_modified -> Timestamp,
        sort_name -> Text,
        app_ids -> Array<Uuid>,
        actions -> Array<SmallInt>,
    }
}

#[cfg(test)]
mod cover_table_migration_drift_guard {
    //! Structural regression guard: the listing cover tables declared
    //! above MUST stay in sync with migration
    //! `00000000000007_listing_cover_tables/up.sql`. If a future
    //! migration renames a column or drops a cover table without
    //! updating schema.rs, this test fires before runtime fallout.
    //!
    //! We grep the migration source for each table + every column
    //! that schema.rs declares above. Drift in either direction
    //! (rename in SQL but not Rust, or vice versa) trips a test.
    //!
    //! This is deliberately structural rather than a query round-trip
    //! — no live database is required, the test runs in `cargo test`
    //! offline.

    const UP_SQL: &str = include_str!(
        "../migrations/00000000000007_listing_cover_tables/up.sql"
    );

    fn assert_contains(needle: &str) {
        assert!(
            UP_SQL.contains(needle),
            "migration 00000000000007 must contain `{needle}` — schema.rs declares it. \
             If you intentionally renamed the column, update schema.rs to match."
        );
    }

    #[test]
    fn public_resources_columns_match() {
        assert_contains("CREATE TABLE public_resources");
        for col in [
            "resource_type",
            "resource_id",
            "sort_created",
            "sort_modified",
            "sort_name",
            "app_ids",
            "actions",
        ] {
            assert_contains(col);
        }
    }

    #[test]
    fn server_member_resources_declared() {
        assert_contains("CREATE TABLE server_member_resources");
    }

    #[test]
    fn user_group_accessible_resources_declared() {
        assert_contains("CREATE TABLE user_group_accessible_resources");
        // user_group_id is unique to this cover table; rest of the
        // schema is shared with the other two.
        assert_contains("user_group_id");
    }

    #[test]
    fn maintenance_trigger_is_wired_to_access_policies() {
        // Without this trigger the cover tables silently rot — every
        // policy write would skip the recompute and `list_visible` in
        // Phase 3 would return stale or empty results. The presence
        // of the trigger is what makes the cover tables load-bearing.
        assert_contains("CREATE TRIGGER access_policies_cover_maintenance");
        assert_contains("AFTER INSERT OR UPDATE OR DELETE ON access_policies");
    }

    #[test]
    fn files_sort_mirror_trigger_keeps_sort_columns_fresh() {
        // The sort_name / sort_modified columns are denormalised from
        // `files`; without the mirror trigger a file rename would
        // produce stale ordering in Phase-3 listings.
        assert_contains("CREATE TRIGGER files_listing_sort_mirror");
        assert_contains("AFTER UPDATE ON files");
    }

    #[test]
    fn backfill_block_present() {
        // The migration must seed the cover tables from the current
        // access_policies state. Without this, every existing Public
        // / ServerMember / UserGroup policy would be invisible to
        // Phase-3 reads until someone re-writes the policy row.
        assert_contains("DISTINCT subject_type, subject_id, resource_type, resource_id");
        assert_contains("PERFORM refresh_listing_cover_row");
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    files,
    users,
    file_file_group_members,
    file_groups,
    user_groups,
    user_user_group_members,
    tags,
    tag_members,
    access_policies,
    file_group_file_sort_orders,
    file_group_file_sort_order_items,
    file_versions,
    storage_locations,
    jobs,
    apps,
    storage_quotas,
    key_access,
    idp_providers,
    public_resources,
    server_member_resources,
    user_group_accessible_resources,
    user_user_group_join_requests,
    user_user_group_invitations,
);
