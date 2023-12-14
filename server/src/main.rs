use filez::config::SERVER_CONFIG;
use filez::db::DB;
use filez::dev::{check_database_consistency, dev};
use filez::internal_types::Auth;
use filez::interossea::{get_session_cookie, Interossea, UserAssertion, INTEROSSEA};
use filez::methods::file::create::create_file;
use filez::methods::file::delete::delete_file;
use filez::methods::file::get::get_file;
use filez::methods::file::info::get::get_file_infos;
use filez::methods::file::info::list::get_file_infos_by_group_id;
use filez::methods::file::info::update::update_file_infos;
use filez::methods::file::update::update_file;
use filez::methods::file_group::create::create_file_group;
use filez::methods::file_group::delete::delete_file_group;
use filez::methods::file_group::get::get_file_groups;
use filez::methods::file_group::list::get_own_file_groups;
use filez::methods::file_group::update::update_file_group;
use filez::methods::get_aggregated_keywords::get_aggregated_keywords;
use filez::methods::permission::delete::delete_permission;
use filez::methods::permission::list::get_own_permissions;
use filez::methods::permission::update::update_permission;
use filez::methods::set_app_data::set_app_data;
use filez::methods::update_permission_ids_on_resource::update_permission_ids_on_resource;
use filez::methods::user::create_own::create_own_user;
use filez::methods::user::get_own::get_own_user;
use filez::methods::user::list::get_user_list;
use filez::methods::user::update_friendship_status::update_friendship_status;
use filez::methods::user_group::create::create_user_group;
use filez::methods::user_group::delete::delete_user_group;
use filez::methods::user_group::list::get_user_group_list;
use filez::methods::user_group::update::update_user_group;
use filez::readonly_mount::scan_readonly_mounts;
use filez::utils::{get_password_from_query, is_allowed_origin, update_default_user_limits};
use hyper::server::conn::AddrStream;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Method, Request, Response, Server};
use mongodb::options::ClientOptions;
use std::collections::HashMap;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

// TODO recalculate dynamic groups on restart to heal eventual inconsistencies caused by crashes

#[tokio::main]
pub async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // reference variables declared with lazy_static because they are initialized on first access
    let _ = &SERVER_CONFIG.db;
    let config = &SERVER_CONFIG;
    let session_map = Arc::new(RwLock::new(HashMap::<String, UserAssertion>::new()));

    if !config.dev.insecure_skip_interossea {
        match INTEROSSEA.set(Interossea::new(&config.interossea).await?) {
            Ok(_) => {}
            Err(_) => {
                panic!("Failed to initialize interossea");
            }
        };
    }

    let internal_http_addr: SocketAddr = SERVER_CONFIG.http.internal_address.parse().unwrap();

    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;

    db.create_collections().await?;

    // this may happen when a new storage option is added to the config
    update_default_user_limits(&db).await?;

    let _ = dev(&db).await;

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

    let server =
        Server::bind(&internal_http_addr).serve(make_service_fn(move |conn: &AddrStream| {
            let addr = conn.remote_addr();
            let session_map = Arc::clone(&session_map);
            async move {
                Ok::<_, Infallible>(service_fn(move |req| {
                    handle_request(req, addr, Arc::clone(&session_map))
                }))
            }
        }));

    println!("Listening on http://{}", internal_http_addr);

    server.with_graceful_shutdown(shutdown_signal()).await?;

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
    session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
) -> Result<Response<Body>, Infallible> {
    match handle_inner(req, addr, session_map).await {
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

async fn handle_inner(
    req: Request<Body>,
    addr: SocketAddr,
    session_map: Arc<RwLock<HashMap<String, UserAssertion>>>,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let db = DB::new(ClientOptions::parse(&config.db.url).await?).await?;

    let mut p = req.uri().path();
    if p.starts_with("/api") {
        p = &p[4..];
    } else {
        return Ok(Response::builder()
            .status(404)
            .body(Body::from("Method not found"))
            .unwrap());
    }
    let m = req.method();

    let res = match req.headers().get("origin") {
        Some(origin) => {
            let origin_str = origin.to_str()?;
            if is_allowed_origin(origin_str).is_ok() {
                Response::builder()
                    .header("Access-Control-Allow-Origin", origin_str)
                    .header("Access-Control-Allow-Credentials", "true")
                    .header(
                        "Access-Control-Allow-Headers",
                        "interosseauserassertion, request, content-type",
                    )
            } else {
                Response::builder()
            }
        }
        None => Response::builder(),
    };

    if p.starts_with("/get_session_cookie/") && m == Method::POST {
        return get_session_cookie(&req, session_map, addr, res).await;
    }

    let user_assertion = match config.dev.insecure_skip_interossea {
        true => Some(UserAssertion {
            iat: 0,
            exp: 0,
            user_id: "dev".to_string(),
            service_id: "filez".to_string(),
            client_ip: "127.0.0.1".to_string(),
            service_origin: "localhost".to_string(),
            ir_admin: true,
            ir_email: "mail@example.com".to_string(),
        }),
        false => {
            match INTEROSSEA
                .get()
                .unwrap()
                .get_user_assertion_from_session(&req, addr, session_map)
                .await
            {
                Ok(v) => Some(v),
                Err(_) => None,
            }
        }
    };

    let auth = Auth {
        authenticated_ir_user_id: user_assertion.as_ref().map(|ua| ua.user_id.clone()),
        password: get_password_from_query(&req),
        user_assertion,
    };

    let mut data_mutating = false;

    //dbg!(p, m, &auth);
    /* file */
    let final_res = if p.starts_with("/file/get/") && m == Method::GET {
        get_file(req, &db, &auth, res).await
    } else if p == "/file/create/" && m == Method::POST {
        data_mutating = true;
        create_file(req, &db, &auth, res).await
    } else if p == "/file/delete/" && m == Method::POST {
        data_mutating = true;
        delete_file(req, &db, &auth, res).await
    } else if p == "/file/update/" && m == Method::POST {
        data_mutating = true;
        update_file(req, &db, &auth, res).await
    }
    /* file info */
    else if p.starts_with("/file/info/get/") && m == Method::POST {
        get_file_infos(req, &db, &auth, res).await
    } else if p == "/file/info/update/" && m == Method::POST {
        data_mutating = true;
        update_file_infos(req, &db, &auth, res).await
    } else if p.starts_with("/file/info/list/") && m == Method::POST {
        get_file_infos_by_group_id(req, &db, &auth, res).await
    }
    /* file group */
    else if p == "/file_group/create/" && m == Method::POST {
        data_mutating = true;
        create_file_group(req, &db, &auth, res).await
    } else if p == "/file_group/delete/" && m == Method::POST {
        data_mutating = true;
        delete_file_group(req, &db, &auth, res).await
    } else if p == "/file_group/update/" && m == Method::POST {
        data_mutating = true;
        update_file_group(req, &db, &auth, res).await
    } else if p == "/file_group/get/" && m == Method::POST {
        get_file_groups(req, &db, &auth, res).await
    } else if p == "/file_group/list/" && m == Method::POST {
        get_own_file_groups(req, &db, &auth, res).await
    }
    /* user group */
    else if p == "/user_group/create/" && m == Method::POST {
        data_mutating = true;
        create_user_group(req, &db, &auth, res).await
    } else if p == "/user_group/delete/" && m == Method::POST {
        data_mutating = true;
        delete_user_group(req, &db, &auth, res).await
    } else if p == "/user_group/update/" && m == Method::POST {
        data_mutating = true;
        update_user_group(req, &db, &auth, res).await
    } else if p == "/user_group/list/" && m == Method::POST {
        get_user_group_list(req, &db, &auth, res).await
    }
    /* permissions */
    else if p == "/permission/update/" && m == Method::POST {
        data_mutating = true;
        update_permission(req, &db, &auth, res).await
    } else if p == "/permission/delete/" && m == Method::POST {
        data_mutating = true;
        delete_permission(req, &db, &auth, res).await
    } else if p == "/permission/list/" && m == Method::POST {
        get_own_permissions(req, &db, &auth, res).await
    }
    /* user */
    else if p.starts_with("/user/get_own/") && m == Method::GET {
        get_own_user(req, &db, &auth, res).await
    } else if p == "/user/create_own/" && m == Method::POST {
        data_mutating = true;
        create_own_user(req, &db, &auth, res).await
    } else if p == "/user/update_friendship_status/" && m == Method::POST {
        data_mutating = true;
        update_friendship_status(req, &db, &auth, res).await
    } else if p == "/user/list/" && m == Method::POST {
        get_user_list(req, &db, &auth, res).await
    }
    /* misc */
    else if p == "/update_permission_ids_on_resource/" && m == Method::POST {
        data_mutating = true;
        update_permission_ids_on_resource(req, &db, &auth, res).await
    } else if p == "/get_aggregated_keywords/" && m == Method::GET {
        get_aggregated_keywords(req, &db, &auth, res).await
    } else if p == "/set_app_data/" && m == Method::POST {
        data_mutating = true;
        set_app_data(req, &db, &auth, res).await
    }
    /* interossea accounts management */
    else if p == "/get_assertion_validity_seconds/" && m == Method::GET {
        Ok(res
            .status(200)
            .body(Body::from(
                config.interossea.assertion_validity_seconds.to_string(),
            ))
            .unwrap())
    }
    /* cors */
    else if m == Method::OPTIONS {
        Ok(res.status(200).body(Body::from("Ok")).unwrap())
    }
    /* everything else */
    else {
        Ok(res
            .status(404)
            .body(Body::from("Method not found"))
            .unwrap())
    };

    if config.dev.check_database_consistency_on_mutating_requests && data_mutating {
        tokio::spawn(async move {
            match check_database_consistency(&db).await {
                Ok(_) => println!("Database consistency check passed: Everything is fine!"),
                Err(e) => println!("Database consistency check failed: {}", e),
            }
        });
    }
    final_res
}
