use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHasher};
use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::{Result, SupervisorError};
use crate::state::SharedState;

pub fn router() -> Router<SharedState> {
    Router::new().route("/v1/users", get(list_users).post(create_user))
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "user".into()
}

#[derive(Serialize, sqlx::FromRow)]
pub struct UserSummary {
    pub id: String,
    pub username: String,
    pub role: String,
    pub created_at: String,
}

async fn list_users(State(state): State<SharedState>) -> Result<Json<Vec<UserSummary>>> {
    let rows: Vec<UserSummary> =
        sqlx::query_as("SELECT id, username, role, created_at FROM users ORDER BY username")
            .fetch_all(&state.db)
            .await?;
    Ok(Json(rows))
}

async fn create_user(
    State(state): State<SharedState>,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserSummary>> {
    if req.role != "admin" && req.role != "user" {
        return Err(SupervisorError::BadRequest(format!(
            "role must be 'admin' or 'user', got {:?}",
            req.role
        )));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(req.password.as_bytes(), &salt)?
        .to_string();
    let created_at = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO users (id, username, argon2_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&id)
    .bind(&req.username)
    .bind(&hash)
    .bind(&req.role)
    .bind(&created_at)
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            SupervisorError::Conflict(format!("username {:?} already exists", req.username))
        }
        other => SupervisorError::from(other),
    })?;

    Ok(Json(UserSummary {
        id,
        username: req.username,
        role: req.role,
        created_at,
    }))
}
