//! Bearer-token authentication for the loopback TCP listener.
//!
//! The unix-socket listener bypasses this layer (local trust domain — process
//! uid is enough). On TCP, every protected route requires
//! `Authorization: Bearer <token>` and the token must either match the
//! configured `MOWS_VM_SUPERVISOR_API_TOKEN` (admin bootstrap) or resolve to
//! an unexpired row in the `sessions` table created by `/v1/auth/login`.

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, Request};
use axum::middleware::Next;
use axum::response::Response;
use chrono::Utc;
use subtle::ConstantTimeEq;

use crate::error::{Result, SupervisorError};
use crate::state::SharedState;

/// Identity established by `require_auth`. Injected into request extensions
/// so handlers can scope queries by user.
///
/// `user_id == None` means the caller authenticated with the static admin
/// token (no associated user row).
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: Option<String>,
    pub role: String,
}

impl AuthContext {
    fn admin_static() -> Self {
        Self {
            user_id: None,
            role: "admin".to_string(),
        }
    }

    /// Synthetic identity for unix-socket requests: anyone with file
    /// permissions to the socket already controls the supervisor process,
    /// so they are treated as `admin` with no associated user row.
    pub fn unix_socket_admin() -> Self {
        Self::admin_static()
    }
}

#[derive(sqlx::FromRow)]
struct SessionRow {
    user_id: String,
    role: String,
    expires_at: String,
}

pub async fn require_auth(
    State(state): State<SharedState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response> {
    // Local-dev escape hatch: when `MOWS_VM_SUPERVISOR_AUTH_DISABLE=1`
    // the TCP listener accepts every request as a synthetic admin.
    // Reserved for loopback dev where the user has chosen to skip the
    // bearer-token handshake; never set this in production.
    if state.config.auth_disabled {
        req.extensions_mut().insert(AuthContext::admin_static());
        return Ok(next.run(req).await);
    }

    let token = bearer_token(&req).ok_or(SupervisorError::Unauthorized)?;

    let ctx = if let Some(expected) = state.config.api_token.as_deref() {
        if bool::from(token.as_bytes().ct_eq(expected.as_bytes())) {
            Some(AuthContext::admin_static())
        } else {
            None
        }
    } else {
        None
    };

    let ctx = match ctx {
        Some(c) => c,
        None => session_lookup(&state, &token).await?,
    };

    req.extensions_mut().insert(ctx);
    Ok(next.run(req).await)
}

fn bearer_token<B>(req: &Request<B>) -> Option<String> {
    if let Some(value) = req.headers().get(header::AUTHORIZATION) {
        if let Some(token) = value
            .to_str()
            .ok()
            .and_then(|v| v.strip_prefix("Bearer "))
            .map(|s| s.trim().to_string())
        {
            return Some(token);
        }
    }
    // WebSocket fallback: browser `new WebSocket(url)` cannot attach an
    // `Authorization` header, so the canonical pattern is to pass the
    // session token as a `?token=…` query parameter. Accept it here only
    // so that the JS WebSocket client can authenticate without a polyfill.
    let query = req.uri().query()?;
    for pair in query.split('&') {
        if let Some(value) = pair.strip_prefix("token=") {
            let decoded = urlencoding_decode(value);
            if !decoded.is_empty() {
                return Some(decoded);
            }
        }
    }
    None
}

fn urlencoding_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(h), Some(l)) = (hi, lo) {
                    out.push((h * 16 + l) as u8);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            other => {
                out.push(other);
                i += 1;
            }
        }
    }
    String::from_utf8(out).unwrap_or_default()
}

/// Middleware that unconditionally injects an admin `AuthContext` into the
/// request extensions. Used only by the unix-socket listener, where the
/// process uid + filesystem permissions are the trust mechanism.
pub async fn inject_unix_admin(mut req: axum::http::Request<axum::body::Body>, next: Next) -> Response {
    req.extensions_mut().insert(AuthContext::unix_socket_admin());
    next.run(req).await
}

async fn session_lookup(state: &SharedState, token: &str) -> Result<AuthContext> {
    let row: Option<SessionRow> = sqlx::query_as(
        "SELECT s.user_id AS user_id, u.role AS role, s.expires_at AS expires_at \
         FROM sessions s JOIN users u ON u.id = s.user_id \
         WHERE s.token = ?1",
    )
    .bind(token)
    .fetch_optional(&state.db)
    .await?;
    let row = row.ok_or(SupervisorError::Unauthorized)?;
    let expires_at = chrono::DateTime::parse_from_rfc3339(&row.expires_at)
        .map_err(|_| SupervisorError::Unauthorized)?
        .with_timezone(&Utc);
    if expires_at <= Utc::now() {
        return Err(SupervisorError::Unauthorized);
    }
    Ok(AuthContext {
        user_id: Some(row.user_id),
        role: row.role,
    })
}
