use crate::{
    db::DB,
    internal_types::Auth,
    utils::{get_query_item, get_query_item_number},
};
use filez_common::server::{FilezFile, GetItemListResponseBody, SortOrder};
use hyper::{Body, Request, Response};

pub async fn get_file_infos_by_group_id(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);
    let group_id = req
        .uri()
        .path()
        .replacen("/api/get_file_infos_by_group_id/", "", 1);

    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);

    let field = get_query_item(&req, "f");
    let sort_order = get_query_item(&req, "o").map_or(SortOrder::Ascending, |s| match s.as_str() {
        "Ascending" => SortOrder::Ascending,
        "Descending" => SortOrder::Descending,
        _ => SortOrder::Ascending,
    });

    let filter = get_query_item(&req, "s");

    let (items, total_count) = db
        .get_files_by_group_id(
            &group_id,
            limit,
            from_index as u64,
            field,
            sort_order,
            filter,
        )
        .await?;

    let items = items
        .into_iter()
        .filter(|f| f.owner_id == requesting_user.user_id)
        .collect::<Vec<FilezFile>>();

    let res_body = GetItemListResponseBody::<FilezFile> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
