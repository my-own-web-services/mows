use crate::{
    db::DB,
    internal_types::{Auth, GetItemListRequestBody, GetItemListResponseBody},
};
use filez_common::server::file_group::{FileGroupType, FilezFileGroup};
use hyper::{Body, Request, Response};

/**
# Gets filez file groups by owner id for virtual scrolling

## Call
`/api/file_group/list/`

## Possible Mutations
Mutation > None

## Multiple Resources
Yes
*/

pub async fn get_own_file_groups(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let group_type = match crate::utils::get_query_item(&req, "t") {
        Some(v) => match v.as_str() {
            "Static" => Some(FileGroupType::Static),
            "Dynamic" => Some(FileGroupType::Dynamic),
            _ => None,
        },
        None => None,
    };

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let grrb: GetItemListRequestBody = serde_json::from_slice(&body)?;

    let (items, total_count) = db
        .get_file_groups_by_owner_id_for_virtual_list(&requesting_user.user_id, &grrb, group_type)
        .await?;

    let res_body = GetItemListResponseBody::<FilezFileGroup> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
