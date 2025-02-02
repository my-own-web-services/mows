use anyhow::{bail, Context};
use lib::{
    types::{Identifier, UserChallenges},
    AcmeClient,
};
use mows_common::{
    get_current_config_cloned, observability::init_observability, reqwest::new_reqwest_client,
};
use p256::ecdsa::SigningKey;
use rand_core::OsRng;
use serde::Deserialize;
use serde_json::json;
use std::vec;
use tracing::instrument;
use zertificat::{
    config::config,
    types::{MaybeVaultCert, VaultCert, VaultCertInfo},
    vault::{get_kv_value, update_kv_value, vault_k8s_login},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // TODO: option to send a wake up call to run the procedure

    let config = get_current_config_cloned!(config());
    init_observability().await;

    // daily procedure to see if there is something to do
    loop {
        match run_procedure().await {
            Ok(_) => {
                println!("procedure executed successfully");
            }
            Err(e) => {
                println!("procedure failed:\n{e}");
            }
        };
        std::thread::sleep(std::time::Duration::from_secs(config.wait_minutes * 60));
    }
}

#[instrument]
async fn run_procedure() -> anyhow::Result<()> {
    let config = get_current_config_cloned!(config());
    // get certificate config from vault
    let vault_token = vault_k8s_login(false)
        .await
        .context("failed to login to vault")?
        .client_token;
    let domains = get_pektin_domains()
        .await
        .context("failed to get pektin domains")?;
    let maybe_vault_certificates = get_certificates(&domains, &vault_token)
        .await
        .context("failed to get certificates from vault")?;
    // check certificate presence in vault
    for maybe_cert in maybe_vault_certificates {
        if maybe_cert.cert.is_none() || maybe_cert.key.is_none() || maybe_cert.info.is_none() {
            // generate new certificate
            let cert = generate_certificate(&maybe_cert.domain)
                .await
                .context("failed to generate certificate")?;
            // set cert in vault
            update_kv_value(&config.vault_uri, &vault_token, &cert.domain, &cert)
                .await
                .context("failed to update certificate in vault")?;
        } else {
            let cert = VaultCert {
                cert: maybe_cert.cert.unwrap().to_string(),
                key: maybe_cert.key.unwrap().to_string(),
                info: match serde_json::from_value(maybe_cert.info.unwrap()) {
                    Ok(info) => info,
                    Err(e) => {
                        bail!("failed to deserialize VaultCert info: {}", e);
                    }
                },
                domain: maybe_cert.domain,
            };
            let current_time = chrono::offset::Utc::now().timestamp_millis() / 1000;
            let sixty_days_secs = 60 * 60 * 24 * 60;

            // check if certificate has expired
            if current_time > cert.info.created + sixty_days_secs {
                // generate new certificate
                let cert = generate_certificate(&cert.domain).await.context(format!(
                    "failed to generate certificate for {}",
                    &cert.domain
                ))?;
                // set cert in vault
                update_kv_value(&config.vault_uri, &vault_token, &cert.domain, &cert)
                    .await
                    .context(format!(
                        "failed to update certificate in vault for {}",
                        &cert.domain
                    ))?;
            }
        }
    }

    Ok(())
}

#[instrument]
pub async fn generate_certificate(domain: &str) -> anyhow::Result<VaultCert> {
    println!("generating certificate for {}", domain);
    let config = get_current_config_cloned!(config());
    let communication_signing_key = SigningKey::random(&mut OsRng);

    let acme_url = match config.use_local_pebble {
        true => "http://pektin-pebble:14000/dir",
        false => &config.acme_url,
    };

    let mut client = AcmeClient::new(&acme_url, &communication_signing_key, &config.acme_email)
        .await
        .context(format!(
            "failed to create acme client for domain: {}",
            domain
        ))?;

    let identifiers = vec![
        Identifier {
            value: domain.to_string(),
            ident_type: "dns".to_string(),
        },
        Identifier {
            value: format!("*.{domain}"),
            ident_type: "dns".to_string(),
        },
    ];

    let cert = client
        .create_certificate_with_defaults(&identifiers)
        .context(format!(
            "failed to create certificate for domain: {}",
            domain
        ))?;

    let signed_cert = client
        .sign_certificate(&cert, &identifiers, |user_challenges| {
            handle_challenges_with_pektin(user_challenges)
        })
        .await
        .context(format!(
            "failed to sign certificate for domain with ACME provider: {}",
            domain
        ))?;
    let current_time = chrono::offset::Utc::now().timestamp_millis() / 1000;
    Ok(VaultCert {
        cert: signed_cert,
        key: cert.serialize_private_key_pem(),
        info: VaultCertInfo {
            created: current_time,
        },
        domain: domain.to_string(),
    })
}

#[instrument]
pub async fn handle_challenges_with_pektin(
    user_challenges: UserChallenges,
) -> anyhow::Result<Vec<String>> {
    println!("setting following challenges to pektin");
    println!("{:#?}", user_challenges);

    let vault_token = vault_k8s_login(true).await?.client_token;

    set_pektin_record(&vault_token, &user_challenges).await?;
    let mut fulfilled = Vec::new();
    for challenge in user_challenges.dns {
        fulfilled.push(challenge.url.to_string());
    }
    std::thread::sleep(std::time::Duration::from_secs(10));
    Ok(fulfilled)
}

#[instrument(skip(vault_token))]
async fn set_pektin_record(vault_token: &str, challenge: &UserChallenges) -> anyhow::Result<()> {
    let client = new_reqwest_client().await?;

    let config = get_current_config_cloned!(config());
    let resp = client
        .post(format!("{}/set", config.pektin_api_endpoint))
        //.header("Authorization", &pektin_auth.perimeter_auth)
        .header("content-type", "application/json")
        .body(
            json!({
                "client_username": config.pektin_username,
                "client_token": vault_token,
                "records": [
                    {
                        "name": challenge.dns[0].name,
                        "rr_type": "TXT",
                        "ttl": 60,
                        "rr_set": [
                            {
                                "value": challenge.dns[0].value
                            },
                            {
                                "value": challenge.dns[1].value
                            }
                        ]
                    }
                    ]
            })
            .to_string(),
        )
        .send()
        .await?;

    if !resp.status().is_success() {
        bail!("failed to set pektin record: {}", resp.text().await?);
    }
    Ok(())
}

#[instrument(skip(vault_token))]
async fn get_certificates(
    domains: &Vec<String>,
    vault_token: &str,
) -> anyhow::Result<Vec<MaybeVaultCert>> {
    let mut certificates = vec![];
    for domain in domains {
        match get_kv_value(vault_token, domain).await {
            Ok(cert_res) => {
                let cert = cert_res.get("cert").cloned();
                let key = cert_res.get("key").cloned();
                let info = cert_res.get("info").cloned();
                certificates.push(MaybeVaultCert {
                    cert,
                    key,
                    info,
                    domain: domain.to_string(),
                });
            }
            Err(_) => {
                certificates.push(MaybeVaultCert {
                    cert: None,
                    key: None,
                    info: None,
                    domain: domain.to_string(),
                });
            }
        };
    }
    Ok(certificates)
}

async fn get_pektin_domains() -> anyhow::Result<Vec<String>> {
    let vault_token = vault_k8s_login(true).await?.client_token;
    let client = new_reqwest_client().await?;
    let config = get_current_config_cloned!(config());
    let resp = client
        .post(format!("{}/search", config.pektin_api_endpoint))
        //.header("Authorization", &pektin_auth.perimeter_auth)
        .header("content-type", "application/json")
        .body(
            json!({
                "client_username": config.pektin_username,
                "client_token": vault_token,
                "globs": [
                        {
                            "name_glob": "*",
                            "rr_type_glob": "SOA"
                        }
                    ]
            })
            .to_string(),
        )
        .send()
        .await?;

    let text = resp.text().await?;
    #[derive(Debug, Clone, Deserialize)]
    pub struct PektinSearchResponse {
        pub data: Vec<PektinSearchResult>,
    }
    #[derive(Debug, Clone, Deserialize)]
    pub struct PektinSearchResult {
        pub data: Vec<PektinSearchData>,
    }
    #[derive(Debug, Clone, Deserialize)]
    pub struct PektinSearchData {
        pub name: String,
    }

    let resp: PektinSearchResponse = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => {
            bail!(
                "failed to parse pektin search response: {} \ntext was: {}",
                e,
                text
            );
        }
    };

    let mut domains: Vec<String> = vec![];
    for result in &resp.data[0].data {
        domains.push(de_absolute(&result.name));
    }
    Ok(domains)
}

pub fn de_absolute(input: &str) -> String {
    if input.ends_with('.') {
        input[0..input.len() - 1].to_string()
    } else {
        input.to_string()
    }
}
