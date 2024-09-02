use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(CustomResource, Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[kube(
    group = "mows.cloud",
    version = "v1",
    kind = "PublicIpConnection",
    plural = "public ip connections",
    derive = "PartialEq",
    namespaced
)]
pub enum PublicIpConnectionSpec {
    MachineProxy(PublicIpConnectionVmProxy),
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct PublicIpConnectionVmProxy {
    pub public_ip_id: String,
    pub destination_service: String,
    pub port_mapping: Option<Vec<ServicePort>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, JsonSchema)]

pub struct ServicePort {
    pub protocol: Protocol,
    pub source_port: u16,
    pub destination_port: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub enum Protocol {
    #[serde(rename = "TCP")]
    Tcp,
    #[serde(rename = "UDP")]
    Udp,
}
