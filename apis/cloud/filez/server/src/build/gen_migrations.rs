use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Get schema file path from command line args or use default
    let schema_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("src/schema.rs"));

    // Generate migrations from the schema file
    let migration_sql = mows_common_rust::diesel::schema::generate_migrations(&schema_path).await?;

    // Create migrations directory if it doesn't exist
    let migrations_dir = PathBuf::from("migrations");
    tokio::fs::create_dir_all(&migrations_dir).await?;

    // Use fixed migration name
    let migration_name = "00000000000000_init";
    let migration_path = migrations_dir.join(&migration_name);

    // Create migration directory
    tokio::fs::create_dir_all(&migration_path).await?;

    // Write up.sql
    let up_sql_path = migration_path.join("up.sql");
    tokio::fs::write(&up_sql_path, &migration_sql).await?;

    // Write empty down.sql (user will need to fill this in)
    let down_sql_path = migration_path.join("down.sql");
    tokio::fs::write(&down_sql_path, "-- This file should undo anything in `up.sql`\n").await?;

    println!("Migration created at: {}", migration_path.display());
    println!("  - {}", up_sql_path.display());
    println!("  - {}", down_sql_path.display());

    Ok(())
}
