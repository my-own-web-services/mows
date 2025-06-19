diesel::table! {
    files {
        id -> Uuid,
        owner_id -> Uuid,
        mime_type -> Text,
        file_name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        size -> Numeric,
    }
}
diesel::joinable!(files -> users (owner_id));

diesel::table! {
    users {
        id -> Uuid,
        external_user_id -> Nullable<Text>,
        display_name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        deleted -> Bool,
        storage_limit -> Numeric,
    }
}

diesel::table! {
    file_file_group_members (file_id, file_group_id) {
        file_id -> Uuid,
        file_group_id -> Uuid,
        created_time -> Timestamp,
    }
}
diesel::joinable!(file_file_group_members -> files (file_id));
diesel::joinable!(file_file_group_members -> file_groups (file_group_id));

diesel::table! {
    file_groups {
        id -> Uuid,
        owner_id -> Uuid,
        name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        description -> Nullable<Text>,
    }
}
diesel::joinable!(file_groups -> users (owner_id));

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
diesel::joinable!(user_groups -> users (owner_id));

diesel::table! {
    user_user_group_members (user_id, user_group_id) {
        user_id -> Uuid,
        user_group_id -> Uuid,
        created_time -> Timestamp,
    }
}

diesel::table! {
    apps {
        id -> Uuid,
        owner_id -> Uuid,
        name -> Text,
        trusted -> Bool,
        origins -> Nullable<Array<Text>>,
        created_time -> Timestamp,
        modified_time -> Timestamp,
        description -> Nullable<Text>,
    }
}
diesel::joinable!(apps -> users (owner_id));

diesel::table! {
    tags {
        id -> Uuid,
        key -> Text,
        value -> Text,
    }
}

diesel::table! {
    file_tag_members (file_id, tag_id) {
        file_id -> Uuid,
        tag_id -> Uuid,
        created_time -> Timestamp,
        created_by_user_id -> Uuid,
    }
}
diesel::joinable!(file_tag_members -> users (created_by_user_id));

diesel::table! {
    access_policies {
        id -> Uuid,
        owner_id -> Uuid,
        name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,

        subject_type -> Text,
        subject_id -> Uuid,

        context_app_id -> Nullable<Uuid>,

        resource_type -> Text,
        resource_id -> Uuid,

        action -> Text,

        effect -> Text,
    }
}

diesel::table! {
    file_group_file_sort_orders {
        id -> Uuid,
        file_group_id -> Uuid,
        name -> Text,
        created_time -> Timestamp,
        created_by_user_id -> Uuid,
    }
}
diesel::joinable!(file_group_file_sort_orders -> file_groups (file_group_id));
diesel::joinable!(file_group_file_sort_orders -> users (created_by_user_id));

diesel::table! {
    file_group_file_sort_order_items (sort_order_id, file_id, position){
        sort_order_id -> Uuid,
        file_id -> Uuid,
        position -> Integer
    }
}
diesel::joinable!(file_group_file_sort_order_items -> files (file_id));
diesel::joinable!(file_group_file_sort_order_items -> file_group_file_sort_orders (sort_order_id));

diesel::allow_tables_to_appear_in_same_query!(
    files,
    users,
    file_file_group_members,
    file_groups,
    user_groups,
    user_user_group_members,
    apps,
    tags,
    file_tag_members,
    access_policies,
    file_group_file_sort_orders,
    file_group_file_sort_order_items,
);
