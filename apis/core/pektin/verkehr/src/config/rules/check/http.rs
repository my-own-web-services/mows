use http::Request;
use hyper::body::Incoming;
use std::{collections::HashMap, net::SocketAddr};

use crate::{
    routing_config::{HttpRoutingFunction, HttpRoutingRule},
    utils::get_host_from_uri_or_header,
};

pub fn check_http_rule(
    req: &Request<Incoming>,
    rule: &HttpRoutingRule,
    client_addr: SocketAddr,
) -> anyhow::Result<bool> {
    match rule {
        HttpRoutingRule::Function(function) => check_function(req, client_addr, function),
        HttpRoutingRule::NegatedRule(rule) => {
            check_http_rule(req, rule, client_addr).map(|res| !res)
        }
        HttpRoutingRule::Or(rules) => {
            let rules: Result<Vec<_>, _> = rules
                .iter()
                .map(|rule| check_http_rule(req, rule, client_addr))
                .collect();
            Ok(rules?.iter().any(|b| *b))
        }
        HttpRoutingRule::And(rules) => {
            let rules: Result<Vec<_>, _> = rules
                .iter()
                .map(|rule| check_http_rule(req, rule, client_addr))
                .collect();
            Ok(rules?.iter().all(|b| *b))
        }
    }
}

pub fn check_function(
    req: &Request<Incoming>,
    client_addr: SocketAddr,
    function: &HttpRoutingFunction,
) -> anyhow::Result<bool> {
    let client_ip = client_addr.ip();
    Ok(match function {
        HttpRoutingFunction::Headers { key, value } => match req.headers().get(key) {
            None => false,
            Some(header_value) => header_value == value,
        },
        HttpRoutingFunction::HeadersRegexp { key, value } => match req.headers().get(key) {
            None => false,
            Some(header_value) => value.is_match(header_value.to_str()?),
        },
        HttpRoutingFunction::Host { hosts } => match get_host_from_uri_or_header(req) {
            Ok(host) => hosts.iter().any(|h| *h == host),
            Err(_) => false,
        },
        HttpRoutingFunction::HostHeader { hosts } => match get_host_from_uri_or_header(req) {
            Ok(host) => hosts.iter().any(|h| *h == host),
            Err(_) => false,
        },
        HttpRoutingFunction::HostRegexp { hosts } => match get_host_from_uri_or_header(req) {
            Ok(host) => hosts.iter().any(|h| h.is_match(&host)),
            Err(_) => false,
        },
        HttpRoutingFunction::Method { methods } => methods.iter().any(|m| m == req.method()),
        HttpRoutingFunction::Path { paths } => {
            let path = req.uri().path();
            paths.iter().any(|h| {
                if let Some(mat) = h.find(path) {
                    mat.start() == 0 && mat.end() == path.len() // mat.end() is not inclusive
                } else {
                    false
                }
            })
        }
        HttpRoutingFunction::PathPrefix { paths } => {
            let path = req.uri().path();
            paths.iter().any(|h| {
                if let Some(mat) = h.find(path) {
                    mat.start() == 0
                } else {
                    false
                }
            })
        }
        HttpRoutingFunction::Query { kv_pairs } => {
            if let Some(query) = req.uri().query() {
                let query: HashMap<String, String> = serde_urlencoded::from_str(query)?;
                let mut match_found = false;
                for (key, value) in kv_pairs {
                    if query.get(key) == Some(value) {
                        match_found = true;
                    }
                }
                match_found
            } else {
                false
            }
        }
        HttpRoutingFunction::ClientIP { ips } => ips.iter().any(|ip| ip.contains(&client_ip)),
    })
}
