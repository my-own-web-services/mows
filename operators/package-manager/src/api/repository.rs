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
            .routes(routes!(render_repositories))
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
        match db.get_all_repositories().await {
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

    #[utoipa::path(
        post,
        path = "/render",
        request_body = RenderRepositoriesReqBody,
        responses(
            (status = 200, description = "Repository rendered", body = ApiResponse<EmptyApiResponse>),
        ),
    )]
    async fn render_repositories(
        State(db): State<Db>,
        Json(req_body): Json<RenderRepositoriesReqBody>,
    ) -> Json<ApiResponse<EmptyApiResponse>> {
        let repositories = match db.get_all_repositories().await {
            Ok(repositories) => repositories,
            Err(e) => {
                return Json(ApiResponse {
                    status: ApiResponseStatus::Error,
                    message: e.to_string(),
                    data: None,
                })
            }
        };

        let repositories = repositories
            .into_iter()
            .filter(|r| req_body.repository_ids.contains(&r.id))
            .collect::<Vec<Repository>>();

        for repository in repositories {
            match repository.render().await {
                Ok(_) => (),
                Err(e) => {
                    return Json(ApiResponse {
                        status: ApiResponseStatus::Error,
                        message: e.to_string(),
                        data: None,
                    })
                }
            }
        }

        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Repositories rendered successfully".to_string(),
            data: None,
        })
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
    pub struct RenderRepositoriesReqBody {
        pub repository_ids: Vec<i32>,
    }
}
