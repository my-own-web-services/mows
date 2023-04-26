use http_body_util::Full;
use hyper::body::Bytes;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response};
use muzik::config::SERVER_CONFIG;
use std::convert::Infallible;
use std::fs;
use std::net::SocketAddr;
use std::path::Path;
use tokio::net::TcpListener;

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = &SERVER_CONFIG.db;
    let config = &SERVER_CONFIG;

    fs::create_dir_all(&config.spotify.storage_path)?;

    match get_saved_refresh_token(&config.spotify.storage_path).await {
        Ok(token) => {
            println!("Found refresh token");
        }
        Err(err) => {
            println!("Error reading refresh token: {}", err);
            println!("Starting server, please authenticate with spotify");
            create_server().await?;
        }
    };

    Ok(())
}

async fn create_server() -> anyhow::Result<()> {
    let addr: SocketAddr = SERVER_CONFIG.http.internal_address.parse()?;

    let listener = TcpListener::bind(addr).await?;

    // We start a loop to continuously accept incoming connections
    loop {
        let (stream, _) = listener.accept().await?;

        // Spawn a tokio task to serve multiple connections concurrently
        tokio::task::spawn(async move {
            // Finally, we bind the incoming connection to our `hello` service
            if let Err(err) = http1::Builder::new()
                // `service_fn` converts our function in a `Service`
                .serve_connection(stream, service_fn(hello))
                .await
            {
                println!("Error serving connection: {:?}", err);
            }
        });
    }
}

async fn hello(_: Request<hyper::body::Incoming>) -> Result<Response<Full<Bytes>>, Infallible> {
    Ok(Response::new(Full::new(Bytes::from("Hello, World!"))))
}

async fn get_saved_refresh_token(folder_path: &str) -> anyhow::Result<String> {
    let path = Path::new(folder_path).join("refresh_token");
    let token = fs::read_to_string(path)?;
    Ok(token)
}
