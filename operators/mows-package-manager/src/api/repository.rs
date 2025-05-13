use axum::Json;
use mows_common::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

use crate::{
    config::config,
    dev::get_fake_cluster_config,
    rendered_document::RenderedDocument,
    repository::Repository,
    types::{ApiResponse, ApiResponseStatus},
};

#[utoipa::path(
        post,
        path = "/api/repository/render",
        request_body = RenderRepositoriesReqBody,
        responses(
            (status = 200, description = "Repository rendered", body = ApiResponse<RenderRepositoriesResBody>),
        ),
    )]
pub async fn render_repositories(
    Json(req_body): Json<RenderRepositoriesReqBody>,
) -> Json<ApiResponse<RenderRepositoriesResBody>> {
    let mut results = Vec::new();

    let config = get_current_config_cloned!(config());

    for repository_render_req in req_body.repositories.iter() {
        let repository = Repository::new(&repository_render_req.uri);

        let cluster_variables = get_fake_cluster_config().await;

        let render_result = match repository
            .render(
                &repository_render_req.namespace,
                &config.working_dir,
                &cluster_variables,
            )
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
