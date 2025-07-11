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
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    delete,
    path = "/api/file_groups/delete/{file_group_id}",
    responses(
        (status = 200, description = "Deletes a file group", body = ApiResponse<String>),
    )
)]
pub async fn delete_file_group(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Path(file_group_id): Path<Uuid>,
) -> Result<Json<ApiResponse<String>>, FilezError> {
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
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::FileGroup).unwrap(),
            Some(&vec![file_group_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::FileGroupDelete).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        FileGroup::delete(&db, &file_group_id).await?,
        "Database operation to delete file group",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "File group deleted".to_string(),
        data: Some(file_group_id.to_string()),
    }))
}
