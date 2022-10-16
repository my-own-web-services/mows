use anyhow::bail;
use arangors::Connection;
use filez::config::read_config;
use filez::db::DB;
use filez::some_or_bail;
use filez::types::{CreateFileRequest, CreateFileResponse, FilezFile, ServerConfig};
use filez::utils::{generate_id, get_folder_and_file_path};
use hyper::body::HttpBody;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Request, Response, Server};
use lazy_static::lazy_static;
use sha2::{Digest, Sha256};
use std::convert::Infallible;
use std::fs::{self, File};
use std::io::Write;

lazy_static! {
    pub static ref SERVER_CONFIG: ServerConfig = read_config().unwrap();
}

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // reference variables declared with lazy_static because they are initialized on first access
    let _ = &SERVER_CONFIG.variable_prefix;

    let addr = ([0, 0, 0, 0], 8080).into();

    let server = Server::bind(&addr).serve(make_service_fn(|_conn| async {
        Ok::<_, Infallible>(service_fn(handle_request))
    }));

    println!("Listening on http://{}", addr);
    server.with_graceful_shutdown(shutdown_signal()).await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
}

async fn handle_request(req: Request<Body>) -> Result<Response<Body>, Infallible> {
    match handle_inner(req).await {
        Ok(res) => Ok(res),
        Err(e) => {
            println!("Internal Server Error: {}", e);
            Ok(Response::builder()
                .status(500)
                .body(Body::from("Internal Server Error"))
                .unwrap())
        }
    }
}

async fn handle_inner(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    if req.uri().path().starts_with("/get_file") {
        get_file(req).await
    } else if req.uri().path().starts_with("/create_file") {
        create_file(req).await
    } else if req.uri().path().starts_with("/delete_file") {
        delete_file(req).await
    } else {
        bail!("Invalid path");
    }
}

async fn get_file(req: Request<Body>) -> anyhow::Result<Response<Body>> {
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

async fn delete_file(req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";
    let config = &SERVER_CONFIG;
    if req.method() != hyper::Method::POST {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }

    let file_id = req.uri().path().replacen("/delete_file/", "", 1);
    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let file = db.get_file_by_id(&file_id).await?;

    if user_id != file.owner {
        // TODO user is not the owner so we need to check the permissions
        bail!("User is not allowed to access file");
    }

    let (folder_path, file_name) =
        get_folder_and_file_path(&file.id, &config.storage[&file.storage_name].path);

    let file_path = format!("{}/{}", folder_path, file_name);

    db.delete_file_by_id(&file_id).await?;
    fs::remove_file(file_path)?;

    Ok(Response::builder().status(200).body(Body::from("OK"))?)
}

async fn create_file(mut req: Request<Body>) -> anyhow::Result<Response<Body>> {
    let user_id = "test";
    let config = &SERVER_CONFIG;

    if req.method() != hyper::Method::POST {
        return Ok(Response::builder()
            .status(405)
            .body(Body::from("Method Not Allowed"))
            .unwrap());
    }
    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let create_request: CreateFileRequest = serde_json::from_str(request_header)?;

    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;

    let user = db.get_user_by_id(user_id).await?;

    let storage_name = create_request
        .storage_name
        .unwrap_or_else(|| config.default_storage.clone());

    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = some_or_bail!(
        user.limits.get(&storage_name),
        format!("Invalid storage name: {}", storage_name)
    );
    let bytes_left = storage_limits.max_storage - storage_limits.used_storage;
    if size_hint.lower() > bytes_left
        || size_hint.upper().is_some() && size_hint.upper().unwrap() > bytes_left
    {
        bail!("User storage limit exceeded");
    }

    // file count check
    if storage_limits.used_files >= storage_limits.max_files {
        bail!("User file limit exceeded");
    }

    let storage_path = some_or_bail!(
        config.storage.get(&storage_name),
        format!("Invalid storage name: {}", storage_name)
    )
    .path
    .clone();

    let id = generate_id();
    let (folder_path, file_name) = get_folder_and_file_path(&id, &storage_path);

    fs::create_dir_all(&folder_path)?;
    // write file to disk but abbort if limits where exceeded
    let mut file = File::create(format!("{}/{}", folder_path, file_name))?;
    let mut hasher = Sha256::new();

    let mut bytes_written = 0;
    while let Some(chunk) = req.body_mut().data().await {
        let chunk = chunk?;
        bytes_written += chunk.len() as u64;
        if bytes_written > bytes_left {
            fs::remove_file(&storage_path)?;
            bail!("User storage limit exceeded");
        }
        hasher.write_all(&chunk)?;
        file.write_all(&chunk)?;
    }

    let hash = hex::encode(hasher.finalize());
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    // update db in this "create file transaction"
    let cft = db
        .create_file(FilezFile {
            id: id.clone(),
            mime_type: create_request.mime_type,
            name: create_request.name,
            owner: user.id,
            sha256: hash.clone(),
            storage_name: storage_name.clone(),
            size: bytes_written,
            created_at: current_time,
        })
        .await;

    if cft.is_err() {
        fs::remove_file(&storage_path)?;
        bail!("Failed to create file in database");
    } else {
        let cfr = CreateFileResponse {
            id,
            storage_name,
            sha256: hash,
        };
        Ok(Response::builder()
            .status(200)
            .body(Body::from(serde_json::to_string(&cfr)?))?)
    }
}
