use crate::{db::DB, internal_types::Auth, some_or_bail, utils::check_auth};
use anyhow::bail;
use hyper::{Body, Request, Response};

pub async fn get_file(req: Request<Body>, db: DB, auth: &Auth) -> anyhow::Result<Response<Body>> {
    let file_id = req.uri().path().replacen("/api/get_file/", "", 1);

    let file = match db.get_file_by_id(&file_id).await {
        Ok(f) => some_or_bail!(f, "File not found"),
        Err(_) => {
            return Ok(Response::builder()
                .status(404)
                .body(Body::from("File not found"))
                .unwrap());
        }
    };

    match check_auth(auth, &file, &db, "get_file").await {
        Ok(true) => {}
        Ok(false) => {
            return Ok(Response::builder()
                .status(401)
                .body(Body::from("Unauthorized"))
                .unwrap());
        }
        Err(e) => bail!(e),
    }

    // stream the file from disk to the client
    let file_handle = tokio::fs::File::open(&file.path).await?;

    let body = Body::wrap_stream(hyper_staticfile::FileBytesStream::new(file_handle));

    Ok(Response::builder()
        .status(200)
        .header("Content-Type", file.mime_type)
        .header("Cache-Control", "public, max-age=31536000")
        .body(body)
        .unwrap())
}
