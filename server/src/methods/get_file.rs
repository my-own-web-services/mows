use anyhow::bail;
use arangors::Connection;
use hyper::{Body, Request, Response};

use crate::{config::SERVER_CONFIG, db::DB, utils::get_folder_and_file_path};

pub async fn get_file(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";
    let config = &SERVER_CONFIG;

    if req.method() != hyper::Method::GET {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }
    let file_id = req.uri().path().replacen("/get_file/", "", 1);

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let file = db.get_file_by_id(&file_id).await?;

    // check if user is allowed to access file
    if user_id != file.owner {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file");
    }

    let (folder_path, file_name) =
        get_folder_and_file_path(&file.id, &config.storage[&file.storage_name].path);

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
