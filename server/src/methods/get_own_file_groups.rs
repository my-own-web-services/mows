use crate::{
    db::DB,
    internal_types::Auth,
    utils::{get_query_item, get_query_item_number},
};
use filez_common::server::{FileGroupType, FilezFileGroup, GetItemListResponseBody, SortOrder};
use hyper::{Body, Request, Response};

pub async fn get_own_file_groups(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let limit = get_query_item_number(&req, "l");
    let from_index = get_query_item_number(&req, "i").unwrap_or(0);

    let field = get_query_item(&req, "f");
    let group_type = match get_query_item(&req, "t") {
        Some(s) => match s.as_str() {
            "Static" => Some(FileGroupType::Static),
            "Dynamic" => Some(FileGroupType::Dynamic),
            _ => None,
        },
        None => None,
    };

    let sort_order = get_query_item(&req, "o").map_or(SortOrder::Ascending, |s| match s.as_str() {
        "Ascending" => SortOrder::Ascending,
        "Descending" => SortOrder::Descending,
        _ => SortOrder::Ascending,
    });

    let filter = get_query_item(&req, "s");

    let (items, total_count) = db
        .get_file_groups_by_owner_id_for_virtual_list(
            &requesting_user.user_id,
            limit,
            from_index as u64,
            field,
            sort_order,
            filter,
            group_type,
        )
        .await?;

    let res_body = GetItemListResponseBody::<FilezFileGroup> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
