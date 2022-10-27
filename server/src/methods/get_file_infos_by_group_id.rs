use crate::db::DB;
use hyper::{Body, Request, Response};

pub async fn get_file_infos_by_group_id(
    req: Request<Body>,
    db: DB,
    user_id: &str,
) -> anyhow::Result<Response<Body>> {
    let group_id = req
        .uri()
        .path()
        .replacen("/get_file_infos_by_group_id/", "", 1);

    let files = db.get_files_by_group_id(&group_id).await?;

    let files = files
        .iter()
        .filter(|f| f.owner == user_id)
        .collect::<Vec<_>>();

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&files)?.into())
        .unwrap())
}
