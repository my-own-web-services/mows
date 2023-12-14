use crate::{
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    retry_transient_transaction_error,
    utils::generate_id,
};
use filez_common::server::{FileGroupType, FilezFileGroup, FilterRule};
use hyper::{body::Body, Request, Response};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
/**
# Creates a new file group.

## Call
`/api/file_group/create/`
## Permissions
None

## Possible Mutations
Mutation > FilezFileGroup
Mutation > FilezFile
*/

// TODO extract dynamic and static file groups into separate collections and structs
pub async fn create_file_group(
    req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    crate::check_content_type_json!(req, res);

    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);

    let body = hyper::body::to_bytes(req.into_body()).await?;

    let cgr: CreateFileGroupRequestBody = serde_json::from_slice(&body)?;

    let group_id = generate_id(16);

    let file_group = FilezFileGroup {
        owner_id: requesting_user.user_id.to_string(),
        name: cgr.name,
        file_group_id: group_id.clone(),
        permission_ids: cgr.permission_ids,
        keywords: cgr.keywords,
        group_hierarchy_paths: cgr.group_hierarchy_paths,
        mime_types: cgr.mime_types,
        group_type: cgr.group_type.clone(),
        item_count: 0,
        dynamic_group_rules: cgr.dynamic_group_rules,
        readonly: match cgr.group_type {
            FileGroupType::Static => false,
            FileGroupType::Dynamic => true,
        },
    };

    retry_transient_transaction_error!(db.create_file_group(&file_group).await);

    handle_dynamic_group_update(db, &UpdateType::Group(file_group)).await?;

    let res_body = CreateFileGroupResponseBody { group_id };

    Ok(res
        .status(200)
        .body(Body::from(serde_json::to_string(&res_body)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileGroupRequestBody {
    pub name: Option<String>,
    pub keywords: Vec<String>,
    pub mime_types: Vec<String>,
    pub group_hierarchy_paths: Vec<String>,
    pub group_type: FileGroupType,
    pub dynamic_group_rules: Option<FilterRule>,
    pub permission_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileGroupResponseBody {
    pub group_id: String,
}
