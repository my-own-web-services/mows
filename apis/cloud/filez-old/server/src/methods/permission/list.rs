use crate::{
    db::DB,
    internal_types::{Auth, GetItemListRequestBody, GetItemListResponseBody},
};
use filez_common::server::permission::{FilezPermission, PermissionResourceSelectType};
use hyper::{Body, Request, Response};

/**
# Gets filez permissions by owner id for virtual scrolling

## Call
`/api/permission/list/`

## Possible Mutations
Mutation > None

## Multiple Resources
Yes
*/

pub async fn list_permissions(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let grrb: GetItemListRequestBody = serde_json::from_slice(&body)?;

    let permission_type = match &grrb.sub_resource_type {
        Some(v) => match v.as_str() {
            "File" => Some(PermissionResourceSelectType::File),
            "FileGroup" => Some(PermissionResourceSelectType::FileGroup),
            "User" => Some(PermissionResourceSelectType::User),
            "UserGroup" => Some(PermissionResourceSelectType::UserGroup),
            _ => None,
        },
        None => None,
    };

    let (items, total_count) = db
        .get_permissions_by_owner_id_for_virtual_list(
            &requesting_user.user_id,
            &grrb,
            permission_type,
        )
        .await?;

    let res_body = GetItemListResponseBody::<FilezPermission> { items, total_count };

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&res_body)?.into())
        .unwrap())
}
