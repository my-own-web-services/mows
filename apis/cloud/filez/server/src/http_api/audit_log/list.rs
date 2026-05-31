//! `POST /api/audit_log/list` — sibling of realtime's audit_log
//! endpoint. Same wire shape so the authz-admin BFF stays
//! translator-free.
//!
//! Two query modes (both gated on authentication):
//!
//!   1. **Resource-scoped** — caller passes `(resource_type,
//!      resource_id)`. Returns events touching that resource,
//!      newest first. Owner-only access: existence + ownership
//!      collapsed into one 403 to defeat UUID fingerprinting.
//!      Filez supports File + FileGroup here.
//!   2. **Self-scoped** — caller passes no resource filters.
//!      Returns events the caller themselves caused (`actor_id =
//!      caller.id`).
//!
//! Pagination is keyset-style via the opaque cursor
//! `"<ts_iso>|<id>"` returned in `next_cursor`. Field names + cursor
//! format are pinned by `wire_shape_guard` tests so the BFF can
//! forward bytes verbatim.

use axum::{extract::State, Extension};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::AccessPolicyResourceType,
        audit_log::{AuditLog, AuditLogId},
        file_groups::FileGroupId,
        files::FilezFileId,
        users::FilezUserId,
    },
    schema,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::Json,
    with_timing,
};

const MAX_LIMIT: i64 = 200;
const DEFAULT_LIMIT: i64 = 50;

/// Wire-stable request body. Field names match the realtime sibling
/// verbatim — the authz-admin BFF forwards bytes through with no
/// translation, the SPA reads identical keys regardless of upstream.
#[derive(Serialize, Deserialize, ToSchema, Debug, Clone, Validate)]
pub struct ListAuditLogRequestBody {
    pub resource_type: Option<AccessPolicyResourceType>,
    pub resource_id: Option<Uuid>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub cursor: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Debug, Clone, Validate)]
pub struct ListAuditLogResponseBody {
    pub entries: Vec<AuditLog>,
    pub next_cursor: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/audit_log/list",
    description = "Paginated audit-log timeline. Resource-scoped when (resource_type, resource_id) are supplied (owner-only); self-scoped otherwise (caller's own actions). Sibling of realtime-server's endpoint; both emit the same wire shape so the authz-admin BFF can forward verbatim.",
    request_body = ListAuditLogRequestBody,
    responses(
        (status = 200, description = "Audit page", body = ApiResponse<ListAuditLogResponseBody>),
        (status = 400, description = "Malformed cursor or partial resource filter"),
        (status = 401, description = "Anonymous request"),
        (status = 403, description = "Resource doesn't exist OR caller is not its owner — deliberately indistinguishable"),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_audit_log(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(body): Json<ListAuditLogRequestBody>,
) -> Result<Json<ApiResponse<ListAuditLogResponseBody>>, FilezError> {
    let caller = authentication_information
        .requesting_user
        .as_ref()
        .ok_or_else(|| FilezError::Unauthorized("authentication required".to_string()))?;

    let limit = body
        .limit
        .map(|l| l.clamp(1, MAX_LIMIT))
        .unwrap_or(DEFAULT_LIMIT);

    let resource_scope = match (body.resource_type, body.resource_id) {
        (Some(rt), Some(rid)) => Some((rt, rid)),
        (None, None) => None,
        (Some(_), None) | (None, Some(_)) => {
            return Err(FilezError::InvalidRequest(
                "resource_type and resource_id must be supplied together"
                    .to_string(),
            ));
        }
    };

    let cursor = match body.cursor.as_deref() {
        None => None,
        Some(raw) => Some(parse_cursor(raw)?),
    };

    let mut connection = database.get_connection().await?;

    // Owner gate. Same indistinguishable-403 stance as
    // /by_resource. File + FileGroup are the two ownable types
    // this endpoint serves; other types collapse to the same 403
    // so the surface is uniform.
    if let Some((rt, rid)) = resource_scope {
        let exists_and_owned: bool = match rt {
            AccessPolicyResourceType::File => with_timing!(
                schema::files::table
                    .filter(schema::files::id.eq(FilezFileId(rid)))
                    .filter(schema::files::owner_id.eq(caller.id))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
                    > 0,
                "audit_log: file owner gate",
                timing
            ),
            AccessPolicyResourceType::FileGroup => with_timing!(
                schema::file_groups::table
                    .filter(schema::file_groups::id.eq(FileGroupId(rid)))
                    .filter(schema::file_groups::owner_id.eq(caller.id))
                    .count()
                    .get_result::<i64>(&mut connection)
                    .await?
                    > 0,
                "audit_log: file_group owner gate",
                timing
            ),
            _ => false,
        };
        if !exists_and_owned {
            return Err(FilezError::Forbidden(
                "no such resource, or caller is not its owner".to_string(),
            ));
        }
    }

    let fetch_limit = limit + 1;
    let mut entries: Vec<AuditLog> = match resource_scope {
        Some((rt, rid)) => with_timing!(
            {
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
            },
            "audit_log: resource-scoped page",
            timing
        ),
        None => with_timing!(
            {
                let q = schema::audit_log::table
                    .filter(schema::audit_log::actor_id.eq(FilezUserId(caller.id.0)))
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
            },
            "audit_log: self-scoped page",
            timing
        ),
    };

    let next_cursor = if entries.len() as i64 > limit {
        entries.truncate(limit as usize);
        entries.last().map(|row| format_cursor(row.ts, row.id.0))
    } else {
        None
    };

    let count = entries.len();
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: format!("{count} entry(ies)"),
        data: Some(ListAuditLogResponseBody {
            entries,
            next_cursor,
        }),
    }))
}

/// Same keyset filter pattern realtime uses — extracted once per
/// file so a future cursor change lands in one place per service.
/// Review R5 / SLOP-2 / TECH-2.
fn apply_keyset_filter(
    q: schema::audit_log::BoxedQuery<'_, diesel::pg::Pg>,
    cursor: Option<(chrono::NaiveDateTime, Uuid)>,
) -> schema::audit_log::BoxedQuery<'_, diesel::pg::Pg> {
    match cursor {
        None => q,
        Some((cursor_ts, cursor_id)) => q.filter(
            schema::audit_log::ts.lt(cursor_ts).or(
                schema::audit_log::ts.eq(cursor_ts).and(
                    schema::audit_log::id.lt(AuditLogId(cursor_id)),
                ),
            ),
        ),
    }
}

fn parse_cursor(raw: &str) -> Result<(chrono::NaiveDateTime, Uuid), FilezError> {
    let (ts_part, id_part) = raw.split_once('|').ok_or_else(|| {
        FilezError::InvalidRequest(format!(
            "cursor must be `<ts_iso>|<id>`; got {raw:?}"
        ))
    })?;
    let ts = chrono::NaiveDateTime::parse_from_str(ts_part, "%Y-%m-%dT%H:%M:%S%.f")
        .or_else(|_| chrono::NaiveDateTime::parse_from_str(ts_part, "%Y-%m-%dT%H:%M:%S"))
        .map_err(|e| {
            FilezError::InvalidRequest(format!(
                "cursor ts part {ts_part:?} is not ISO-8601: {e}"
            ))
        })?;
    let id = Uuid::parse_str(id_part).map_err(|e| {
        FilezError::InvalidRequest(format!(
            "cursor id part {id_part:?} is not a UUID: {e}"
        ))
    })?;
    Ok((ts, id))
}

fn format_cursor(ts: chrono::NaiveDateTime, id: Uuid) -> String {
    format!("{}|{}", ts.format("%Y-%m-%dT%H:%M:%S%.6f"), id)
}

#[cfg(test)]
mod wire_shape_guard {
    //! Pins the request + response field names + cursor format so
    //! the realtime sibling stays drop-in compatible + the BFF
    //! stays translator-free.
    use super::*;
    use serde_json::json;

    #[test]
    fn request_body_field_names_pinned() {
        let parsed: ListAuditLogRequestBody = serde_json::from_value(json!({
            "resource_type": "File",
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
        let parsed: ListAuditLogRequestBody =
            serde_json::from_value(json!({})).expect("empty body accepted");
        assert!(parsed.resource_type.is_none());
        assert!(parsed.resource_id.is_none());
    }

    #[test]
    fn response_body_field_names_pinned() {
        let body = ListAuditLogResponseBody {
            entries: vec![],
            next_cursor: None,
        };
        let serialised = serde_json::to_value(&body).expect("serialise");
        assert!(serialised.get("entries").is_some());
        assert!(serialised.get("next_cursor").is_some());
        assert!(serialised.get("items").is_none());
        assert!(serialised.get("audit_log").is_none());
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
        assert!(matches!(err, FilezError::InvalidRequest(_)));
    }
}
