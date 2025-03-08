#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

mod doh;

use std::io::Write;
use std::net::Ipv6Addr;
use std::time::Duration;

use futures_util::StreamExt;
use hickory_server::server::TimeoutStream;
use log::{error, warn};
use pektin_common::deadpool_redis::{self, Pool};
use pektin_common::load_env;
use pektin_common::proto::iocompat::AsyncIoTokioAsStd;
use pektin_common::proto::op::Message;
use pektin_common::proto::tcp::TcpStream;
use pektin_common::proto::udp::UdpStream;
use pektin_common::proto::xfer::{BufDnsStreamHandle, SerialMessage};
use pektin_common::proto::DnsStreamHandle;
use pektin_server::{process_request, PektinResult};
use tokio::net::{TcpListener, UdpSocket};
use tokio::signal::unix::{signal, SignalKind};

#[derive(Debug, Clone, PartialEq, Eq)]
struct Config {
    pub bind_address: Ipv6Addr,
    pub bind_port: u16,
    pub db_hostname: String,
    pub db_username: String,
    pub db_password: String,
    pub db_port: u16,
    pub db_retry_seconds: u64,
    pub tcp_timeout_seconds: u64,
    pub use_doh: bool,
    pub doh_bind_address: Ipv6Addr,
    pub doh_bind_port: u16,
}

impl Config {
    pub fn from_env() -> PektinResult<Self> {
        Ok(Self {
            bind_address: load_env("::", "BIND_ADDRESS", false)?
                .parse()
                .map_err(|_| {
                    pektin_common::PektinCommonError::InvalidEnvVar("BIND_ADDRESS".into())
                })?,
            bind_port: load_env("53", "BIND_PORT", false)?
                .parse()
                .map_err(|_| pektin_common::PektinCommonError::InvalidEnvVar("BIND_PORT".into()))?,
            db_hostname: load_env("pektin-db", "DB_HOSTNAME", false)?,
            db_port: load_env("6379", "DB_PORT", false)?
                .parse()
                .map_err(|_| pektin_common::PektinCommonError::InvalidEnvVar("DB_PORT".into()))?,
            db_username: load_env("db-pektin-server", "DB_USERNAME", false)?,
            db_password: load_env("", "DB_PASSWORD", true)?,
            db_retry_seconds: load_env("1", "DB_RETRY_SECONDS", false)?
                .parse()
                .map_err(|_| {
                    pektin_common::PektinCommonError::InvalidEnvVar("DB_RETRY_SECONDS".into())
                })?,
            tcp_timeout_seconds: load_env("3", "TCP_TIMEOUT_SECONDS", false)?
                .parse()
                .map_err(|_| {
                    pektin_common::PektinCommonError::InvalidEnvVar("TCP_TIMEOUT_SECONDS".into())
                })?,
            use_doh: load_env("true", "USE_DOH", false)? == "true",
            doh_bind_port: load_env("80", "DOH_BIND_PORT", false)?
                .parse()
                .map_err(|_| {
                    pektin_common::PektinCommonError::InvalidEnvVar("DOH_BIND_PORT".into())
                })?,
            doh_bind_address: load_env("::", "DOH_BIND_ADDRESS", false)?
                .parse()
                .map_err(|_| {
                    pektin_common::PektinCommonError::InvalidEnvVar("DOH_BIND_ADDRESS".into())
                })?,
        })
    }
}

#[tokio::main]
async fn main() -> PektinResult<()> {
    env_logger::builder()
        .format(|buf, record| {
            let ts = chrono::Local::now().format("%d.%m.%y %H:%M:%S");
            writeln!(
                buf,
                "[{} {} {}]\n{}\n",
                ts,
                record.level(),
                record.target(),
                record.args()
            )
        })
        .init();

    println!("Started Pektin with these globals:");
    let config = Config::from_env()?;

    let db_pool_conf = deadpool_redis::Config {
        url: Some(format!(
            "redis://{}:{}@{}:{}/0",
            config.db_username, config.db_password, config.db_hostname, config.db_port
        )),
        connection: None,
        pool: None,
    };
    let db_pool = db_pool_conf.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

    let db_pool_dnssec_conf = deadpool_redis::Config {
        url: Some(format!(
            "redis://{}:{}@{}:{}/1",
            config.db_username, config.db_password, config.db_hostname, config.db_port
        )),
        connection: None,
        pool: None,
    };
    let db_pool_dnssec = db_pool_dnssec_conf.create_pool(Some(deadpool_redis::Runtime::Tokio1))?;

    let doh_db_pool = db_pool.clone();
    let doh_db_pool_dnssec = db_pool_dnssec.clone();
    let doh_server = if config.use_doh {
        match doh::use_doh(
            config.doh_bind_address,
            config.doh_bind_port,
            doh_db_pool,
            doh_db_pool_dnssec,
        )
        .await
        {
            Ok(server) => Some(server),
            Err(e) => {
                error!("Error while trying to start DOH server: {}", e);
                None
            }
        }
    } else {
        None
    };

    let udp_db_pool = db_pool.clone();
    let udp_db_pool_dnssec = db_pool_dnssec.clone();
    let udp_socket =
        UdpSocket::bind(format!("[{}]:{}", &config.bind_address, config.bind_port)).await?;
    let udp_join_handle = tokio::spawn(async move {
        message_loop_udp(udp_socket, udp_db_pool, udp_db_pool_dnssec).await;
    });

    let tcp_db_pool = db_pool.clone();
    let tcp_db_pool_dnssec = db_pool_dnssec.clone();
    let tcp_listener =
        TcpListener::bind(format!("[{}]:{}", &config.bind_address, config.bind_port)).await?;
    let tcp_join_handle = tokio::spawn(async move {
        message_loop_tcp(tcp_listener, tcp_db_pool, tcp_db_pool_dnssec).await;
    });

    // shutdown if we receive a SIGINT (Ctrl+C) or SIGTERM (sent by docker on shutdown)
    let mut sigint = signal(SignalKind::interrupt())?;
    let mut sigterm = signal(SignalKind::terminate())?;
    match doh_server {
        Some(server) => {
            tokio::select! {
                _ = udp_join_handle => Ok(()),
                _ = tcp_join_handle => Ok(()),
                res = server => res.map_err(Into::into),
                _ = sigint.recv() => Ok(()),
                _ = sigterm.recv() => Ok(()),
            }
        }
        None => {
            tokio::select! {
                _ = udp_join_handle => (),
                _ = tcp_join_handle => (),
                _ = sigint.recv() => (),
                _ = sigterm.recv() => (),
            };
            Ok(())
        }
    }
}

async fn message_loop_udp(socket: UdpSocket, db_pool: Pool, db_pool_dnssec: Pool) {
    // see trust_dns_server::server::ServerFuture::register_socket
    let (mut udp_stream, udp_handle) =
        UdpStream::with_bound(socket, ([127, 255, 255, 254], 0).into());
    while let Some(message) = udp_stream.next().await {
        let message = match message {
            Ok(m) => m,
            Err(e) => {
                warn!("Error receiving UDP message: {}", e);
                continue;
            }
        };

        let src_addr = message.addr();
        let udp_handle = udp_handle.with_remote_addr(src_addr);
        let req_db_pool = db_pool.clone();
        let req_db_pool_dnssec = db_pool_dnssec.clone();
        tokio::spawn(async move {
            handle_request_udp_tcp(message, udp_handle, req_db_pool, req_db_pool_dnssec).await;
        });
    }
}

async fn message_loop_tcp(listener: TcpListener, db_pool: Pool, db_pool_dnssec: Pool) {
    // see trust_dns_server::server::ServerFuture::register_listener
    loop {
        let tcp_stream = match listener.accept().await {
            Ok((t, _)) => t,
            Err(e) => {
                warn!("Error creating a new TCP stream: {}", e);
                continue;
            }
        };

        let req_db_pool = db_pool.clone();
        let req_db_pool_dnssec = db_pool_dnssec.clone();
        tokio::spawn(async move {
            let src_addr = match tcp_stream.peer_addr() {
                Ok(addr) => addr,
                Err(e) => {
                    warn!("Could not get peer address for TCP stream: {}", e);
                    return;
                }
            };

            let (tcp_stream, tcp_handle) =
                TcpStream::from_stream(AsyncIoTokioAsStd(tcp_stream), src_addr);
            // TODO maybe make this configurable via environment variable?
            let mut timeout_stream = TimeoutStream::new(tcp_stream, Duration::from_secs(3));

            while let Some(message) = timeout_stream.next().await {
                let message = match message {
                    Ok(m) => m,
                    Err(e) => {
                        warn!("Error receiving TCP message: {}", e);
                        return;
                    }
                };

                handle_request_udp_tcp(
                    message,
                    tcp_handle.clone(),
                    req_db_pool.clone(),
                    req_db_pool_dnssec.clone(),
                )
                .await;
            }
        });
    }
}

async fn handle_request_udp_tcp(
    msg: SerialMessage,
    stream_handle: BufDnsStreamHandle,
    db_pool: Pool,
    db_pool_dnssec: Pool,
) {
    let message = match msg.to_message() {
        Ok(m) => m,
        _ => {
            warn!("Could not deserialize received message");
            return;
        }
    };
    let response = process_request(message, db_pool, db_pool_dnssec).await;
    send_response(msg, response, stream_handle)
}

fn send_response(query: SerialMessage, response: Message, mut stream_handle: BufDnsStreamHandle) {
    let response_bytes = match response.to_vec() {
        Ok(b) => b,
        Err(e) => {
            error!("Could not serialize response: {}", e);
            return;
        }
    };
    let serialized_response = SerialMessage::new(response_bytes, query.addr());
    if let Err(e) = stream_handle.send(serialized_response) {
        warn!("Could not send response: {}", e);
    }
}
