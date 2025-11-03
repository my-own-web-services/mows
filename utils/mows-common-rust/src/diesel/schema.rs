use anyhow::{Context, Result};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use syn::{File, Item, Macro};

#[derive(Debug, Clone)]
pub struct TableDefinition {
    pub name: String,
    pub columns: Vec<ColumnDefinition>,
    pub primary_key: Vec<String>,
    pub custom_sql: Vec<String>,
    pub indexes: Vec<Vec<String>>,
    pub unique_constraints: Vec<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct ColumnDefinition {
    pub name: String,
    pub diesel_type: String,
    pub nullable: bool,
}

#[derive(Debug, Clone)]
pub struct ForeignKey {
    pub table: String,
    pub column: String,
    pub referenced_table: String,
    pub referenced_column: String,
    pub on_delete: Option<CascadeOption>,
    pub on_update: Option<CascadeOption>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CascadeOption {
    Cascade,
    Restrict,
    SetNull,
    SetDefault,
    NoAction,
}

#[derive(Debug)]
pub struct SchemaInfo {
    pub tables: Vec<TableDefinition>,
    pub foreign_keys: Vec<ForeignKey>,
}

pub async fn generate_migrations(schema_file_path: &Path) -> Result<String> {
    let schema_content = tokio::fs::read_to_string(schema_file_path)
        .await
        .context("Failed to read schema file")?;

    let schema_info = parse_diesel_schema(&schema_content)?;
    let migration_sql = generate_sql_migration(&schema_info)?;

    Ok(migration_sql)
}

fn parse_diesel_schema(content: &str) -> Result<SchemaInfo> {
    let syntax_tree: File = syn::parse_str(content).context("Failed to parse Rust file")?;

    // First, parse cascade options from regular comments
    let cascade_map = parse_cascade_comments_from_source(content);

    // Parse table annotations (SQL and INDEX comments)
    let table_annotations = parse_table_annotations_from_source(content);

    let mut tables = Vec::new();
    let mut foreign_keys = Vec::new();

    for item in syntax_tree.items {
        if let Item::Macro(macro_item) = item {
            let macro_path = macro_item
                .mac
                .path
                .segments
                .iter()
                .map(|s| s.ident.to_string())
                .collect::<Vec<_>>()
                .join("::");

            if macro_path == "diesel::table" {
                if let Some(table) = parse_table_macro(&macro_item.mac, &table_annotations)? {
                    tables.push(table);
                }
            } else if macro_path == "diesel::joinable" {
                if let Some(fk) = parse_joinable_macro(&macro_item.mac, &cascade_map)? {
                    foreign_keys.push(fk);
                }
            }
        }
    }

    Ok(SchemaInfo {
        tables,
        foreign_keys,
    })
}

fn parse_table_macro(mac: &Macro, table_annotations: &TableAnnotationsMap) -> Result<Option<TableDefinition>> {
    let tokens = mac.tokens.to_string();

    // Parse the table name and columns
    // Format: table_name { column_name -> Type, ... }
    // Or: table_name (pk1, pk2) { column_name -> Type, ... }

    let tokens = tokens.trim();
    if tokens.is_empty() {
        return Ok(None);
    }

    // Find the table name (everything before '{' or '(')
    let (table_name, rest) = if let Some(paren_pos) = tokens.find('(') {
        let brace_pos = tokens.find('{').unwrap_or(tokens.len());
        if paren_pos < brace_pos {
            // Has explicit primary key
            let name = tokens[..paren_pos].trim().to_string();
            let rest = tokens[paren_pos..].trim();
            (name, rest)
        } else {
            // No explicit primary key
            let name = tokens[..brace_pos].trim().to_string();
            let rest = tokens[brace_pos..].trim();
            (name, rest)
        }
    } else if let Some(brace_pos) = tokens.find('{') {
        let name = tokens[..brace_pos].trim().to_string();
        let rest = tokens[brace_pos..].trim();
        (name, rest)
    } else {
        return Ok(None);
    };

    // Parse explicit primary key if present
    let (explicit_pk, rest) = if rest.starts_with('(') {
        let end_paren = rest.find(')').context("Missing closing parenthesis")?;
        let pk_str = &rest[1..end_paren];
        let pk_fields: Vec<String> = pk_str
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        let rest = rest[end_paren + 1..].trim();
        (Some(pk_fields), rest)
    } else {
        (None, rest)
    };

    // Parse columns
    let rest = rest.strip_prefix('{').context("Missing opening brace")?;
    let rest = rest.strip_suffix('}').context("Missing closing brace")?;

    let mut columns = Vec::new();
    let column_lines: Vec<&str> = rest.split(',').collect();

    for line in column_lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Parse: column_name -> Type
        let parts: Vec<&str> = line.split("->").collect();
        if parts.len() != 2 {
            continue;
        }

        let column_name = parts[0].trim().to_string();
        let type_str = parts[1].trim();

        // Check if nullable
        let (diesel_type, nullable) = if type_str.starts_with("Nullable") {
            let inner = type_str
                .strip_prefix("Nullable")
                .unwrap_or("")
                .trim()
                .strip_prefix('<')
                .unwrap_or("")
                .strip_suffix('>')
                .unwrap_or("")
                .trim()
                .to_string();
            (inner, true)
        } else {
            (type_str.to_string(), false)
        };

        columns.push(ColumnDefinition {
            name: column_name,
            diesel_type,
            nullable,
        });
    }

    // Determine primary key
    let primary_key = if let Some(pk) = explicit_pk {
        pk
    } else {
        // Default to "id" if it exists
        if columns.iter().any(|c| c.name == "id") {
            vec!["id".to_string()]
        } else {
            vec![]
        }
    };

    // Get custom SQL, indexes, and unique constraints from annotations
    let (custom_sql, indexes, unique_constraints) = table_annotations
        .get(&table_name)
        .cloned()
        .unwrap_or((Vec::new(), Vec::new(), Vec::new()));

    Ok(Some(TableDefinition {
        name: table_name,
        columns,
        primary_key,
        custom_sql,
        indexes,
        unique_constraints,
    }))
}

type CascadeMap = HashMap<(String, String, String), (Option<CascadeOption>, Option<CascadeOption>)>;
type TableAnnotationsMap = HashMap<String, (Vec<String>, Vec<Vec<String>>, Vec<Vec<String>>)>;

fn parse_cascade_comments_from_source(content: &str) -> CascadeMap {
    let mut map = HashMap::new();
    let lines: Vec<&str> = content.lines().collect();

    for (i, line) in lines.iter().enumerate() {
        // Look for diesel::joinable! lines
        if line.contains("diesel::joinable!") {
            // Extract the joinable parameters between the outermost parentheses
            // Format: diesel::joinable!(files -> users (owner_id));
            if let Some(start) = line.find("!(") {
                // Find the matching closing paren, working backwards from the end
                let after_start = &line[start + 2..];
                if let Some(end) = after_start.rfind(')') {
                    let params = &after_start[..end];
                    // Format: table1 -> table2 (column)
                    let parts: Vec<&str> = params.split("->").collect();
                    if parts.len() == 2 {
                        let table = parts[0].trim().to_string();
                        let rest = parts[1].trim();

                        if let Some(paren_pos) = rest.find('(') {
                            if let Some(end_paren) = rest.find(')') {
                                let referenced_table = rest[..paren_pos].trim().to_string();
                                let column = rest[paren_pos + 1..end_paren].trim().to_string();

                                // Look backwards for cascade comments
                                let mut on_delete = None;
                                let mut on_update = None;

                                // Check up to 10 lines before for comments
                                let start_line = if i >= 10 { i - 10 } else { 0 };
                                for j in (start_line..i).rev() {
                                    let comment_line = lines[j].trim();

                                    // Stop if we hit a non-comment, non-empty line
                                    if !comment_line.starts_with("//") && !comment_line.is_empty() {
                                        break;
                                    }

                                    if comment_line.starts_with("//") {
                                        let comment_text = comment_line.trim_start_matches("//").trim().to_uppercase();

                                        if comment_text.starts_with("ON_DELETE") {
                                            let rest = comment_text.strip_prefix("ON_DELETE").unwrap().trim();
                                            let rest = rest.strip_prefix(':').unwrap_or(rest).trim();
                                            on_delete = parse_cascade_option(rest);
                                        }

                                        if comment_text.starts_with("ON_UPDATE") {
                                            let rest = comment_text.strip_prefix("ON_UPDATE").unwrap().trim();
                                            let rest = rest.strip_prefix(':').unwrap_or(rest).trim();
                                            on_update = parse_cascade_option(rest);
                                        }
                                    }
                                }

                                map.insert(
                                    (table, referenced_table, column),
                                    (on_delete, on_update),
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    map
}

fn parse_table_annotations_from_source(content: &str) -> TableAnnotationsMap {
    let mut map = HashMap::new();
    let lines: Vec<&str> = content.lines().collect();

    for (i, line) in lines.iter().enumerate() {
        // Look for diesel::table! lines
        if line.contains("diesel::table!") {
            // Extract the table name from the macro
            // Format: diesel::table! { table_name { ... } }
            // or: diesel::table! { table_name (pk) { ... } }

            // Find the opening brace after diesel::table!
            let mut table_name = None;

            // Look for the table name in the next few lines if not on the same line
            for j in i..=(i + 5).min(lines.len().saturating_sub(1)) {
                let search_line = lines[j];
                if let Some(brace_pos) = search_line.find('{') {
                    // Try to find the table name between the macro and the brace
                    let before_brace = if j == i {
                        // Same line as diesel::table!
                        if let Some(macro_end) = search_line.find("diesel::table!") {
                            &search_line[macro_end + "diesel::table!".len()..brace_pos]
                        } else {
                            &search_line[..brace_pos]
                        }
                    } else {
                        &search_line[..brace_pos]
                    };

                    // Remove any opening braces and whitespace
                    let cleaned = before_brace.trim().trim_start_matches('{').trim();

                    if !cleaned.is_empty() {
                        // Extract just the table name (before any parenthesis for PK)
                        let name = if let Some(paren_pos) = cleaned.find('(') {
                            cleaned[..paren_pos].trim()
                        } else {
                            cleaned
                        };

                        if !name.is_empty() {
                            table_name = Some(name.to_string());
                            break;
                        }
                    }
                }
            }

            if let Some(table_name) = table_name {
                let mut custom_sql = Vec::new();
                let mut indexes = Vec::new();
                let mut unique_constraints = Vec::new();

                // Look backwards for SQL:, INDEX:, and UNIQUE: comments
                // Check up to 50 lines before for comments
                let start_line = if i >= 50 { i - 50 } else { 0 };
                for j in (start_line..i).rev() {
                    let comment_line = lines[j].trim();

                    // Stop if we hit a non-comment, non-empty line that's not whitespace
                    if !comment_line.starts_with("//") && !comment_line.is_empty() {
                        break;
                    }

                    if comment_line.starts_with("//") {
                        let comment_text = comment_line.trim_start_matches("//").trim();

                        // Check for SQL: comments
                        if comment_text.starts_with("SQL:") {
                            let sql = comment_text.strip_prefix("SQL:").unwrap().trim();
                            if !sql.is_empty() {
                                // Insert at the beginning since we're going backwards
                                custom_sql.insert(0, sql.to_string());
                            }
                        }

                        // Check for INDEX: comments
                        if comment_text.starts_with("INDEX:") {
                            let index_spec = comment_text.strip_prefix("INDEX:").unwrap().trim();

                            // Parse the index spec: (COLUMN1, COLUMN2, ...)
                            if let Some(start_paren) = index_spec.find('(') {
                                if let Some(end_paren) = index_spec.find(')') {
                                    let columns_str = &index_spec[start_paren + 1..end_paren];
                                    let columns: Vec<String> = columns_str
                                        .split(',')
                                        .map(|s| s.trim().to_string())
                                        .filter(|s| !s.is_empty())
                                        .collect();

                                    if !columns.is_empty() {
                                        // Insert at the beginning since we're going backwards
                                        indexes.insert(0, columns);
                                    }
                                }
                            }
                        }

                        // Check for UNIQUE: comments
                        if comment_text.starts_with("UNIQUE:") {
                            let unique_spec = comment_text.strip_prefix("UNIQUE:").unwrap().trim();

                            // Parse the unique spec: (COLUMN1, COLUMN2, ...)
                            if let Some(start_paren) = unique_spec.find('(') {
                                if let Some(end_paren) = unique_spec.find(')') {
                                    let columns_str = &unique_spec[start_paren + 1..end_paren];
                                    let columns: Vec<String> = columns_str
                                        .split(',')
                                        .map(|s| s.trim().to_string())
                                        .filter(|s| !s.is_empty())
                                        .collect();

                                    if !columns.is_empty() {
                                        // Insert at the beginning since we're going backwards
                                        unique_constraints.insert(0, columns);
                                    }
                                }
                            }
                        }
                    }
                }

                map.insert(table_name, (custom_sql, indexes, unique_constraints));
            }
        }
    }

    map
}

fn parse_joinable_macro(mac: &Macro, cascade_map: &CascadeMap) -> Result<Option<ForeignKey>> {
    let tokens = mac.tokens.to_string();

    // Format: table1 -> table2 (column)
    let parts: Vec<&str> = tokens.split("->").collect();
    if parts.len() != 2 {
        return Ok(None);
    }

    let table = parts[0].trim().to_string();
    let rest = parts[1].trim();

    // Parse: table2 (column)
    let paren_pos = rest.find('(').context("Missing opening parenthesis")?;
    let referenced_table = rest[..paren_pos].trim().to_string();

    let end_paren = rest.find(')').context("Missing closing parenthesis")?;
    let column = rest[paren_pos + 1..end_paren].trim().to_string();

    // Referenced column is typically "id"
    let referenced_column = "id".to_string();

    // Look up cascade options from the map
    let key = (table.clone(), referenced_table.clone(), column.clone());
    let (on_delete, on_update) = cascade_map.get(&key).cloned().unwrap_or((None, None));

    Ok(Some(ForeignKey {
        table,
        column,
        referenced_table,
        referenced_column,
        on_delete,
        on_update,
    }))
}

fn parse_cascade_option(s: &str) -> Option<CascadeOption> {
    match s {
        "CASCADE" => Some(CascadeOption::Cascade),
        "RESTRICT" => Some(CascadeOption::Restrict),
        "SET NULL" | "SETNULL" => Some(CascadeOption::SetNull),
        "SET DEFAULT" | "SETDEFAULT" => Some(CascadeOption::SetDefault),
        "NO ACTION" | "NOACTION" => Some(CascadeOption::NoAction),
        _ => None,
    }
}

fn generate_sql_migration(schema: &SchemaInfo) -> Result<String> {
    let mut sql = String::from("-- Your SQL goes here\n\n");

    // First, we need to determine the correct order for creating tables
    // based on foreign key dependencies
    let ordered_tables = order_tables_by_dependencies(&schema.tables, &schema.foreign_keys);

    // Generate CREATE TABLE statements
    for table_name in &ordered_tables {
        let table = schema
            .tables
            .iter()
            .find(|t| t.name == *table_name)
            .context(format!("Table {} not found", table_name))?;

        sql.push_str(&format!("CREATE TABLE \"{}\"(\n", table.name));

        // Collect foreign keys for this table
        let table_fks: Vec<&ForeignKey> = schema
            .foreign_keys
            .iter()
            .filter(|fk| fk.table == table.name)
            .collect();

        // Determine if we need additional constraints
        let has_composite_pk = table.primary_key.len() > 1;
        let has_fks = !table_fks.is_empty();
        let has_unique_constraints = !table.unique_constraints.is_empty();
        let needs_trailing_items = has_composite_pk || has_fks || has_unique_constraints;

        // Add columns
        for (i, column) in table.columns.iter().enumerate() {
            let sql_type = diesel_type_to_sql(&column.diesel_type)?;
            let not_null = if column.nullable { "" } else { " NOT NULL" };

            // Check if this is a unique column in a composite PK
            let unique = if table.primary_key.len() > 1
                && column.name == "id"
                && !table.primary_key.contains(&column.name)
            {
                " UNIQUE"
            } else if table.primary_key.len() > 1
                && column.name == "id"
                && table.primary_key.contains(&column.name)
            {
                " UNIQUE"
            } else {
                ""
            };

            sql.push_str(&format!(
                "    \"{}\" {}{}{}",
                column.name, sql_type, not_null, unique
            ));

            // Add PRIMARY KEY for single-column primary keys
            if table.primary_key.len() == 1 && table.primary_key[0] == column.name {
                sql.push_str(" PRIMARY KEY");
            }

            // Add comma if not the last column OR if there are constraints coming after
            let is_last_column = i == table.columns.len() - 1;
            if !is_last_column || needs_trailing_items {
                sql.push(',');
            }
            sql.push('\n');
        }

        // Add composite primary key constraint
        if table.primary_key.len() > 1 {
            sql.push_str(&format!(
                "    PRIMARY KEY ({})",
                table
                    .primary_key
                    .iter()
                    .map(|pk| format!("\"{}\"", pk))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
            if has_fks || has_unique_constraints {
                sql.push(',');
            }
            sql.push('\n');
        }

        // Add foreign key constraints for this table
        for (i, fk) in table_fks.iter().enumerate() {
            sql.push_str(&format!(
                "    FOREIGN KEY (\"{}\") REFERENCES \"{}\"(\"{}\")",
                fk.column, fk.referenced_table, fk.referenced_column
            ));

            // Add ON DELETE clause if specified
            if let Some(on_delete) = &fk.on_delete {
                sql.push_str(&format!(" ON DELETE {}", cascade_option_to_sql(on_delete)));
            }

            // Add ON UPDATE clause if specified
            if let Some(on_update) = &fk.on_update {
                sql.push_str(&format!(" ON UPDATE {}", cascade_option_to_sql(on_update)));
            }

            if i < table_fks.len() - 1 || has_unique_constraints {
                sql.push(',');
            }
            sql.push('\n');
        }

        // Add unique constraints for this table
        for (i, unique_cols) in table.unique_constraints.iter().enumerate() {
            sql.push_str(&format!(
                "    UNIQUE ({})",
                unique_cols
                    .iter()
                    .map(|col| format!("\"{}\"", col))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
            if i < table.unique_constraints.len() - 1 {
                sql.push(',');
            }
            sql.push('\n');
        }

        sql.push_str(");\n\n");

        // Add custom SQL statements for this table
        for custom_sql_stmt in &table.custom_sql {
            sql.push_str(custom_sql_stmt);
            if !custom_sql_stmt.ends_with(';') {
                sql.push(';');
            }
            sql.push_str("\n\n");
        }

        // Add index creation statements for this table
        for (i, index_columns) in table.indexes.iter().enumerate() {
            let index_name = format!(
                "idx_{}_{}_{}",
                table.name,
                index_columns.join("_"),
                i
            );

            // Check if these columns match a unique constraint
            let is_unique = table.unique_constraints.iter().any(|unique_cols| {
                unique_cols.len() == index_columns.len() &&
                unique_cols.iter().all(|col| index_columns.contains(col))
            });

            let unique_keyword = if is_unique { "UNIQUE " } else { "" };

            sql.push_str(&format!(
                "CREATE {}INDEX \"{}\" ON \"{}\" ({});\n\n",
                unique_keyword,
                index_name,
                table.name,
                index_columns
                    .iter()
                    .map(|col| format!("\"{}\"", col))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
    }

    Ok(sql)
}

fn order_tables_by_dependencies(
    tables: &[TableDefinition],
    foreign_keys: &[ForeignKey],
) -> Vec<String> {
    let mut result = Vec::new();
    let mut added = HashSet::new();

    // Build a dependency map: table -> tables it depends on
    let mut dependencies: HashMap<String, HashSet<String>> = HashMap::new();
    for table in tables {
        dependencies.insert(table.name.clone(), HashSet::new());
    }

    for fk in foreign_keys {
        dependencies
            .entry(fk.table.clone())
            .or_default()
            .insert(fk.referenced_table.clone());
    }

    // Topological sort
    fn add_table(
        table_name: &str,
        dependencies: &HashMap<String, HashSet<String>>,
        added: &mut HashSet<String>,
        result: &mut Vec<String>,
    ) {
        if added.contains(table_name) {
            return;
        }

        // Add dependencies first
        if let Some(deps) = dependencies.get(table_name) {
            for dep in deps {
                // Avoid self-references
                if dep != table_name {
                    add_table(dep, dependencies, added, result);
                }
            }
        }

        added.insert(table_name.to_string());
        result.push(table_name.to_string());
    }

    for table in tables {
        add_table(&table.name, &dependencies, &mut added, &mut result);
    }

    result
}

fn diesel_type_to_sql(diesel_type: &str) -> Result<String> {
    // Remove spaces for normalized matching
    let normalized = diesel_type.replace(" ", "");

    let sql_type = match normalized.as_str() {
        "Uuid" => "UUID",
        "Text" => "TEXT",
        "Integer" => "INTEGER",
        "BigInt" => "BIGINT",
        "SmallInt" => "SMALLINT",
        "Bool" => "BOOL",
        "Timestamp" => "TIMESTAMP",
        "Jsonb" => "JSONB",
        "Array<Uuid>" => "UUID[]",
        "Array<Text>" => "TEXT[]",
        "Array<SmallInt>" => "SMALLINT[]",
        _ => {
            return Err(anyhow::anyhow!(
                "Unsupported Diesel type: {}",
                diesel_type
            ))
        }
    };

    Ok(sql_type.to_string())
}

fn cascade_option_to_sql(option: &CascadeOption) -> &'static str {
    match option {
        CascadeOption::Cascade => "CASCADE",
        CascadeOption::Restrict => "RESTRICT",
        CascadeOption::SetNull => "SET NULL",
        CascadeOption::SetDefault => "SET DEFAULT",
        CascadeOption::NoAction => "NO ACTION",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_parse_simple_table() {
        let schema = r#"
            diesel::table! {
                users {
                    id -> Uuid,
                    name -> Text,
                }
            }
        "#;

        let result = parse_diesel_schema(schema).unwrap();
        assert_eq!(result.tables.len(), 1);
        assert_eq!(result.tables[0].name, "users");
        assert_eq!(result.tables[0].columns.len(), 2);
    }

    #[tokio::test]
    async fn test_parse_table_with_annotations() {
        let schema = r#"
            // INDEX: (email)
            // INDEX: (name, created_at)
            // SQL: CREATE UNIQUE INDEX idx_users_email ON "users" ("email") WHERE "email" IS NOT NULL
            // UNIQUE: (external_id, tenant_id)
            diesel::table! {
                users {
                    id -> Uuid,
                    name -> Text,
                    email -> Nullable<Text>,
                    created_at -> Timestamp,
                    external_id -> Text,
                    tenant_id -> Uuid,
                }
            }
        "#;

        let result = parse_diesel_schema(schema).unwrap();
        assert_eq!(result.tables.len(), 1);
        let table = &result.tables[0];
        assert_eq!(table.name, "users");
        assert_eq!(table.columns.len(), 6);
        assert_eq!(table.custom_sql.len(), 1);
        assert_eq!(table.indexes.len(), 2);
        assert_eq!(table.indexes[0], vec!["email"]);
        assert_eq!(table.indexes[1], vec!["name", "created_at"]);
        assert_eq!(table.unique_constraints.len(), 1);
        assert_eq!(table.unique_constraints[0], vec!["external_id", "tenant_id"]);
    }
}
