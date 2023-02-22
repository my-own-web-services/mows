use crate::{
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    types::UpdateFileGroupRequestBody,
};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn update_file_group(
    req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id,
        None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
    };

    let ufgr: UpdateFileGroupRequestBody =
        serde_json::from_slice(&hyper::body::to_bytes(req.into_body()).await?)?;

    let group = match db.get_file_group_by_id(&ufgr.file_group_id).await? {
        Some(g) => g,
        None => bail!("group not found"),
    };

    if group.owner_id != *user_id {
        bail!("not authorized");
    }

    let mut new_group = group.clone();

    if let Some(new_name) = ufgr.new_name {
        if new_name.len() > 50 {
            bail!("name too long");
        }
        if new_name.is_empty() {
            bail!("name too short");
        }

        new_group.name = Some(new_name);
    }

    if let Some(new_keywords) = ufgr.new_keywords {
        new_group.keywords = new_keywords;
    }

    if let Some(new_mime_types) = ufgr.new_mime_types {
        new_group.mime_types = new_mime_types;
    }

    if let Some(new_group_type) = ufgr.new_group_type {
        new_group.group_type = new_group_type;
    }

    if let Some(new_dynamic_group_rules) = ufgr.new_dynamic_group_rules {
        new_group.dynamic_group_rules = Some(new_dynamic_group_rules);
    }

    db.update_file_group(&new_group).await?;

    handle_dynamic_group_update(&db, &UpdateType::Group(new_group)).await?;

    Ok(res
        .status(200)
        .header("Content-Type", "application/json")
        .body(Body::from(""))
        .unwrap())
}
