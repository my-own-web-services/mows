use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Extension, Json,
};

use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_groups::FileGroup,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    get,
    path = "/api/file_groups/get/{file_group_id}",
    responses(
        (status = 200, description = "Gets a file group by ID", body = ApiResponse<FileGroup>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_file_group(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_group_id): Path<Uuid>,
) -> Result<Json<ApiResponse<FileGroup>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::FileGroup,
            Some(&vec![file_group_id]),
            AccessPolicyAction::FileGroupsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let file_group = with_timing!(
        FileGroup::get_by_id(&db, &file_group_id).await?,
        "Database operation to get file group by ID",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "File group retrieved".to_string(),
        data: Some(file_group),
    }))
}
