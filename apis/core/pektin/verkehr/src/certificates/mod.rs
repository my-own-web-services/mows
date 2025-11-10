mod handlers {
    pub mod zertificat;
}

use crate::{
    config::routing_config::{CertResolverConfig, RoutingConfig},
    some_or_bail,
    utils::de_absolute_name,
};
use handlers::zertificat::{
    get_certificates, get_zertificat_consumer_auth, get_zertificate, list_kv, login_userpass,
    VaultCertInfo,
};
use anyhow::bail;
use rustls::{
    server::{ClientHello, ResolvesServerCert},
    sign::CertifiedKey,
};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

#[derive(Debug)]
pub struct CertResolver {
    certificates: HashMap<String, (Arc<CertifiedKey>, VaultCertInfo)>,
    default: String,
}

impl CertResolver {
    pub async fn new(cert_resolver_config: &CertResolverConfig) -> anyhow::Result<Self> {
        let certificates = match &cert_resolver_config.resolver_type {
            Some(c) => {
                if c == "zertificat" {
                    get_certificates().await?
                } else {
                    bail!("Unknown cert resolver: {}", c);
                }
            }
            None => bail!("No cert resolver found in config"),
        };
        let default_domain = de_absolute_name(some_or_bail!(
            &cert_resolver_config.fallback_domain,
            "Fallback domain not found in cert resolver config"
        ));

        Ok(Self {
            certificates,
            default: default_domain,
        })
    }

    pub async fn update(&mut self) -> anyhow::Result<()> {
        let zertificat_auth = get_zertificat_consumer_auth()?;
        let token = login_userpass(
            &zertificat_auth.vault_url,
            &zertificat_auth.username,
            &zertificat_auth.password,
        )
        .await?;

        let list = list_kv(&zertificat_auth.vault_url, &token, "pektin-zertificat").await?;

        for domain in list {
            let cert = get_zertificate(&zertificat_auth.vault_url, &token, &domain).await?;
            self.certificates.insert(domain, cert);
        }
        Ok(())
    }
}

impl ResolvesServerCert for CertResolver {
    fn resolve(&self, client_hello: ClientHello) -> Option<Arc<CertifiedKey>> {
        let name = client_hello
            .server_name()
            .unwrap_or(&self.default)
            .to_string();
        let cert = self.certificates.get(&name);

        cert.map(|c| c.0.clone())
    }
}

pub async fn get_http_cert_resolver(
    config: &Arc<RwLock<RoutingConfig>>,
    entrypoint_name: &str,
) -> anyhow::Result<Arc<CertResolver>> {
    let config = config.read().await;
    let http_config = some_or_bail!(&config.http, "Could not find http config for entrypoint");
    let entrypoints = some_or_bail!(
        &http_config.entrypoints,
        "Could not find entrypoints in http config"
    );
    let entrypoint = some_or_bail!(
        entrypoints.get(entrypoint_name),
        "Could not find entrypoint config"
    );
    let cert_resolver_config = some_or_bail!(&entrypoint.cert_resolver, "TLS config not found");

    Ok(Arc::new(
        match CertResolver::new(cert_resolver_config).await {
            Ok(cr) => cr,
            Err(e) => bail!("Could not create certificate resolver: {}", e),
        },
    ))
}
