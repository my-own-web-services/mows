use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::extract::State;
use axum::Json;
use base64::Engine;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

use crate::api::types::ErrorResponse;
use crate::error::{Result, SupervisorError};
use crate::state::SharedState;

/// Fixed argon2 hash of an arbitrary 64-character string. Used to equalise
/// timing for missing usernames: `verify_password` against this dummy hash
/// takes the same wall-clock time as a real one, preventing username
/// enumeration through differential timing.
const DUMMY_ARGON2_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$dGltaW5nLWVxdWFsaXNlcg$wTSh9pP5wRDLGYpkxnNQRDR5HvHukC+/3KdvnFsccG0";

pub fn rest_router() -> OpenApiRouter<SharedState> {
    OpenApiRouter::new().routes(routes!(login))
}

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct LoginResponse {
    pub token: String,
    pub expires_at: chrono::DateTime<Utc>,
}

#[derive(sqlx::FromRow)]
struct UserRow {
    id: String,
    argon2_hash: String,
}

#[utoipa::path(
    post,
    path = "/v1/auth/login",
    tag = "auth",
    description = "Exchange username + password for an opaque bearer token. The \
                   token is good for 30 days.",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Token issued", body = LoginResponse),
        (status = 401, description = "Bad credentials", body = ErrorResponse),
    )
)]
async fn login(
    State(state): State<SharedState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>> {
    let row: Option<UserRow> =
        sqlx::query_as("SELECT id, argon2_hash FROM users WHERE username = ?1")
            .bind(&request.username)
            .fetch_optional(&state.db)
            .await?;

    // Always run `verify_password`, even for missing users, against a fixed
    // dummy hash. Otherwise the wall-clock delta between "no such user"
    // (sub-millisecond) and "wrong password" (argon2: ~50ms) lets an
    // attacker enumerate valid usernames in a few hundred probes.
    let (user_id, hash_to_verify): (Option<String>, String) = match row {
        Some(r) => (Some(r.id), r.argon2_hash),
        None => (None, DUMMY_ARGON2_HASH.to_string()),
    };
    let parsed = PasswordHash::new(&hash_to_verify)
        .map_err(|e| SupervisorError::PasswordHash(e.to_string()))?;
    let verify = Argon2::default().verify_password(request.password.as_bytes(), &parsed);

    let id = match (user_id, verify) {
        (Some(id), Ok(())) => id,
        _ => return Err(SupervisorError::Unauthorized),
    };

    let token = generate_token();
    let expires_at = Utc::now() + Duration::days(7);
    let expires_text = expires_at.to_rfc3339();
    sqlx::query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)")
        .bind(&token)
        .bind(&id)
        .bind(&expires_text)
        .execute(&state.db)
        .await?;

    Ok(Json(LoginResponse { token, expires_at }))
}

fn generate_token() -> String {
    use rand::RngCore;
    let mut token_bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut token_bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(token_bytes)
}
