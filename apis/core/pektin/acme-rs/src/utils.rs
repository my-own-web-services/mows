use data_encoding::BASE64URL_NOPAD;
use p256::ecdsa::{signature::Signer, Signature, SigningKey, VerifyingKey};
use rcgen::Certificate;
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::types::{ChallengesResponse, JsonWebKey, UserChallenges, UserDnsChallenge};

pub fn get_jwk_from_signing_key(signing_key: &SigningKey) -> JsonWebKey {
    let verifying_key = VerifyingKey::from(signing_key).to_encoded_point(false);

    let x = BASE64URL_NOPAD.encode(verifying_key.x().unwrap());
    let y = BASE64URL_NOPAD.encode(verifying_key.y().unwrap());
    serde_json::from_value(json!({
        "kty": "EC",
        "crv": "P-256",
        "x": x,
        "y": y,
    }))
    .unwrap()
}

pub fn get_protected_with_signing_key(nonce: &str, url: &str, signing_key: &SigningKey) -> String {
    BASE64URL_NOPAD.encode(
        json!({
            "alg":"ES256",
            "jwk": get_jwk_from_signing_key(signing_key),
            "nonce":nonce,
            "url":url
        })
        .to_string()
        .as_bytes(),
    )
}

pub fn get_protected_with_account_key_id(nonce: &str, url: &str, account_key_id: &str) -> String {
    BASE64URL_NOPAD.encode(
        json!({
            "alg": "ES256",
            "kid": account_key_id,
            "nonce": nonce,
            "url": url
        })
        .to_string()
        .as_bytes(),
    )
}

pub fn get_signed_body(
    nonce: &str,
    url: &str,
    payload: &str,
    signing_key: &SigningKey,
    account_key_id: Option<&str>,
) -> String {
    let protected = if let Some(akid) = account_key_id {
        get_protected_with_account_key_id(nonce, url, akid)
    } else {
        get_protected_with_signing_key(nonce, url, signing_key)
    };

    let signature: Signature =
        signing_key.sign(format!("{}.{}", &protected, &payload.to_string()).as_bytes());

    let body = json!({
       "payload": payload,
       "protected": protected,
       "signature": BASE64URL_NOPAD.encode(&signature.to_vec())
    });
    body.to_string()
}

pub fn get_user_agent() -> String {
    "acme-rs-1.0".to_string()
}

pub fn compute_challenges(
    challenge_responses: Vec<ChallengesResponse>,
    signing_key: &SigningKey,
) -> anyhow::Result<UserChallenges> {
    let mut dns = Vec::new();

    for challenge_response in challenge_responses.iter() {
        for challenge in challenge_response.challenges.iter() {
            match challenge.challenge_type.as_str() {
                "dns-01" => {
                    dns.push(compute_dns_challenge(
                        &challenge.token,
                        signing_key,
                        &challenge_response.identifier.value,
                        &challenge.url,
                    )?);
                }
                _ => {
                    //anyhow::bail!("Unsupported challenge type: {}", challenge.challenge_type);
                }
            }
        }
    }

    Ok(UserChallenges { dns })
}

pub fn compute_dns_challenge(
    token: &str,
    signing_key: &SigningKey,
    name: &str,
    url: &str,
) -> anyhow::Result<UserDnsChallenge> {
    let key_authorization = compute_key_authorizations(token, signing_key);
    let mut hasher = Sha256::new();
    hasher.update(key_authorization);
    let key_authorization_hashed = hasher.finalize();
    Ok(UserDnsChallenge {
        name: format!("_acme-challenge.{}.", name),
        value: BASE64URL_NOPAD.encode(&key_authorization_hashed),
        url: url.to_string(),
    })
}

pub fn compute_key_authorizations(token: &str, signing_key: &SigningKey) -> String {
    let jwk = get_jwk_from_signing_key(signing_key);
    format!(
        "{}.{}",
        token,
        BASE64URL_NOPAD.encode(&compute_jwk_thumbprint(&jwk))
    )
}

// https://www.rfc-editor.org/rfc/rfc7638
pub fn compute_jwk_thumbprint(jwk: &JsonWebKey) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_string(jwk).unwrap().as_bytes());
    let result = hasher.finalize();
    result.to_vec()
}

pub fn get_pebble_cert() -> reqwest::Certificate {
    reqwest::Certificate::from_pem(
        r#"        
-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIIJOLbes8sTr4wDQYJKoZIhvcNAQELBQAwIDEeMBwGA1UE
AxMVbWluaWNhIHJvb3QgY2EgMjRlMmRiMCAXDTE3MTIwNjE5NDIxMFoYDzIxMTcx
MjA2MTk0MjEwWjAgMR4wHAYDVQQDExVtaW5pY2Egcm9vdCBjYSAyNGUyZGIwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC5WgZNoVJandj43kkLyU50vzCZ
alozvdRo3OFiKoDtmqKPNWRNO2hC9AUNxTDJco51Yc42u/WV3fPbbhSznTiOOVtn
Ajm6iq4I5nZYltGGZetGDOQWr78y2gWY+SG078MuOO2hyDIiKtVc3xiXYA+8Hluu
9F8KbqSS1h55yxZ9b87eKR+B0zu2ahzBCIHKmKWgc6N13l7aDxxY3D6uq8gtJRU0
toumyLbdzGcupVvjbjDP11nl07RESDWBLG1/g3ktJvqIa4BWgU2HMh4rND6y8OD3
Hy3H8MY6CElL+MOCbFJjWqhtOxeFyZZV9q3kYnk9CAuQJKMEGuN4GU6tzhW1AgMB
AAGjRTBDMA4GA1UdDwEB/wQEAwIChDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYB
BQUHAwIwEgYDVR0TAQH/BAgwBgEB/wIBADANBgkqhkiG9w0BAQsFAAOCAQEAF85v
d40HK1ouDAtWeO1PbnWfGEmC5Xa478s9ddOd9Clvp2McYzNlAFfM7kdcj6xeiNhF
WPIfaGAi/QdURSL/6C1KsVDqlFBlTs9zYfh2g0UXGvJtj1maeih7zxFLvet+fqll
xseM4P9EVJaQxwuK/F78YBt0tCNfivC6JNZMgxKF59h0FBpH70ytUSHXdz7FKwix
Mfn3qEb9BXSk0Q3prNV5sOV3vgjEtB4THfDxSz9z3+DepVnW3vbbqwEbkXdk3j82
2muVldgOUgTwK8eT+XdofVdntzU/kzygSAtAQwLJfn51fS1GvEcYGBc1bDryIqmF
p9BI7gVKtWSZYegicA==
-----END CERTIFICATE-----"#
            .as_bytes(),
    )
    .unwrap()
}

pub fn create_certificate_signing_request_der(cert: &Certificate) -> anyhow::Result<Vec<u8>> {
    match cert.serialize_request_der() {
        Ok(der) => Ok(der),
        Err(err) => Err(anyhow::anyhow!("{}", err)),
    }
}
