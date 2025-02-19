pub mod repository {
    use axum::{extract::State, Json};
    use mows_common::get_current_config_cloned;
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;
    use utoipa::ToSchema;
    use utoipa_axum::{router::OpenApiRouter, routes};

    use crate::{
        config::config,
        db::{
            db::Db,
            models::{NewRepository, Repository},
        },
        rendered_document::RenderedDocument,
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

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, Eq)]
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

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, Eq)]
    pub struct GetRepositoriesResBody {
        pub repositories: Vec<Repository>,
    }

    #[utoipa::path(
        post,
        path = "/render",
        request_body = RenderRepositoriesReqBody,
        responses(
            (status = 200, description = "Repository rendered", body = ApiResponse<RenderRepositoriesResBody>),
        ),
    )]
    async fn render_repositories(
        State(db): State<Db>,
        Json(req_body): Json<RenderRepositoriesReqBody>,
    ) -> Json<ApiResponse<RenderRepositoriesResBody>> {
        let mut results = Vec::new();

        let config = get_current_config_cloned!(config());

        for repository_render_req in req_body.repositories.iter() {
            let repository = Repository::new(&repository_render_req.uri);

            let render_result = match repository
                .render(&repository_render_req.namespace, &config.working_dir)
                .await
            {
                Ok(v) => v,
                Err(e) => {
                    return Json(ApiResponse {
                        status: ApiResponseStatus::Error,
                        message: e.to_string(),
                        data: None,
                    })
                }
            };

            results.push(render_result);
        }

        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Repositories rendered successfully".to_string(),
            data: Some(RenderRepositoriesResBody { results }),
        })
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, Eq)]
    pub struct RenderRepositoriesReqBody {
        pub repositories: Vec<RenderRepositoriesRepository>,
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, Eq)]
    pub struct RenderRepositoriesRepository {
        pub uri: String,
        pub namespace: String,
        pub target: RenderRepositoriesTarget,
        pub secrets: Option<HashMap<String, String>>,
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, Eq)]
    pub enum RenderRepositoriesRepositorySelector {
        Direct(NewRepository),
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, PartialOrd, Ord, Eq)]
    pub enum RenderRepositoriesTarget {
        RenderOnly(RenderRepositoriesTargetRenderOnly),
        KubectlApply(RenderRepositoriesTargetKubectlApply),
        Git(RenderRepositoriesTargetGit),
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, PartialOrd, Ord, Eq)]
    pub struct RenderRepositoriesTargetRenderOnly {}

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, PartialOrd, Ord, Eq)]
    pub struct RenderRepositoriesTargetKubectlApply {
        pub kubeconfig: String,
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, PartialOrd, Ord, Eq)]
    pub struct RenderRepositoriesTargetGit {}

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq, Eq)]
    pub struct RenderRepositoriesResBody {
        pub results: Vec<Vec<RenderedDocument>>,
    }
}
