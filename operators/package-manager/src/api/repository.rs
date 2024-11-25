pub mod repository {
    use axum::{extract::State, Json};
    use serde::{Deserialize, Serialize};
    use utoipa::ToSchema;
    use utoipa_axum::{router::OpenApiRouter, routes};

    use crate::{
        db::{
            db::Db,
            models::{NewRepository, Repository},
        },
        types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    };

    pub fn router() -> OpenApiRouter<Db> {
        OpenApiRouter::new()
            .routes(routes!(add_repositories))
            .routes(routes!(get_repositories))
    }

    #[utoipa::path(
        post,
        path = "",
        request_body = AddRepositoryReqBody,
        responses(
            (status = 200, description = "Repository added", body = ApiResponse<EmptyApiResponse>),
        ),
    )]
    async fn add_repositories(
        State(db): State<Db>,
        Json(req_body): Json<AddRepositoryReqBody>,
    ) -> Json<ApiResponse<EmptyApiResponse>> {
        match db.add_repository(req_body.repositories).await {
            Ok(_) => Json(ApiResponse {
                status: ApiResponseStatus::Success,
                message: "Repositories added successfully".to_string(),
                data: None,
            }),
            Err(e) => Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: e.to_string(),
                data: None,
            }),
        }
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
    pub struct AddRepositoryReqBody {
        pub repositories: Vec<NewRepository>,
    }

    #[utoipa::path(
        get,
        path = "",
        responses(
            (status = 200, description = "Repositories fetched", body = ApiResponse<GetRepositoriesResBody>),
        ),
    )]
    async fn get_repositories(State(db): State<Db>) -> Json<ApiResponse<GetRepositoriesResBody>> {
        match db.get_repositories().await {
            Ok(repositories) => Json(ApiResponse {
                status: ApiResponseStatus::Success,
                message: "Repositories fetched successfully".to_string(),
                data: Some(GetRepositoriesResBody { repositories }),
            }),
            Err(e) => Json(ApiResponse {
                status: ApiResponseStatus::Error,
                message: e.to_string(),
                data: None,
            }),
        }
    }

    #[derive(Debug, Serialize, Deserialize, ToSchema)]
    pub struct GetRepositoriesResBody {
        pub repositories: Vec<Repository>,
    }
}
