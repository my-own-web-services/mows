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
    }
}

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
    }
}
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
    }
}

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
);
