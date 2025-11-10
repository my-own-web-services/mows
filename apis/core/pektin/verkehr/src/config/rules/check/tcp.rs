use std::net::SocketAddr;
use tokio::net::TcpStream;

use crate::config::rules::parse::tcp::{TcpRoutingFunction, TcpRoutingRule};

pub fn check_tcp_rule(
    client_conn: &TcpStream,
    rule: &TcpRoutingRule,
    client_addr: SocketAddr,
) -> anyhow::Result<bool> {
    match rule {
        TcpRoutingRule::Function(function) => check_function(client_conn, client_addr, function),
        TcpRoutingRule::NegatedRule(rule) => {
            check_tcp_rule(client_conn, rule, client_addr).map(|res| !res)
        }
        TcpRoutingRule::Or(rules) => {
            let rules: Result<Vec<_>, _> = rules
                .iter()
                .map(|rule| check_tcp_rule(client_conn, rule, client_addr))
                .collect();
            Ok(rules?.iter().any(|b| *b))
        }
        TcpRoutingRule::And(rules) => {
            let rules: Result<Vec<_>, _> = rules
                .iter()
                .map(|rule| check_tcp_rule(client_conn, rule, client_addr))
                .collect();
            Ok(rules?.iter().all(|b| *b))
        }
    }
}

pub fn check_function(
    _client_conn: &TcpStream,
    client_addr: SocketAddr,
    function: &TcpRoutingFunction,
) -> anyhow::Result<bool> {
    let client_ip = client_addr.ip();
    Ok(match function {
        TcpRoutingFunction::HostSNI { hosts: _ } => {
            todo!()
        }
        TcpRoutingFunction::HostSNIRegexp { hosts: _ } => {
            todo!()
        }
        TcpRoutingFunction::ClientIP { ips } => ips.iter().any(|ip| ip.contains(&client_ip)),
    })
}
