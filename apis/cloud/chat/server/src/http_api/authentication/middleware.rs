//! Authentication middleware for the chat MVP.
//!
//! v1 trusts an `X-Chat-User-Id` request header. **This is a dev
//! stub**, not the production wiring — production uses Zitadel OIDC
//! introspection identical to filez's middleware. The stub exists
//! so the engine + handler integration can be validated end-to-end
//! without standing up a Zitadel instance. Round 7 swaps in the
//! real introspector; the swap is one struct + one `axum::middleware`
//! call.
//!
//! The middleware:
//!   1. Reads `X-Chat-User-Id`. If missing → anonymous request
//!      (AuthenticationInformation.requesting_user = None).
//!   2. If present, looks the user up by id; missing user → 401.
//!   3. Always attaches the configured chat MowsApp as
//!      `context_app` (every chat request is "as the chat app").
//!   4. Inserts AuthenticationInformation as a request Extension
//!      so downstream handlers can `Extension(auth):
//!      Extension<AuthenticationInformation>` it.

use axum::{
    extract::{Request, State},
    http::{HeaderName, StatusCode},
    middleware::Next,
    response::Response,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use mows_common_rust::get_current_config_cloned;
use uuid::Uuid;

use crate::{
    config::config,
    models::{apps::MowsApp, users::ChatUser, users::ChatUserId},
    schema,
    state::AppState,
};

/// Lowercase HTTP header carrying the trusted user id. **Dev mode
/// only** — production replaces this with a Bearer-token check.
pub const CHAT_USER_HEADER: &str = "x-chat-user-id";

/// Extension attached by [`authentication_middleware`] to every
/// request after auth resolution. Handlers extract this via
/// `Extension(auth): Extension<AuthenticationInformation>`.
#[derive(Clone, Debug)]
pub struct AuthenticationInformation {
    /// `None` for anonymous requests; `Some(...)` after the header
    /// or token resolves to a chat-side `ChatUser` row.
    pub requesting_user: Option<ChatUser>,
    /// The configured chat MowsApp. Acts as the
    /// `context_app_ids` filter for `mows-auth-core`'s
    /// `check_access` — every request is "as the chat app" since
    /// chat is a single-app service today.
    pub context_app: MowsApp,
}

pub async fn authentication_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let header_name = HeaderName::from_static(CHAT_USER_HEADER);
    let header_user_id = request
        .headers()
        .get(&header_name)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Browsers can't set arbitrary headers on WebSocket upgrades,
    // so dev tooling accepts `?user=<uuid>` query-string when
    // explicitly enabled. Gated by a SEPARATE flag
    // (`enable_dev_user_query_auth`) rather than `enable_dev`
    // alone so a config drift to enable_dev=true in prod doesn't
    // silently open auth bypass — review A1 (SLOP-2 / TASTE-7).
    // The main bootstrap additionally refuses to start with this
    // flag on if the server is bound to a non-localhost address.
    let cfg = get_current_config_cloned!(config());
    let query_user_id = if cfg.enable_dev_user_query_auth {
        request
            .uri()
            .query()
            .and_then(|q| {
                q.split('&')
                    .filter_map(|kv| kv.split_once('='))
                    .find_map(|(k, v)| (k == "user").then(|| v.to_string()))
            })
    } else {
        None
    };
    if query_user_id.is_some() {
        tracing::warn!(
            "WS-only ?user= auth fallback used (dev mode); production builds MUST disable ENABLE_DEV_USER_QUERY_AUTH"
        );
    }
    let resolved_user_id = header_user_id.or(query_user_id);

    let requesting_user = match resolved_user_id {
        None => None,
        Some(uid_str) => {
            let uid = Uuid::parse_str(&uid_str)
                .map_err(|_| StatusCode::BAD_REQUEST)?;
            let mut connection = state
                .database
                .get_connection()
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let row: Option<ChatUser> = schema::users::table
                .filter(schema::users::id.eq(ChatUserId(uid)))
                .select(ChatUser::as_select())
                .first::<ChatUser>(&mut connection)
                .await
                .optional()
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            match row {
                Some(u) if !u.deleted => Some(u),
                Some(_) => return Err(StatusCode::UNAUTHORIZED),
                None => return Err(StatusCode::UNAUTHORIZED),
            }
        }
    };

    let auth = AuthenticationInformation {
        requesting_user,
        context_app: state.context_app.clone(),
    };
    request.extensions_mut().insert(auth);
    Ok(next.run(request).await)
}
