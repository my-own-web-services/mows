// @generated automatically by Diesel CLI.

diesel::table! {
    files {
        id -> Uuid,
        owner_id -> Uuid,
        mime_type -> Text,
        file_name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
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
        file_group_name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
    }
}

diesel::joinable!(file_groups -> users (owner_id));

diesel::table! {
    user_groups  {
        id -> Uuid,
        owner_id -> Uuid,
        user_group_name -> Text,
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
    tags (key, value, file_id) {
        file_id -> Uuid,
        key -> Text,
        value -> Text,
        created_time -> Timestamp,
    }
}

diesel::joinable!(tags -> files (file_id));

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
