use crate::{db::DB, internal_types::Auth, utils::get_query_item_number};
use hyper::{Body, Request, Response};

pub async fn get_file_infos_by_group_id(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id.clone(),
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };
    let group_id = req
        .uri()
        .path()
        .replacen("/api/get_file_infos_by_group_id/", "", 1);

    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);

    let files = db
        .get_files_by_group_id(&group_id, limit, from_index)
        .await?;

    let files = files
        .iter()
        .filter(|f| f.owner_id == user_id)
        .collect::<Vec<_>>();

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&files)?.into())
        .unwrap())
}
