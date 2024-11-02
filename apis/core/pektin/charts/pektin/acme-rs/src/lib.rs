pub mod types;
pub mod utils;
use crate::{
    types::{Identifier, JsonWebKey, OrderResponse},
    utils::{create_certificate_signing_request_der, get_signed_body, get_user_agent},
};
use anyhow::{anyhow, bail};
use data_encoding::BASE64URL_NOPAD;
use p256::ecdsa::SigningKey;
use rcgen::{BasicConstraints, Certificate, CertificateParams, DnType, IsCa};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{future::Future, time::Duration};
use time::{ext::NumericalDuration, OffsetDateTime};
use types::{
    ChallengesResponse, CreatedAccountResponse, Directory, FinalizeResponse, UserChallenges,
};
use utils::compute_challenges;

pub struct AcmeClient {
    pub endpoint: String,
    pub directory: Directory,
    pub signing_key: SigningKey,
    pub account_key_id: String,
    pub nonce_list: Vec<String>,
    pub email: String,
    pub invalid_nonce_retry_count: u8,
    pub polled_ready: u8,
    pub polled_valid: u8,
}
#[cfg(feature = "insecurePebbleRoots")]
fn get_client() -> reqwest::ClientBuilder {
    use utils::get_pebble_cert;

    reqwest::Client::builder().danger_accept_invalid_certs(true)
}

#[cfg(feature = "acmeRsStd")]
fn get_client() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
}

#[cfg(all(feature = "acmeRsStd", feature = "insecurePebbleRoots"))]
compile_error!(
    "feature \"insecurePebbleRoots\" and feature \"acmeRsStd\" cannot be enabled at the same time"
);

impl AcmeClient {
    pub async fn new(
        endpoint: &str,
        signing_key: &SigningKey,
        email: &str,
    ) -> anyhow::Result<Self> {
        let directory = AcmeClient::get_directory(endpoint).await?;
        let invalid_nonce_retry_count = 10;

        // TODO check if account exists and use existing account if it does
        let account_key_id = retry_bad_nonce!(
            AcmeClient::create_account(endpoint, signing_key, email, &directory.new_account).await,
            invalid_nonce_retry_count
        );

        Ok(AcmeClient {
            endpoint: endpoint.to_string(),
            directory,
            signing_key: signing_key.clone(),
            account_key_id: account_key_id.key_id,
            nonce_list: Vec::new(),
            email: email.to_string(),
            invalid_nonce_retry_count,
            polled_ready: 0,
            polled_valid: 0,
        })
    }

    pub fn create_certificate_with_defaults(
        &self,
        identifiers: &Vec<Identifier>,
    ) -> anyhow::Result<Certificate> {
        let subject_alt_names = identifiers
            .iter()
            .map(|i| i.value.clone())
            .collect::<Vec<String>>();

        let mut params = CertificateParams::new(subject_alt_names);
        params
            .distinguished_name
            .push(DnType::CommonName, identifiers[0].value.clone());
        params.is_ca = IsCa::Ca(BasicConstraints::Constrained(0));
        params.not_before = OffsetDateTime::now_utc();
        params.not_after = match OffsetDateTime::now_utc().checked_add(90.days()) {
            Some(x) => x,
            None => bail!("Overflow when adding 90 days to current time"),
        };

        Ok(Certificate::from_params(params)?)
    }

    pub fn create_certificate_from_params(
        &self,
        params: CertificateParams,
    ) -> anyhow::Result<Certificate> {
        Ok(Certificate::from_params(params)?)
    }

    pub async fn sign_certificate<Fut>(
        &mut self,
        certificate: &Certificate,
        identifiers: &Vec<Identifier>,
        challenge_handler: impl Fn(UserChallenges) -> Fut,
    ) -> anyhow::Result<String>
    where
        Fut: Future<Output = anyhow::Result<Vec<String>>>,
    {
        println!("Submitting order");
        let order = retry_bad_nonce!(
            self.submit_order(identifiers).await,
            self.invalid_nonce_retry_count
        );
        println!("Submitted order");

        let order_location = &order.location.expect("Missing location to poll order from");

        println!("Getting challenges");
        let challenge_responses = self.fetch_challenges(order.authorizations.clone()).await?;
        println!("Got challenges");

        let challenges_to_be_solved = compute_challenges(challenge_responses, &self.signing_key)?;

        println!("Calling challenge handler");
        let fullfilled_challenges = challenge_handler(challenges_to_be_solved).await?;
        println!("Challenge handler succeeded");
        std::thread::sleep(std::time::Duration::from_secs(10));

        println!("Marking challenges fullfilled");
        self.mark_challenges_fullfilled(fullfilled_challenges.clone())
            .await?;

        // wait until the server tells us that the order is ready
        println!("Polling order for ready state");
        retry_bad_nonce!(
            self.poll_order_until_ready(order_location).await,
            self.invalid_nonce_retry_count
        );
        println!("Order is ready");
        println!("Finalizing order");
        retry_bad_nonce!(
            self.finalize_order(&order.finalize, certificate).await,
            self.invalid_nonce_retry_count
        );
        println!("Order Finalized");

        println!("Polling order for valid state");
        // wait until the server tells us that the order is
        let cert_url = retry_bad_nonce!(
            self.poll_order_until_valid(order_location).await,
            self.invalid_nonce_retry_count
        );
        println!("Order is valid");
        println!("Downloading certificate");
        let cert = retry_bad_nonce!(
            self.download_certificate(&cert_url).await,
            self.invalid_nonce_retry_count
        );
        println!("Certificate downloaded");

        Ok(cert)
    }

    async fn get_nonce_from_list(&mut self) -> anyhow::Result<String> {
        Ok(if self.nonce_list.is_empty() {
            AcmeClient::get_nonce(&self.endpoint).await?
        } else {
            match self.nonce_list.pop() {
                Some(nonce) => nonce,
                None => bail!("No nonces left in nonce list"),
            }
        })
    }

    async fn get_directory(endpoint: &str) -> anyhow::Result<Directory> {
        let res = get_client()
            .build()?
            .get(endpoint)
            .timeout(Duration::from_secs(4))
            .send()
            .await?;
        let body = res.text().await?;
        let directory: Directory = match serde_json::from_str(&body) {
            Ok(x) => x,
            Err(e) => {
                bail!("Could not parse directory response from acme server: body: {body} err:{e} ")
            }
        };

        Ok(directory)
    }

    async fn get_nonce(endpoint: &str) -> anyhow::Result<String> {
        let url = AcmeClient::get_directory(endpoint).await?.new_nonce;
        let res = get_client()
            .build()?
            .head(url)
            .timeout(Duration::from_secs(4))
            .send()
            .await?;

        Ok(match res.headers().get("replay-nonce") {
            Some(header) => match header.to_str() {
                Ok(s) => s.to_string(),
                Err(_) => return Err(anyhow!("replay-nonce header is not a valid string")),
            },
            None => return Err(anyhow!("No replay-nonce header found")),
        })
    }

    async fn create_account(
        endpoint: &str,
        signing_key: &SigningKey,
        email: &str,
        new_account_url: &str,
    ) -> anyhow::Result<CreatedAccountResponse> {
        let user_agent = get_user_agent();
        let nonce = AcmeClient::get_nonce(endpoint).await?;
        let url = new_account_url;

        let payload = BASE64URL_NOPAD.encode(
            json!({
              "termsOfServiceAgreed": true,
              "contact": [
                format!("mailto:{}",email),
              ]
            })
            .to_string()
            .as_bytes(),
        );

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(&nonce, url, &payload, signing_key, None))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;

        if res.status().is_client_error() {
            bail!("Error creating account: {}", res.text().await?)
        }

        let key_id = match res.headers().get("location") {
            Some(header) => match header.to_str() {
                Ok(s) => s.to_string(),
                Err(_) => return Err(anyhow!("location header is not a valid string")),
            },
            None => return Err(anyhow!("No location header found")),
        };

        let res_body = res.text().await?;

        #[derive(Deserialize, Serialize, Debug, Clone)]
        pub struct CreatedAccountResponseBody {
            status: String,
            #[serde(rename = "initialIp")]
            initital_ip: Option<String>,
            #[serde(rename = "createdAt")]
            created_at: Option<String>,
            contact: Vec<String>,
            key: JsonWebKey,
        }

        let account_body: CreatedAccountResponseBody = match serde_json::from_str(&res_body) {
            Ok(x) => x,
            Err(e) => {
                bail!("Could not parse create account response from acme server: body: {res_body} err:{e} ")
            }
        };

        Ok(CreatedAccountResponse {
            status: account_body.status,
            initital_ip: account_body.initital_ip,
            created_at: account_body.created_at,
            contact: account_body.contact,
            key: account_body.key,
            key_id,
        })
    }

    async fn submit_order(
        &mut self,
        identifiers: &Vec<Identifier>,
    ) -> anyhow::Result<OrderResponse> {
        let user_agent = get_user_agent();
        let nonce = self.get_nonce_from_list().await?;
        let url = &self.directory.new_order;

        let payload_string = json!({ "identifiers": identifiers }).to_string();
        let payload = BASE64URL_NOPAD.encode(payload_string.as_bytes());

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(
                &nonce,
                url,
                &payload,
                &self.signing_key,
                Some(&self.account_key_id),
            ))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;

        if res.status().is_client_error() {
            bail!("Error submitting order: {}", res.text().await?)
        }

        let location = match res.headers().get("location") {
            Some(header) => match header.to_str() {
                Ok(s) => Some(s.to_string()),
                Err(_) => None,
            },
            None => None,
        };
        let res_body = res.text().await?;

        #[derive(Deserialize, Serialize, Debug, Clone)]
        pub struct OrderResponseBody {
            pub status: String,
            pub expires: String,
            pub identifiers: Vec<Identifier>,
            pub authorizations: Vec<String>,
            pub finalize: String,
            pub certificate: Option<String>,
        }

        let order: OrderResponseBody = match serde_json::from_str(&res_body) {
            Ok(x) => x,
            Err(e) => {
                bail!("Could not parse order response from acme server: body: {res_body} err:{e} ")
            }
        };

        Ok(OrderResponse {
            status: order.status,
            expires: order.expires,
            identifiers: order.identifiers,
            authorizations: order.authorizations,
            finalize: order.finalize,
            certificate: order.certificate,
            location,
        })
    }

    async fn fetch_challenges(
        &mut self,
        authorization_urls: Vec<String>,
    ) -> anyhow::Result<Vec<ChallengesResponse>> {
        let mut challenge_responses = Vec::new();
        for url in authorization_urls {
            challenge_responses.push(retry_bad_nonce!(
                self.fetch_challenge(&url).await,
                self.invalid_nonce_retry_count
            ));
        }
        Ok(challenge_responses)
    }

    async fn fetch_challenge(&mut self, challenge_url: &str) -> anyhow::Result<ChallengesResponse> {
        let user_agent = get_user_agent();
        let nonce = self.get_nonce_from_list().await?;
        let url = challenge_url;

        let payload = "".to_string();

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(
                &nonce,
                url,
                &payload,
                &self.signing_key,
                Some(&self.account_key_id),
            ))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;

        if res.status().is_client_error() {
            bail!("Error fetching challenges: {}", res.text().await?)
        }

        let res_body = res.text().await?;

        let challenges: ChallengesResponse = match serde_json::from_str(&res_body) {
            Ok(x) => x,
            Err(e) => {
                bail!("Could not parse challenge response from acme server: body: {res_body} err:{e} ")
            }
        };

        Ok(challenges)
    }

    async fn mark_challenges_fullfilled(&mut self, urls: Vec<String>) -> anyhow::Result<()> {
        for url in urls {
            retry_bad_nonce!(
                self.mark_challenge_fullfilled(&url).await,
                self.invalid_nonce_retry_count
            )
        }
        Ok(())
    }

    // tell the issues that the challenge is completed and can be checked
    async fn mark_challenge_fullfilled(&mut self, challenge_url: &str) -> anyhow::Result<()> {
        let user_agent = get_user_agent();
        let nonce = self.get_nonce_from_list().await?;
        let url = challenge_url;

        let payload = BASE64URL_NOPAD.encode(json!({}).to_string().as_bytes());

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(
                &nonce,
                url,
                &payload,
                &self.signing_key,
                Some(&self.account_key_id),
            ))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;
        if res.status().is_client_error() {
            bail!("Error marking challenge fullfilled: {}", res.text().await?)
        }
        Ok(())
    }

    async fn finalize_order(
        &mut self,
        finalize_url: &str,
        certificate: &Certificate,
    ) -> anyhow::Result<FinalizeResponse> {
        let user_agent = get_user_agent();
        let nonce = self.get_nonce_from_list().await?;
        let url = finalize_url;

        let csr_der = create_certificate_signing_request_der(certificate)?;
        let payload_string = json!({
            "csr": BASE64URL_NOPAD.encode(&csr_der),
        })
        .to_string();
        let payload = BASE64URL_NOPAD.encode(payload_string.as_bytes());

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(
                &nonce,
                url,
                &payload,
                &self.signing_key,
                Some(&self.account_key_id),
            ))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;
        if res.status().is_client_error() {
            bail!("Error finalizing order: {}", res.text().await?)
        }
        let retry_after = match res.headers().get("retry-after") {
            Some(header) => match header.to_str() {
                Ok(s) => Some(s.to_string()),
                Err(_) => None,
            },
            None => None,
        };

        let res_body = res.text().await?;

        #[derive(Deserialize, Serialize, Debug, Clone)]
        pub struct FinalizeResponseBody {
            pub status: String,
            pub expires: String,
            pub authorizations: Vec<String>,
            pub identifiers: Vec<Identifier>,
            pub finalize: String,
            pub certificate: Option<String>,
        }

        let finalize: FinalizeResponseBody = match serde_json::from_str(&res_body) {
            Ok(x) => x,
            Err(e) => {
                bail!(
                    "Could not parse finalize response from acme server: body: {res_body} err:{e} "
                )
            }
        };

        Ok(FinalizeResponse {
            status: finalize.status,
            expires: finalize.expires,
            authorizations: finalize.authorizations,
            identifiers: finalize.identifiers,
            finalize: finalize.finalize,
            certificate: finalize.certificate,
            retry_after,
        })
    }

    async fn poll_order(&mut self, order_url: &str) -> anyhow::Result<OrderResponse> {
        let user_agent = get_user_agent();
        let nonce = self.get_nonce_from_list().await?;
        let url = order_url;

        let payload = "".to_string();

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(
                &nonce,
                url,
                &payload,
                &self.signing_key,
                Some(&self.account_key_id),
            ))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;

        if res.status().is_client_error() {
            bail!("Error polling order: {}", res.text().await?)
        }

        let res_body = res.text().await?;
        let order: OrderResponse = match serde_json::from_str(&res_body) {
            Ok(x) => x,
            Err(e) => {
                bail!("Could not parse order response from acme server: body: {res_body} err:{e} ")
            }
        };
        Ok(order)
    }

    async fn poll_order_until_valid(&mut self, order_url: &str) -> anyhow::Result<String> {
        let mut order = self.poll_order(order_url).await?;

        self.polled_valid += 1;
        println!("Polled until valid for the {} time", self.polled_valid);
        while order.status != "valid" {
            if self.polled_valid > 100 {
                bail!("Polled too many times, giving up");
            }
            dbg!(&order);
            order = self.poll_order(order_url).await?;
            self.polled_valid += 1;
            println!("Polled until valid for the {} time", self.polled_valid);
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        let certificate = match order.certificate {
            Some(cert) => cert,
            None => {
                return Err(anyhow!(
                    "Order is ready but no certificate was found in order"
                ))
            }
        };
        Ok(certificate)
    }

    async fn poll_order_until_ready(&mut self, order_url: &str) -> anyhow::Result<()> {
        let mut order = self.poll_order(order_url).await?;
        self.polled_ready += 1;
        println!("Polled until ready for the {} time", self.polled_ready);
        while order.status != "ready" {
            if self.polled_ready > 100 {
                bail!("Polled too many times, giving up");
            }
            order = self.poll_order(order_url).await?;
            self.polled_ready += 1;
            println!("Polled until ready for the {} time", self.polled_ready);
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        Ok(())
    }

    async fn download_certificate(&mut self, cert_url: &str) -> anyhow::Result<String> {
        let user_agent = get_user_agent();
        let nonce = self.get_nonce_from_list().await?;
        let url = cert_url;

        let payload = "".to_string();

        let res = get_client()
            .build()?
            .post(url)
            .header("Content-Type", "application/jose+json")
            .header("user-agent", user_agent)
            .body(get_signed_body(
                &nonce,
                url,
                &payload,
                &self.signing_key,
                Some(&self.account_key_id),
            ))
            .timeout(Duration::from_secs(4))
            .send()
            .await?;
        if res.status().is_client_error() {
            bail!("Error downloading certificate: {}", res.text().await?)
        }

        let res_body = res.text().await?;

        Ok(res_body)
    }
}
#[macro_export]
macro_rules! retry_bad_nonce {
    ($f:expr,$nonce:expr) => {{
        let mut i = 0;
        loop {
            let maybe = $f;
            match maybe {
                Ok(r) => {
                    break r;
                }
                Err(e) => {
                    dbg!(&e);
                    if e.to_string()
                        .contains("urn:ietf:params:acme:error:badNonce")
                        && i < $nonce
                    {
                        i += 1;
                        dbg!(i);
                        continue;
                    } else {
                        bail!(e);
                    }
                }
            }
        }
    }};
}