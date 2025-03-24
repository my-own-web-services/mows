use serde::{Deserialize, Serialize};

use crate::s;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MowsConstants {
    pub core_components: CoreComponents,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CoreComponents {
    pub public_ip: CoreComponentPublicIp,
    pub ingress: CoreComponentIngress,
    pub dns: CoreComponentDns,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CoreComponentDns {
    pub namespace: String,
    pub server_full_service_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CoreComponentIngress {
    pub namespace: String,
    pub full_service_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CoreComponentPublicIp {
    pub namespace: String,
    pub pod_name: String,
    pub wg_secret_name: String,
    pub wg_client_image: String,
}

impl MowsConstants {
    pub fn default() -> Self {
        MowsConstants {
            core_components: CoreComponents {
                public_ip: CoreComponentPublicIp {
                    namespace: s!("mows-core-network-public-ip"),
                    pod_name: s!("mows-core-network-public-ip"),
                    wg_secret_name: s!("mows-core-network-public-ip-wg-secret"),
                    wg_client_image: s!("docker.io/firstdorsal/tunnel-cluster-client@sha256:12dd911500341d241e31a5d46d930d8c3d81f367e9f4d55a852c1e09b3b5f7b5"),
                },
                ingress: CoreComponentIngress {
                    namespace: s!("mows-core-network-ingress"),
                    full_service_name: s!("traefik.mows-core-network-ingress"),
                },
                dns: CoreComponentDns {
                    namespace: s!("mows-core-dns-pektin"),
                    server_full_service_name: s!("pektin-server.mows-core-dns-pektin"),
                },
            },
        }
    }
}
