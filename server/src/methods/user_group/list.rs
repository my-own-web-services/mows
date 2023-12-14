use crate::{db::DB, internal_types::Auth};
use filez_common::server::{FilezUserGroup, GetItemListRequestBody, GetItemListResponseBody};
use hyper::{Body, Request, Response};

pub async fn get_user_group_list(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let grrb: GetItemListRequestBody = serde_json::from_slice(&body)?;

    let (items, total_count) = db.get_user_group_list(&requesting_user, &grrb).await?;

    let res_body = GetItemListResponseBody::<FilezUserGroup> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
