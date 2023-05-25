use hyper::server::conn::AddrStream;
use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Request, Response, Server};
use muzik::config::SERVER_CONFIG;
use muzik::utils::{generate_id, get_saved_refresh_token, get_spotify_auth_url};
use reqwest::Url;
use std::collections::HashMap;
use std::convert::Infallible;
use std::fs;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = &SERVER_CONFIG.db;
    let config = &SERVER_CONFIG;
    let app_state: Arc<RwLock<HashMap<String, String>>> = Arc::new(RwLock::new(HashMap::new()));

    fs::create_dir_all(&config.spotify.storage_path)?;

    /*
    match get_saved_refresh_token(&config.spotify.storage_path).await {
        Ok(token) => {
            println!("Found refresh token");
            app_state
                .write()
                .await
                .insert("refresh_token".to_string(), token.to_owned());
        }
        Err(err) => {
            println!("Error reading refresh token: {}", err);
        }
    };
    */

    println!("Starting server, please authenticate with spotify");
    let start_auth_url = Url::parse(&config.spotify.redirect_uri)?.join("/spotify/start_auth")?;
    let server = create_server(&app_state);

    let background = tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60 * 60 * 24));
        loop {
            interval.tick().await;
            // try to read a saved refresh token
        }
    });

    let _ = tokio::join!(server, background);

    println!("Navigate to: {}", start_auth_url);

    Ok(())
}

async fn create_server(app_state: &Arc<RwLock<HashMap<String, String>>>) -> anyhow::Result<()> {
    let addr: SocketAddr = SERVER_CONFIG.http.internal_address.parse()?;

    let server = Server::bind(&addr).serve(make_service_fn(move |conn: &AddrStream| {
        let app_state = Arc::clone(app_state);

        async move {
            Ok::<_, Infallible>(service_fn(move |req| {
                //dbg!(&req);

                handle(req, Arc::clone(&app_state))
            }))
        }
    }));

    // Run this server for... forever!
    if let Err(e) = server.await {
        eprintln!("server error: {}", e);
    }
    Ok(())
}

async fn handle(
    req: Request<Body>,
    app_state: Arc<RwLock<HashMap<String, String>>>,
) -> Result<Response<Body>, Infallible> {
    match handle_inner(req, app_state).await {
        Ok(v) => Ok(v),
        Err(e) => {
            println!("Error handling request: {}", e);
            let mut resp = Response::default();
            *resp.status_mut() = hyper::StatusCode::INTERNAL_SERVER_ERROR;
            Ok(resp)
        }
    }
}

async fn handle_inner(
    req: Request<Body>,
    app_state: Arc<RwLock<HashMap<String, String>>>,
) -> anyhow::Result<Response<Body>> {
    let state = generate_id();

    if req.method() == hyper::Method::GET && req.uri().path() == "/spotify/start_auth" {
        let spotify_auth_url = get_spotify_auth_url(&state).await?;
        let mut resp = Response::default();
        *resp.status_mut() = hyper::StatusCode::FOUND;
        resp.headers_mut().insert(
            hyper::header::LOCATION,
            hyper::header::HeaderValue::from_str(&spotify_auth_url)?,
        );
        Ok(resp)
    } else if req.method() == hyper::Method::GET && req.uri().path() == "/spotify/finish_auth" {
        let code = req.uri().query().unwrap().split('=').nth(1).unwrap();
        app_state
            .write()
            .await
            .insert("auth_code".to_string(), code.to_owned());

        let mut resp = Response::default();
        *resp.status_mut() = hyper::StatusCode::OK;
        Ok(resp)
    } else {
        // Return a 404 not found response.
        let mut resp = Response::default();
        *resp.status_mut() = hyper::StatusCode::NOT_FOUND;
        Ok(resp)
    }
}
