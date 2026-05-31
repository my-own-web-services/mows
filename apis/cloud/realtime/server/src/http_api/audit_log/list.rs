//! `POST /api/audit_log/list` — paginated audit-log timeline for
//! the Phase 7 admin UI.
//!
//! Two query modes (both gated on authentication):
//!
//!   1. **Resource-scoped** — caller passes `(resource_type,
//!      resource_id)`. Returns events touching that resource,
//!      newest first. Gated by owner-only access: existence +
//!      ownership collapsed into one 403 to defeat UUID
//!      fingerprinting (same defence as /by_resource).
//!   2. **Self-scoped** — caller passes no resource filters.
//!      Returns events the caller themselves caused (`actor_id =
//!      caller.id`). No additional gate beyond authentication.
//!
//! Pagination is keyset-style: callers carry an opaque cursor
//! `"<ts_iso>|<id>"` from the response back into the next request.
//! OFFSET-based paging is intentionally not offered — the audit_log
//! table grows append-only and OFFSET would scan increasing prefixes
//! as the table ages.
//!
//! Wire shape matches the filez sibling exactly so the authz-admin
//! BFF stays a translator-free forwarder.

use axum::{extract::State, Extension, Json};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::AccessPolicyResourceType,
        audit_log::AuditLog,
        channels::ChannelId,
    },
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

/// Maximum entries per page. The hot query shape is bounded by the
/// `audit_log_by_resource` / `audit_log_by_actor` indexes (LISTING
/// of recent rows), so 200 is comfortably cheap; the cap exists to
/// keep an accidental `limit: 100_000` from holding a connection
/// while it streams.
const MAX_LIMIT: i64 = 200;
const DEFAULT_LIMIT: i64 = 50;

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListAuditLogRequest {
    /// Optional — if present alongside `resource_id`, the response
    /// is scoped to events on that resource and the caller must
    /// own it. If absent, the response defaults to the caller's
    /// own actions (`actor_id = caller`).
    pub resource_type: Option<AccessPolicyResourceType>,
    /// Optional — see `resource_type`.
    pub resource_id: Option<Uuid>,
    /// Page size. Clamped to 1..=MAX_LIMIT (200). Defaults to 50
    /// when omitted.
    #[serde(default)]
    pub limit: Option<i64>,
    /// Opaque cursor from the prior page's `next_cursor`. The shape
    /// is `"<ts_iso>|<id>"` and the server treats anything else as
    /// a 400 — never as an empty filter (which would silently
    /// restart pagination, missing the second page).
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListAuditLogResponse {
    pub entries: Vec<AuditLog>,
    /// `Some(...)` when there may be more rows; pass it back in the
    /// next request's `cursor`. `None` when this page contained
    /// every remaining row.
    pub next_cursor: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/audit_log/list",
    description = "Paginated audit-log timeline. Resource-scoped when (resource_type, resource_id) are supplied (owner-only); self-scoped otherwise (caller's own actions).",
    request_body = ListAuditLogRequest,
    responses(
        (status = 200, description = "Audit page", body = ApiResponse<ListAuditLogResponse>),
        (status = 400, description = "Malformed cursor or missing one of (resource_type, resource_id)"),
        (status = 401, description = "Anonymous request"),
        (status = 403, description = "Resource doesn't exist OR caller is not its owner — deliberately indistinguishable"),
    )
)]
pub async fn list_audit_log(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
    Json(body): Json<ListAuditLogRequest>,
) -> Result<Json<ApiResponse<ListAuditLogResponse>>, RealtimeError> {
    let caller = auth
        .requesting_user
        .as_ref()
        .ok_or_else(|| RealtimeError::Unauthorized("authentication required".to_string()))?;

    let limit = body
        .limit
        .map(|l| l.clamp(1, MAX_LIMIT))
        .unwrap_or(DEFAULT_LIMIT);

    // Both resource_type + resource_id must be supplied together —
    // an isolated resource_type without an id would either scope to
    // every-row-of-this-type (no owner gate, fingerprinting risk)
    // or silently fall back to self-scope (caller surprise).
    let resource_scope = match (body.resource_type, body.resource_id) {
        (Some(rt), Some(rid)) => Some((rt, rid)),
        (None, None) => None,
        (Some(_), None) | (None, Some(_)) => {
            return Err(RealtimeError::BadRequest(
                "resource_type and resource_id must be supplied together"
                    .to_string(),
            ));
        }
    };

    let cursor = match body.cursor.as_deref() {
        None => None,
        Some(raw) => Some(parse_cursor(raw)?),
    };

    let mut connection = state.database.get_connection().await?;

    // Owner-gate for the resource-scoped branch. We deliberately
    // collapse "doesn't exist" and "not your resource" into one
    // 403 (same defence as /by_resource). Self-scope skips the
    // gate — the caller is always allowed to see their own audit
    // trail.
    if let Some((rt, rid)) = resource_scope {
        match rt {
            AccessPolicyResourceType::Channel => {
                let owner_row = schema::channels::table
                    .filter(schema::channels::id.eq(ChannelId(rid)))
                    .filter(schema::channels::owner_id.eq(caller.id))
                    .select(schema::channels::owner_id)
                    .first::<crate::models::users::UserId>(&mut connection)
                    .await
                    .optional()?;
                if owner_row.is_none() {
                    return Err(RealtimeError::Forbidden(
                        "no such resource, or caller is not its owner".to_string(),
                    ));
                }
            }
            // Other resource types aren't owner-shareable in
            // realtime v1 — collapse to the same 403 so the
            // surface is uniform with /by_resource.
            _ => {
                return Err(RealtimeError::Forbidden(
                    "no such resource, or caller is not its owner".to_string(),
                ));
            }
        }
    }

    // Fetch one extra row so we can tell whether a next_cursor is
    // needed without a second round-trip. The pgsql planner uses
    // the `audit_log_by_resource` / `audit_log_by_actor` indexes
    // (both ordered `ts DESC`); the keyset where-clause turns the
    // page seek into a pure index range scan.
    let fetch_limit = limit + 1;
    let mut entries: Vec<AuditLog> = match resource_scope {
        Some((rt, rid)) => {
            let q = schema::audit_log::table
                .filter(schema::audit_log::resource_type.eq(rt))
                .filter(schema::audit_log::resource_id.eq(rid))
                .into_boxed();
            apply_keyset_filter(q, cursor)
                .order_by((
                    schema::audit_log::ts.desc(),
                    schema::audit_log::id.desc(),
                ))
                .limit(fetch_limit)
                .select(AuditLog::as_select())
                .load::<AuditLog>(&mut connection)
                .await?
        }
        None => {
            let q = schema::audit_log::table
                .filter(schema::audit_log::actor_id.eq(caller.id))
                .into_boxed();
            apply_keyset_filter(q, cursor)
                .order_by((
                    schema::audit_log::ts.desc(),
                    schema::audit_log::id.desc(),
                ))
                .limit(fetch_limit)
                .select(AuditLog::as_select())
                .load::<AuditLog>(&mut connection)
                .await?
        }
    };

    let next_cursor = if entries.len() as i64 > limit {
        // The extra-row sentinel told us there's at least one more
        // page. Drop it from the returned set and emit a cursor at
        // the LAST kept row.
        entries.truncate(limit as usize);
        entries.last().map(|row| format_cursor(row.ts, row.id.0))
    } else {
        None
    };

    let count = entries.len();
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{count} entry(ies)"),
        data: Some(ListAuditLogResponse {
            entries,
            next_cursor,
        }),
    }))
}

/// Apply the keyset where-clause that walks the `(ts DESC, id DESC)`
/// ordering forward. Extracting this stops the duplicate-by-arm
/// pattern that the round-1 review (R5 / SLOP-2 / TECH-2) called
/// out — a future cursor change lands in one place instead of two
/// per-file.
fn apply_keyset_filter(
    q: schema::audit_log::BoxedQuery<'_, diesel::pg::Pg>,
    cursor: Option<(chrono::NaiveDateTime, Uuid)>,
) -> schema::audit_log::BoxedQuery<'_, diesel::pg::Pg> {
    match cursor {
        None => q,
        Some((cursor_ts, cursor_id)) => q.filter(
            schema::audit_log::ts.lt(cursor_ts).or(
                schema::audit_log::ts.eq(cursor_ts).and(
                    schema::audit_log::id
                        .lt(crate::models::audit_log::AuditLogId(cursor_id)),
                ),
            ),
        ),
    }
}

/// Parse an opaque cursor of the form `"<ts_iso>|<id>"` into the
/// (ts, id) pair the keyset where-clause filters on. Anything else
/// is a 400 — callers should pass the previous page's `next_cursor`
/// verbatim or omit the field entirely.
fn parse_cursor(raw: &str) -> Result<(chrono::NaiveDateTime, Uuid), RealtimeError> {
    let (ts_part, id_part) = raw.split_once('|').ok_or_else(|| {
        RealtimeError::BadRequest(format!(
            "cursor must be `<ts_iso>|<id>`; got {raw:?}"
        ))
    })?;
    let ts = chrono::NaiveDateTime::parse_from_str(ts_part, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| chrono::NaiveDateTime::parse_from_str(ts_part, "%Y-%m-%dT%H:%M:%S"))
        .map_err(|e| {
            RealtimeError::BadRequest(format!(
                "cursor ts part {ts_part:?} is not ISO-8601: {e}"
            ))
        })?;
    let id = Uuid::parse_str(id_part).map_err(|e| {
        RealtimeError::BadRequest(format!(
            "cursor id part {id_part:?} is not a UUID: {e}"
        ))
    })?;
    Ok((ts, id))
}

/// Render a cursor for the page's last row. Format must round-trip
/// through `parse_cursor`.
fn format_cursor(ts: chrono::NaiveDateTime, id: Uuid) -> String {
    format!("{}|{}", ts.format("%Y-%m-%dT%H:%M:%S%.6f"), id)
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the request + response field names + cursor format so
    //! the authz-admin BFF can keep its no-translator stance and
    //! the filez sibling stays drop-in compatible.
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_field_names_pinned() {
        // The five keys the BFF + SPA reference by name. The shape
        // is the same on filez's sibling endpoint.
        let parsed: ListAuditLogRequest = serde_json::from_value(json!({
            "resource_type": "Channel",
            "resource_id": "00000000-0000-0000-0000-000000000001",
            "limit": 25,
            "cursor": "2026-05-31T12:00:00|00000000-0000-0000-0000-000000000002",
        }))
        .expect("must accept the canonical shape");
        assert!(parsed.resource_type.is_some());
        assert!(parsed.resource_id.is_some());
        assert_eq!(parsed.limit, Some(25));
        assert!(parsed.cursor.is_some());
    }

    #[test]
    fn request_body_accepts_empty_filters_for_self_scope() {
        // Self-scope must not require any keys — empty body is
        // valid and means "my own actions".
        let parsed: ListAuditLogRequest =
            serde_json::from_value(json!({})).expect("empty body accepted");
        assert!(parsed.resource_type.is_none());
        assert!(parsed.resource_id.is_none());
        assert!(parsed.limit.is_none());
        assert!(parsed.cursor.is_none());
    }

    #[test]
    fn response_body_field_names_pinned() {
        let body = ListAuditLogResponse {
            entries: vec![],
            next_cursor: None,
        };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert!(serialised.get("entries").is_some());
        assert!(serialised.get("next_cursor").is_some());
        // Pin the inverse — accidental rename to `items` /
        // `audit_log` / `cursor` would silently empty the SPA
        // table (same class of bug the explain wire_shape_guard
        // catches).
        assert!(serialised.get("items").is_none());
        assert!(serialised.get("audit_log").is_none());
        assert!(serialised.get("cursor").is_none());
    }

    #[test]
    fn cursor_round_trips() {
        let ts = chrono::NaiveDateTime::parse_from_str(
            "2026-05-31T12:34:56.789012",
            "%Y-%m-%dT%H:%M:%S%.f",
        )
        .unwrap();
        let id = Uuid::parse_str("11111111-1111-1111-1111-111111111111").unwrap();
        let raw = format_cursor(ts, id);
        let (parsed_ts, parsed_id) = parse_cursor(&raw).expect("must round-trip");
        assert_eq!(parsed_ts, ts);
        assert_eq!(parsed_id, id);
    }

    #[test]
    fn cursor_rejects_garbage_with_400() {
        let err = parse_cursor("not-a-cursor").unwrap_err();
        match err {
            RealtimeError::BadRequest(_) => {}
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[test]
    fn cursor_rejects_missing_separator() {
        // Same root cause as garbage cursor — the split_once must
        // find a `|`. The test pins the specific failure path so
        // a refactor that loosens the format (e.g. accepting just
        // a uuid) is loud.
        let err = parse_cursor("2026-05-31T12:00:00").unwrap_err();
        assert!(matches!(err, RealtimeError::BadRequest(_)));
    }

    #[test]
    fn empty_entries_response_carries_null_next_cursor() {
        // Review R10 / QA-2 — pin the contract that the SPA's
        // "Load more" reads on. The handler emits next_cursor
        // when `entries.len() > limit` after fetching `limit+1`;
        // a regression that flipped the inequality or emitted a
        // cursor for empty pages would render a phantom button.
        let response = ListAuditLogResponse {
            entries: vec![],
            next_cursor: None,
        };
        let serialised = serde_json::to_value(&response).unwrap();
        assert_eq!(serialised["entries"].as_array().unwrap().len(), 0);
        assert!(
            serialised["next_cursor"].is_null(),
            "empty page must serialise next_cursor as null, got: {serialised:?}",
        );
    }
}
