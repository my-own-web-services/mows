use argon2::password_hash::{rand_core::OsRng, SaltString};
use argon2::{Argon2, PasswordHasher};
use axum::extract::{Extension, State};
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::api::auth_middleware::AuthContext;
use crate::api::types::ErrorResponse;
use crate::error::{Result, SupervisorError};
use crate::state::SharedState;

/// Minimum length for user passwords. Argon2 makes weak passwords expensive
/// for the attacker but cannot rescue a single-character password.
const MIN_PASSWORD_LEN: usize = 12;

pub fn rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new().routes(routes!(list_users, create_user))
}

#[derive(Deserialize, ToSchema)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "user".into()
}

#[derive(Serialize, Deserialize, ToSchema, sqlx::FromRow)]
pub struct UserSummary {
    pub id: String,
    pub username: String,
    pub role: String,
    pub created_at: String,
}

#[utoipa::path(
    get,
    path = "/v1/users",
    tag = "users",
    description = "List every supervisor user, sorted by username.",
    responses(
        (status = 200, description = "Users", body = Vec<UserSummary>),
    )
)]
async fn list_users(State(state): State<SharedState>) -> Result<Json<Vec<UserSummary>>> {
    let rows: Vec<UserSummary> =
        sqlx::query_as("SELECT id, username, role, created_at FROM users ORDER BY username")
            .fetch_all(&state.db)
            .await?;
    Ok(Json(rows))
}

#[utoipa::path(
    post,
    path = "/v1/users",
    tag = "users",
    description = "Create a new supervisor user.",
    request_body = CreateUserRequest,
    responses(
        (status = 200, description = "User created", body = UserSummary),
        (status = 400, description = "Invalid role", body = ErrorResponse),
        (status = 409, description = "Username already exists", body = ErrorResponse),
    )
)]
async fn create_user(
    State(state): State<SharedState>,
    Extension(actor): Extension<AuthContext>,
    Json(request): Json<CreateUserRequest>,
) -> Result<Json<UserSummary>> {
    if actor.role != "admin" {
        return Err(SupervisorError::Forbidden);
    }
    if request.role != "admin" && request.role != "user" {
        return Err(SupervisorError::BadRequest(format!(
            "role must be 'admin' or 'user', got {:?}",
            request.role
        )));
    }
    if request.password.len() < MIN_PASSWORD_LEN {
        return Err(SupervisorError::BadRequest(format!(
            "password must be at least {MIN_PASSWORD_LEN} characters"
        )));
    }
    if request.username.trim().is_empty() {
        return Err(SupervisorError::BadRequest(
            "username must not be empty".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(request.password.as_bytes(), &salt)?
        .to_string();
    let created_at = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO users (id, username, argon2_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&id)
    .bind(&request.username)
    .bind(&hash)
    .bind(&request.role)
    .bind(&created_at)
    .execute(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            SupervisorError::Conflict(format!("username {:?} already exists", request.username))
        }
        other => SupervisorError::from(other),
    })?;

    Ok(Json(UserSummary {
        id,
        username: request.username,
        role: request.role,
        created_at,
    }))
}
