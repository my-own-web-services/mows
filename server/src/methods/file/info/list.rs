use crate::{db::DB, internal_types::Auth};
use filez_common::server::{FilezFile, GetItemListRequestBody, GetItemListResponseBody};
use hyper::{Body, Request, Response};

pub async fn get_file_infos_by_group_id(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let grrb: GetItemListRequestBody = serde_json::from_slice(&body)?;

    let (items, total_count) = db
        .get_files_by_group_id(
            match &grrb.id {
                Some(g) => g,
                None => return Ok(res.status(400).body("No group id provided".into()).unwrap()),
            },
            &grrb,
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
