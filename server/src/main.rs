use filez::config::SERVER_CONFIG;
use filez::db::DB;
use filez::internal_types::Auth;
use filez::interossea::{Interossea, UserAssertion, INTEROSSEA};
use filez::methods::create_file::create_file;
use filez::methods::create_group::create_group;
use filez::methods::create_permission::create_permission;
use filez::methods::delete_file::delete_file;
use filez::methods::delete_group::delete_group;
use filez::methods::delete_permission::delete_permission;
use filez::methods::get_file::get_file;
use filez::methods::get_file_info::get_file_info;
use filez::methods::get_file_infos_by_group_id::get_file_infos_by_group_id;
use filez::methods::get_own_file_groups::get_own_file_groups;
use filez::methods::get_permissions_for_current_user::get_permissions_for_current_user;
use filez::methods::get_user_info::get_user_info;
use filez::methods::set_app_data::set_app_data;
use filez::methods::update_file::update_file;
use filez::methods::update_permission_ids_on_resource::update_permission_ids_on_resource;
use filez::readonly_mount::scan_readonly_mounts;
use filez::utils::get_token_from_query;
use hyper::server::conn::AddrStream;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server};
use mongodb::options::ClientOptions;
use std::convert::Infallible;
use std::net::SocketAddr;
use tokio::signal;

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // reference variables declared with lazy_static because they are initialized on first access
    let _ = &SERVER_CONFIG.variable_prefix;
    let config = &SERVER_CONFIG;

    if !config.dev.insecure_skip_interossea {
        match INTEROSSEA.set(Interossea::new(&config.interossea).await?) {
            Ok(_) => {}
            Err(_) => {
                panic!("Failed to initialize interossea");
            }
        };
    }

    let addr: SocketAddr = SERVER_CONFIG.http.internal_address.parse().unwrap();

    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;

    db.create_collections().await?;

    if config.dev.create_dev_user {
        db.create_dev_user().await?;
    }

    tokio::spawn(async move {
        println!("Scanning readonly mounts...");
        match scan_readonly_mounts(&db).await {
            Ok(_) => {
                println!("Done scanning readonly mounts");
            }
            Err(e) => {
                println!("Failed to scan readonly mounts: {}", e);
            }
        };
    });

    let server = Server::bind(&addr).serve(make_service_fn(move |conn: &AddrStream| {
        let addr = conn.remote_addr();
        async move { Ok::<_, Infallible>(service_fn(move |req| handle_request(req, addr))) }
    }));

    server.with_graceful_shutdown(shutdown_signal()).await?;

    println!("Listening on http://{}", addr);

    match signal::ctrl_c().await {
        Ok(()) => {}
        Err(err) => {
            eprintln!("Unable to listen for shutdown signal: {}", err);
            // we also shut down in case of error
        }
    }

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
}

async fn handle_request(
    req: Request<Body>,
    addr: SocketAddr,
) -> Result<Response<Body>, Infallible> {
    match handle_inner(req, addr).await {
        Ok(res) => Ok(res),
        Err(e) => {
            println!("Internal Server Error: {}", e);
            Ok(Response::builder()
                .status(500)
                .body(Body::from(format!("Internal Server Error: {e}")))
                .unwrap())
        }
    }
}

async fn handle_inner(req: Request<Body>, addr: SocketAddr) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;

    let user_assertion = match config.dev.insecure_skip_interossea {
        true => Some(UserAssertion {
            iat: 0,
            exp: 0,
            user_id: "dev".to_string(),
            service_id: "filez".to_string(),
            client_ip: "127.0.0.1".to_string(),
            service_origin: "localhost".to_string(),
        }),
        false => match INTEROSSEA
            .get()
            .unwrap()
            .check_user_assertion(&req, addr)
            .await
        {
            Ok(ua) => Some(ua),
            Err(e) => {
                dbg!(&e);
                None
            }
        },
    };

    let auth = Auth {
        authenticated_user: user_assertion.map(|ua| ua.user_id),
        token: get_token_from_query(&req),
    };

    let mut p = req.uri().path();
    if p.starts_with("/api") {
        p = &p[4..];
    } else {
        return Ok(Response::builder()
            .status(404)
            .body(Body::from("Not found"))
            .unwrap());
    }
    let m = req.method();

    if p.starts_with("/get_file/") && m == Method::GET {
        get_file(req, db, &auth).await
    } else if p == "/create_file/" && m == Method::POST {
        create_file(req, db, &auth).await
    } else if p.starts_with("/delete_file/") && m == Method::POST {
        delete_file(req, db, &auth).await
    } else if p.starts_with("/get_file_info/") && m == Method::GET {
        get_file_info(req, db, &auth).await
    } else if p.starts_with("/get_file_infos_by_group_id/") && m == Method::GET {
        get_file_infos_by_group_id(req, db, &auth).await
    } else if p == "/set_app_data/" && m == Method::POST {
        set_app_data(req, db, &auth).await
    } else if p.starts_with("/get_user_info/") && m == Method::GET {
        get_user_info(req, db, &auth).await
    } else if p == "/update_file/" && m == Method::POST {
        update_file(req, db, &auth).await
    } else if p == "/create_group/" && m == Method::POST {
        create_group(req, db, &auth).await
    } else if p == "/create_permission/" && m == Method::POST {
        create_permission(req, db, &auth).await
    } else if p == "/delete_group/" && m == Method::POST {
        delete_group(req, db, &auth).await
    } else if p == "/delete_permission/" && m == Method::POST {
        delete_permission(req, db, &auth).await
    } else if p == "/update_permission_ids_on_resource/" && m == Method::POST {
        update_permission_ids_on_resource(req, db, &auth).await
    } else if p == "/get_permissions_for_current_user/" && m == Method::GET {
        get_permissions_for_current_user(req, db, &auth).await
    } else if p == "/get_own_file_groups/" && m == Method::GET {
        get_own_file_groups(req, db, &auth).await
    } else if p == "/get_assertion_validity_seconds/" && m == Method::GET {
        Ok(Response::builder()
            .status(200)
            .body(Body::from(
                config.interossea.assertion_validity_seconds.to_string(),
            ))
            .unwrap())
    } else {
        Ok(Response::builder()
            .status(404)
            .body(Body::from("Not found"))
            .unwrap())
    }
}
