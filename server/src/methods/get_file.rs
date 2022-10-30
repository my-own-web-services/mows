use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth, utils::get_folder_and_file_path};
use hyper::{Body, Request, Response};

pub async fn get_file(req: Request<Body>, db: DB, auth: &Auth) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let file_id = req.uri().path().replacen("/get_file/", "", 1);

    let file = match db.get_file_by_id(&file_id).await {
        Ok(f) => f,
        Err(_) => {
            return Ok(Response::builder()
                .status(404)
                .body(Body::from("File not found"))
                .unwrap());
        }
    };

    let mut auth_ok = false;
    if let Some(user_id) = &auth.authenticated_user {
        // user present
        if file.owner_id == *user_id {
            // user is the owner
            auth_ok = true;
        } else {
            // user is not the owner
            let permissions = db.get_merged_permissions_from_file(&file).await?;

            if let Some(acl) = permissions.acl {
                if let Some(users_acl) = acl.users {
                    if let Some(users_acl_read) = users_acl.read {
                        if let Some(users_acl_read_user_ids) = users_acl_read.user_ids {
                            if users_acl_read_user_ids.contains(user_id) {
                                auth_ok = true;
                            }
                        }
                        if !auth_ok {
                            if let Some(users_acl_read_user_group_ids) =
                                users_acl_read.user_group_ids
                            {
                                let user = db.get_user_by_id(user_id).await?;
                                if let Some(user_groups) = user.group_ids {
                                    for user_group in user_groups {
                                        if users_acl_read_user_group_ids.contains(&user_group) {
                                            auth_ok = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // TODO handle ribston
    } else if let Some(token) = &auth.token {
        // handle password
    } else {
        // check if file is public
    }

    if !auth_ok {
        return Ok(Response::builder()
            .status(403)
            .body(Body::from("Forbidden"))
            .unwrap());
    }

    let (folder_path, file_name) =
        get_folder_and_file_path(&file.file_id, &config.storage[&file.storage_name].path);

    let file_path = format!("{}/{}", folder_path, file_name);

    // stream the file from disk to the client
    let file_handle = tokio::fs::File::open(file_path).await?;

    let body = Body::wrap_stream(hyper_staticfile::FileBytesStream::new(file_handle));

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", file.mime_type)
        .body(body)
        .unwrap())
}
