use crate::{
    db::DB,
    internal_types::Auth,
    types::{FilezFile, GetFileInfosByGroupIdResponseBody, SortOrder},
    utils::{get_query_item, get_query_item_number},
};
use hyper::{Body, Request, Response};

pub async fn get_file_infos_by_group_id(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id.clone(),
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };
    let group_id = req
        .uri()
        .path()
        .replacen("/api/get_file_infos_by_group_id/", "", 1);

    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);

    let field = get_query_item(&req, "f");
    let sort_order = get_query_item(&req, "o").map_or(SortOrder::Ascending, |s| match s.as_str() {
        "ascending" => SortOrder::Ascending,
        "descending" => SortOrder::Descending,
        _ => SortOrder::Ascending,
    });

    let filter = get_query_item(&req, "s");

    let (files, total_count) = db
        .get_files_by_group_id(
            &group_id,
            limit,
            from_index as u64,
            field,
            sort_order,
            filter,
        )
        .await?;

    let files = files
        .into_iter()
        .filter(|f| f.owner_id == user_id)
        .collect::<Vec<FilezFile>>();

    let res_body = GetFileInfosByGroupIdResponseBody { files, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
