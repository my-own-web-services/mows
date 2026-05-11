use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use base64::Engine;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::error::{Result, SupervisorError};
use crate::state::SharedState;

pub fn router() -> Router<SharedState> {
    Router::new().route("/v1/auth/login", post(login))
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: chrono::DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct UserRow {
    id: String,
    argon2_hash: String,
}

async fn login(
    State(state): State<SharedState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    let row: UserRow = sqlx::query_as("SELECT id, argon2_hash FROM users WHERE username = ?1")
        .bind(&req.username)
        .fetch_optional(&state.db)
        .await?
        .ok_or(SupervisorError::Unauthorized)?;

    let parsed = PasswordHash::new(&row.argon2_hash)
        .map_err(|e| SupervisorError::PasswordHash(e.to_string()))?;
    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed)
        .map_err(|_| SupervisorError::Unauthorized)?;

    let token = generate_token();
    let expires_at = Utc::now() + Duration::days(30);
    let expires_text = expires_at.to_rfc3339();
    sqlx::query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)")
        .bind(&token)
        .bind(&row.id)
        .bind(&expires_text)
        .execute(&state.db)
        .await?;

    Ok(Json(LoginResponse { token, expires_at }))
}

fn generate_token() -> String {
    use rand::RngCore;
    let mut buf = [0u8; 32];
    rand::rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}
