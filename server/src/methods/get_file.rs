use crate::{config::SERVER_CONFIG, db::DB, internal_types::Auth, utils::get_folder_and_file_path};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn get_file(req: Request<Body>, db: DB, auth: &Auth) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let user_id = match &auth.authenticated_user {
        Some(user_id) => user_id.clone(),
        None => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))?)
        }
    };

    let file_id = req.uri().path().replacen("/get_file/", "", 1);

    let file = match db.get_file_by_id(&file_id).await {
        Ok(file) => file,
        Err(_) => {
            return Ok(Response::builder()
                .status(404)
                .body(Body::from("File not found"))
                .unwrap());
        }
    };

    // check if user is allowed to access file
    if user_id != file.owner_id {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file");
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
