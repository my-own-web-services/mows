use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};

use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(CustomResource, Serialize, Deserialize, Debug, PartialEq, Clone, JsonSchema)]
#[kube(
    group = "mows.cloud",
    version = "v1",
    kind = "PublicIP",
    plural = "public ips",
    derive = "PartialEq",
    namespaced
)]
pub enum PublicIPSpec {
    MachineProxy(PublicIpVmProxy),
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, JsonSchema)]
pub struct PublicIpVmProxy {
    pub remote_wg_public_key: String,
    pub local_wg_private_key: String,
    pub remote_address: IpAddr,
    pub remote_port: u16,
}
