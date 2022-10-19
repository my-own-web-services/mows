use anyhow::bail;

use filez::config::SERVER_CONFIG;
use filez::methods::create_file::create_file;
use filez::methods::delete_file::delete_file;
use filez::methods::get_file::get_file;
use filez::methods::get_file_info::get_file_info;
use filez::methods::get_file_infos_by_group_id::get_file_infos_by_group_id;
use filez::methods::get_user_info::get_user_info;
use filez::methods::set_app_data::set_app_data;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Request, Response, Server};
use std::convert::Infallible;

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
    if req.uri().path().starts_with("/get_file/") {
        get_file(req).await
    } else if req.uri().path().starts_with("/create_file/") {
        create_file(req).await
    } else if req.uri().path().starts_with("/delete_file/") {
        delete_file(req).await
    } else if req.uri().path().starts_with("/get_file_info/") {
        get_file_info(req).await
    } else if req.uri().path().starts_with("/get_file_infos_by_group_id/") {
        get_file_infos_by_group_id(req).await
    } else if req.uri().path().starts_with("/set_app_data/") {
        set_app_data(req).await
    } else if req.uri().path().starts_with("/get_user_info/") {
        get_user_info(req).await
    } else {
        bail!("Invalid path");
    }
}
