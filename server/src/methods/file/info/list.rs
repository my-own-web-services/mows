use crate::{
    db::DB,
    internal_types::{Auth, GetItemListRequestBody, GetItemListResponseBody},
};
use filez_common::server::file::FilezFile;
use hyper::{Body, Request, Response};
use simple_server_timing_header::Timer;

/**
# Gets filez files by group id for virtual scrolling

## Call
`/api/file/info/list/`

## Possible Mutations
Mutation > None

## Multiple Resources
Yes
*/
pub async fn get_file_infos_by_group_id(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let mut timer = Timer::new();
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);
    timer.add("10 Get Authenticated User");

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
    timer.add("20 Get files from db");

    let items = items
        .into_iter()
        .filter(|f| f.owner_id == requesting_user.user_id)
        .collect::<Vec<FilezFile>>();
    timer.add("20 Filter files by owner");

    let res_body = GetItemListResponseBody::<FilezFile> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .header("Server-Timing", timer.header_value())
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
