use mows_common_rust::get_current_config_cloned;
use mows_common_rust::observability::init_observability;
use pektin_server::config::config;
use pektin_server::errors::PektinServerResult;
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use std::time::Duration;

use futures_util::StreamExt;
use hickory_server::server::TimeoutStream;
use pektin_common::deadpool_redis::{self, Pool};
use pektin_common::proto::iocompat::AsyncIoTokioAsStd;
use pektin_common::proto::op::Message;
use pektin_common::proto::tcp::TcpStream;
use pektin_common::proto::udp::UdpStream;
use pektin_common::proto::xfer::{BufDnsStreamHandle, SerialMessage};
use pektin_common::proto::DnsStreamHandle;
use pektin_server::{doh, process_request};
use tokio::net::{TcpListener, UdpSocket};
use tokio::signal::unix::{signal, SignalKind};
use tracing::{error, instrument, warn};

#[tokio::main]
#[instrument(level = "trace")]
async fn main() -> PektinServerResult<()> {
    init_observability().await;
    let config = get_current_config_cloned!(config());

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

#[instrument(level = "trace")]
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

#[instrument(level = "trace")]
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

#[instrument(level = "trace", skip(msg, stream_handle))]
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
