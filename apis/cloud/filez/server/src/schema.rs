// @generated automatically by Diesel CLI.

diesel::table! {
    files (file_id) {
        file_id -> Uuid,
        owner_id -> Uuid,
        mime_type -> Text,
        file_name -> Text,
        created_at -> Timestamp,
    }
}
