// @generated automatically by Diesel CLI.

diesel::table! {
    files (file_id) {
        file_id -> Uuid,
        owner_id -> Uuid,
        mime_type -> Text,
        file_name -> Text,
        created_time -> Timestamp,
        modified_time -> Timestamp,
    }
}

diesel::table! {
    users (user_id) {
        user_id -> Uuid,
        external_user_id -> Nullable<Text>,
        display_name -> Text,
        created_time -> Timestamp,
    }
}
