use axum::extract::FromRef;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectionState;

use crate::{api::files::create::CreateFileRequestBody, db::Db};

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "filez-server", description = "MOWS Filez API"),
    ),
    components(
        schemas(
            CreateFileRequestBody,
        )
    ),
)]
pub struct ApiDoc;

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum SortOrder {
    Ascending,
    Descending,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ApiResponse<T> {
    pub message: String,
    pub status: ApiResponseStatus,
    pub data: Option<T>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct EmptyApiResponse;

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ApiResponseStatus {
    Success,
    Error,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub minio_client: minio::s3::Client,
    pub introspection_state: zitadel::axum::introspection::IntrospectionState,
}

impl FromRef<AppState> for IntrospectionState {
    fn from_ref(app_state: &AppState) -> IntrospectionState {
        app_state.introspection_state.clone()
    }
}
