use anyhow::bail;
use lib::{
    types::{Identifier, UserChallenges},
    AcmeClient,
};
use p256::ecdsa::SigningKey;
use rand_core::OsRng;
use serde::Deserialize;
use serde_json::{json, Value};
use std::vec;
use zertificat::{
    config::{get_config, Config, Pc3},
    types::{MaybeVaultCert, PektinConfig, VaultCert, VaultCertInfo},
    vault::{get_kv_value, login_userpass, update_kv_value},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = get_config()?;

    // TODO: option to send a wake up call to run the procedure

    // daily procedure to see if there is something to do
    loop {
        match run_procedure(&config).await {
            Ok(_) => {
                println!("procedure executed successfully");
            }
            Err(e) => {
                println!("procedure failed:\n{e}");
            }
        };
        std::thread::sleep(std::time::Duration::from_secs(10));
    }
}

async fn run_procedure(config: &Config) -> anyhow::Result<()> {
    if config.mode == "vault" {
        Ok(run_vault_procedure(config).await?)
    } else {
        bail!("mode not implemented");
    }
}

async fn run_vault_procedure(config: &Config) -> anyhow::Result<()> {
    // get certificate config from vault
    let domains = get_pektin_domains(&config.pektin_auth).await?;
    let vault_token = login_userpass(&config.url, &config.username, &config.password).await?;
    let certificates = get_certificates(&domains, config, &vault_token).await?;
    let pektin_config =
        get_kv_value(&config.url, &vault_token, "pektin-kv", "pektin-config").await?;
    // check certificate presence in vault
    for cert in certificates {
        if cert.cert.is_none() || cert.key.is_none() || cert.info.is_none() {
            // generate new certificate
            let cert = generate_certificate(&cert.domain, config, &pektin_config).await?;
            // set cert in vault
            update_kv_value(
                &config.url,
                &vault_token,
                "pektin-zertificat",
                &cert.domain,
                &cert,
            )
            .await?;
        } else {
            let cert = VaultCert {
                cert: cert.cert.unwrap().to_string(),
                key: cert.key.unwrap().to_string(),
                info: match serde_json::from_value(cert.info.unwrap()) {
                    Ok(info) => info,
                    Err(e) => {
                        bail!("failed to deserialize VaultCert info: {}", e);
                    }
                },
                domain: cert.domain,
            };
            let current_time = chrono::offset::Utc::now().timestamp_millis() / 1000;
            let sixty_days_secs = 60 * 60 * 24 * 60;

            // check if certificate has expired
            if current_time > cert.info.created + sixty_days_secs {
                // generate new certificate
                let cert = generate_certificate(&cert.domain, config, &pektin_config).await?;
                // set cert in vault
                update_kv_value(
                    &config.url,
                    &vault_token,
                    "pektin-zertificat",
                    &cert.domain,
                    &cert,
                )
                .await?;
            }
        }
    }

    Ok(())
}

pub async fn generate_certificate(
    domain: &str,
    config: &Config,
    pektin_config: &Value,
) -> anyhow::Result<VaultCert> {
    println!("generating certificate for {}", domain);
    let communication_signing_key = SigningKey::random(&mut OsRng);
    let mut pc: PektinConfig = match serde_json::from_value(pektin_config.clone()) {
        Ok(pc) => pc,
        Err(e) => bail!("could not deserialize pektin config: {}", e),
    };

    if pc.services.zertificat.use_pebble {
        pc.services.zertificat.acme_endpoint = "https://pektin-pebble:14000/dir".to_string();
    }

    let mut client = AcmeClient::new(
        &pc.services.zertificat.acme_endpoint,
        &communication_signing_key,
        &pc.services.zertificat.acme_email,
    )
    .await?;

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

    let cert = client.create_certificate_with_defaults(&identifiers)?;

    let signed_cert = client
        .sign_certificate(&cert, &identifiers, |user_challenges| {
            handle_challenges_with_pektin(user_challenges, &config.pektin_auth)
        })
        .await?;
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

pub async fn handle_challenges_with_pektin(
    user_challenges: UserChallenges,
    pektin_auth: &Pc3,
) -> anyhow::Result<Vec<String>> {
    println!("setting following challenges to pektin");
    println!("{:#?}", user_challenges);

    set_pektin_record(pektin_auth, &user_challenges).await?;
    let mut fulfilled = Vec::new();
    for challenge in user_challenges.dns {
        fulfilled.push(challenge.url.to_string());
    }
    std::thread::sleep(std::time::Duration::from_secs(10));
    Ok(fulfilled)
}

async fn set_pektin_record(pektin_auth: &Pc3, challenge: &UserChallenges) -> anyhow::Result<()> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/set",
            pektin_auth.override_params.pektin_api_endpoint
        ))
        .header("Authorization", &pektin_auth.perimeter_auth)
        .header("content-type", "application/json")
        .body(
            json!({
                "client_username": pektin_auth.username,
                "confidant_password": pektin_auth.confidant_password,
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
        bail!("failed to set pektin record");
    }
    Ok(())
}

async fn get_certificates(
    domains: &Vec<String>,
    config: &Config,
    vault_token: &str,
) -> anyhow::Result<Vec<MaybeVaultCert>> {
    let mut certificates = vec![];
    for domain in domains {
        match get_kv_value(&config.url, vault_token, "pektin-zertificat", domain).await {
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

async fn get_pektin_domains(pektin_auth: &Pc3) -> anyhow::Result<Vec<String>> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!(
            "{}/search",
            pektin_auth.override_params.pektin_api_endpoint
        ))
        .header("Authorization", &pektin_auth.perimeter_auth)
        .header("content-type", "application/json")
        .body(
            json!({
                "client_username": pektin_auth.username,
                "confidant_password": pektin_auth.confidant_password,
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
        pub rr_type: String,
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
