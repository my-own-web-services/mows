//! Shared axum state for the chat service.
//!
//! Minimal in Round 1: just the database. Round 2 + 3 grow this
//! with the introspector and the per-channel broadcast registry.

use crate::database::Database;

#[derive(Clone, Debug)]
pub struct AppState {
    pub database: Database,
}

impl AppState {
    pub async fn new(db_url: &str) -> Self {
        Self {
            database: Database::new(db_url).await,
        }
    }
}
