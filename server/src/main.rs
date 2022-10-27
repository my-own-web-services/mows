use arangors::Connection;
use filez::config::SERVER_CONFIG;
use filez::db::DB;
use filez::methods::create_file::create_file;
use filez::methods::create_group::create_group;
use filez::methods::delete_file::delete_file;
use filez::methods::get_file::get_file;
use filez::methods::get_file_info::get_file_info;
use filez::methods::get_file_infos_by_group_id::get_file_infos_by_group_id;
use filez::methods::get_user_info::get_user_info;
use filez::methods::set_app_data::set_app_data;
use filez::methods::update_file::update_file;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server};
use std::convert::Infallible;
use std::net::SocketAddr;

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // reference variables declared with lazy_static because they are initialized on first access
    let _ = &SERVER_CONFIG.variable_prefix;

    let addr: SocketAddr = "[::]:8080".parse().unwrap();

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
    let db = DB::new(
        Connection::establish_basic_auth("http://localhost:8529", "root", "password").await?,
    )
    .await?;
    let user_id = "test";

    if req.uri().path().starts_with("/get_file/") && req.method() == Method::GET {
        get_file(req, db, user_id).await
    } else if req.uri().path() == "/create_file/" && req.method() == Method::POST {
        create_file(req, db, user_id).await
    } else if req.uri().path().starts_with("/delete_file/") && req.method() == Method::POST {
        delete_file(req, db, user_id).await
    } else if req.uri().path().starts_with("/get_file_info/") && req.method() == Method::GET {
        get_file_info(req, db, user_id).await
    } else if req.uri().path().starts_with("/get_file_infos_by_group_id/")
        && req.method() == Method::GET
    {
        get_file_infos_by_group_id(req, db, user_id).await
    } else if req.uri().path() == "/set_app_data/" && req.method() == Method::POST {
        set_app_data(req, db, user_id).await
    } else if req.uri().path().starts_with("/get_user_info/") && req.method() == Method::GET {
        get_user_info(req, db, user_id).await
    } else if req.uri().path() == "/update_file/" && req.method() == Method::POST {
        update_file(req, db, user_id).await
    } else if req.uri().path() == "/create_group/" && req.method() == Method::POST {
        create_group(req, db, user_id).await
    } else {
        Ok(Response::builder()
            .status(404)
            .body(Body::from("Not found"))
            .unwrap())
    }
}
