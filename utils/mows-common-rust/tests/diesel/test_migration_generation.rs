use mows_common_rust::diesel::schema::generate_migrations;
use std::path::PathBuf;

#[tokio::test]
async fn test_migration_generation() {
    let schema_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("diesel")
        .join("schema.rs");

    let migration_sql = generate_migrations(&schema_path)
        .await
        .expect("Failed to generate migration");

    println!("Generated migration:\n{}", migration_sql);

    // Verify that all tables are present
    assert!(migration_sql.contains("CREATE TABLE \"users\""));
    assert!(migration_sql.contains("CREATE TABLE \"user_relations\""));
    assert!(migration_sql.contains("CREATE TABLE \"files\""));
    assert!(migration_sql.contains("CREATE TABLE \"file_versions\""));
    assert!(migration_sql.contains("CREATE TABLE \"storage_locations\""));
    assert!(migration_sql.contains("CREATE TABLE \"file_groups\""));
    assert!(migration_sql.contains("CREATE TABLE \"file_file_group_members\""));
    assert!(migration_sql.contains("CREATE TABLE \"user_groups\""));
    assert!(migration_sql.contains("CREATE TABLE \"user_user_group_members\""));
    assert!(migration_sql.contains("CREATE TABLE \"tags\""));
    assert!(migration_sql.contains("CREATE TABLE \"tag_members\""));
    assert!(migration_sql.contains("CREATE TABLE \"access_policies\""));
    assert!(migration_sql.contains("CREATE TABLE \"storage_quotas\""));
    assert!(migration_sql.contains("CREATE TABLE \"file_group_file_sort_orders\""));
    assert!(migration_sql.contains("CREATE TABLE \"file_group_file_sort_order_items\""));
    assert!(migration_sql.contains("CREATE TABLE \"jobs\""));
    assert!(migration_sql.contains("CREATE TABLE \"apps\""));
    assert!(migration_sql.contains("CREATE TABLE \"key_access\""));
    assert!(migration_sql.contains("CREATE TABLE \"events\""));

    // Verify some column types
    assert!(migration_sql.contains("\"id\" UUID"));
    assert!(migration_sql.contains("\"name\" TEXT NOT NULL"));
    assert!(migration_sql.contains("\"created_time\" TIMESTAMP NOT NULL"));

    // Verify nullable columns
    assert!(migration_sql.contains("\"external_user_id\" TEXT,") ||
            migration_sql.contains("\"external_user_id\" TEXT\n"));

    // Verify foreign keys
    assert!(migration_sql.contains("FOREIGN KEY (\"owner_id\") REFERENCES \"users\"(\"id\")"));
    assert!(migration_sql.contains("FOREIGN KEY (\"file_id\") REFERENCES \"files\"(\"id\")"));

    // Verify cascade options
    assert!(migration_sql.contains("FOREIGN KEY (\"owner_id\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE"));
    assert!(migration_sql.contains("FOREIGN KEY (\"file_id\") REFERENCES \"files\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE"));
    assert!(migration_sql.contains("FOREIGN KEY (\"storage_location_id\") REFERENCES \"storage_locations\"(\"id\") ON DELETE RESTRICT"));

    // Verify composite primary keys
    assert!(migration_sql.contains("PRIMARY KEY (\"user_id\", \"friend_id\")"));
    assert!(migration_sql.contains("PRIMARY KEY (\"file_id\", \"version\", \"app_id\", \"app_path\")"));

    // Verify array types
    assert!(migration_sql.contains("UUID[]"));
    assert!(migration_sql.contains("TEXT[]"));
    assert!(migration_sql.contains("SMALLINT[]"));

    // Verify JSONB type
    assert!(migration_sql.contains("JSONB"));

    // Verify that users table comes before files table (dependency order)
    let users_pos = migration_sql.find("CREATE TABLE \"users\"").unwrap();
    let files_pos = migration_sql.find("CREATE TABLE \"files\"").unwrap();
    assert!(users_pos < files_pos, "users table should be created before files table");

    // Verify that storage_locations comes before storage_quotas
    let storage_locations_pos = migration_sql.find("CREATE TABLE \"storage_locations\"").unwrap();
    let storage_quotas_pos = migration_sql.find("CREATE TABLE \"storage_quotas\"").unwrap();
    assert!(storage_locations_pos < storage_quotas_pos,
            "storage_locations should be created before storage_quotas");
}

#[tokio::test]
async fn test_table_ordering() {
    let schema_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("diesel")
        .join("schema.rs");

    let migration_sql = generate_migrations(&schema_path)
        .await
        .expect("Failed to generate migration");

    // apps should come before file_versions
    let apps_pos = migration_sql.find("CREATE TABLE \"apps\"").unwrap();
    let file_versions_pos = migration_sql.find("CREATE TABLE \"file_versions\"").unwrap();
    assert!(apps_pos < file_versions_pos, "apps should be created before file_versions");

    // file_groups should come before file_file_group_members
    let file_groups_pos = migration_sql.find("CREATE TABLE \"file_groups\"").unwrap();
    let file_file_group_members_pos = migration_sql.find("CREATE TABLE \"file_file_group_members\"").unwrap();
    assert!(file_groups_pos < file_file_group_members_pos,
            "file_groups should be created before file_file_group_members");
}

#[tokio::test]
async fn test_cascade_options() {
    let schema_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("diesel")
        .join("schema.rs");

    let migration_sql = generate_migrations(&schema_path)
        .await
        .expect("Failed to generate migration");

    println!("Generated migration for cascade test:\n{}", migration_sql);

    // Test ON DELETE CASCADE only
    assert!(migration_sql.contains("FOREIGN KEY (\"owner_id\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE"),
            "Should have ON DELETE CASCADE for files.owner_id");

    // Test ON DELETE CASCADE and ON UPDATE CASCADE
    assert!(migration_sql.contains("FOREIGN KEY (\"file_id\") REFERENCES \"files\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE"),
            "Should have both ON DELETE CASCADE and ON UPDATE CASCADE for file_versions.file_id");

    // Test ON DELETE RESTRICT
    assert!(migration_sql.contains("FOREIGN KEY (\"storage_location_id\") REFERENCES \"storage_locations\"(\"id\") ON DELETE RESTRICT"),
            "Should have ON DELETE RESTRICT for file_versions.storage_location_id");

    // Test that foreign keys without cascade annotations don't have cascade options
    // For example, file_versions -> apps should not have any cascade option
    let fk_pattern = "FOREIGN KEY (\"app_id\") REFERENCES \"apps\"(\"id\")";
    if let Some(pos) = migration_sql.find(fk_pattern) {
        let after_fk = &migration_sql[pos + fk_pattern.len()..];
        let next_line_end = after_fk.find('\n').unwrap_or(after_fk.len());
        let fk_line = &after_fk[..next_line_end];
        assert!(!fk_line.contains("ON DELETE") && !fk_line.contains("ON UPDATE"),
                "app_id foreign key should not have cascade options");
    }
}
