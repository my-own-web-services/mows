use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::config::routing_config::{
    HttpConfig, HttpLoadbalancer, HttpRouter, HttpService, HttpServiceServer, RoutingConfig,
};
use crate::config::rules::parse::http::parse_http_routing_rule;

#[derive(CustomResource, Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[kube(
    kind = "VerkehrResource",
    group = "verkehr.k8s.mows.cloud",
    version = "v1",
    namespaced,
    doc = "Custom kubernetes resource for applying verkehr configurations."
)]
#[kube(status = "VerkehrResourceStatus", shortname = "vr")]
#[serde(rename_all = "camelCase")]
pub enum VerkehrResourceSpec {
    IngressRouteHttp(IngressRouteHttp),
}

#[derive(Deserialize, Serialize, Clone, Default, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]

pub struct VerkehrResourceStatus {
    pub created: bool,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]

pub struct IngressRouteHttp {
    pub entrypoints: Vec<String>,
    pub routes: Vec<IngressRouteHttpRoute>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]

pub struct IngressRouteHttpRoute {
    pub kind: String,
    #[serde(rename = "match")]
    pub match_rule: String,
    pub services: Vec<IngressRouteHttpRouteService>,
}

#[derive(Deserialize, Serialize, Clone, Debug, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngressRouteHttpRouteService {
    pub name: String,
    pub port: u16,
    pub weight: Option<u32>,
}

impl IngressRouteHttp {
    /// Convert the IngressRouteHttp CRD spec to a RoutingConfig
    pub fn to_routing_config(
        &self,
        name: &str,
        namespace: &str,
    ) -> Result<RoutingConfig, String> {
        let mut routers = HashMap::new();
        let mut services = HashMap::new();

        for (route_idx, route) in self.routes.iter().enumerate() {
            let router_name = format!("{}-{}-route-{}", namespace, name, route_idx);
            let service_name = format!("{}-{}-service-{}", namespace, name, route_idx);

            // Parse the routing rule
            let parsed_rule = parse_http_routing_rule(&route.match_rule)
                .map_err(|e| format!("Failed to parse routing rule '{}': {}", route.match_rule, e))?;

            // Create the router
            let router = HttpRouter {
                rule: parsed_rule,
                entrypoints: self.entrypoints.clone(),
                middlewares: None,
                service: service_name.clone(),
                priority: None,
            };
            routers.insert(router_name, router);

            // Create the service with loadbalancer
            let servers: Vec<HttpServiceServer> = route
                .services
                .iter()
                .map(|svc| {
                    // Build the URL from service name and port
                    // In Kubernetes, services in the same namespace can be accessed as http://service-name:port
                    let url = format!("http://{}.{}:{}", svc.name, namespace, svc.port);
                    HttpServiceServer { url }
                })
                .collect();

            let service = HttpService {
                loadbalancer: Some(HttpLoadbalancer {
                    servers,
                    pass_host_header: Some(true),
                }),
            };
            services.insert(service_name, service);
        }

        Ok(RoutingConfig {
            version: Some(1),
            http: Some(HttpConfig {
                entrypoints: None,
                routers: Some(routers),
                middlewares: None,
                services: Some(services),
            }),
            tcp: None,
            udp: None,
        })
    }
}
