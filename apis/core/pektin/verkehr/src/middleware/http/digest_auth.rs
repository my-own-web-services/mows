use super::{ok_or_internal_error, MiddlewareError};
use crate::routing_config::DigestAuth;
use data_encoding::HEXLOWER;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use md5::{Digest, Md5};

pub fn handle_incoming(req: &mut Request<Incoming>, arg: DigestAuth) -> Result<(), MiddlewareError> {
    // Get Authorization header
    let auth_header = if let Some(custom_field) = &arg.header_field {
        req.headers().get(custom_field)
    } else {
        req.headers().get("Authorization")
    };

    if let Some(auth_value) = auth_header {
        if let Ok(auth_str) = auth_value.to_str() {
            // Parse Digest authentication
            if auth_str.starts_with("Digest ") {
                let credentials = &auth_str[7..];

                // Parse digest parameters
                let params = parse_digest_params(credentials);

                if let Some(username) = params.get("username") {
                    // Find matching user
                    for user_entry in &arg.users {
                        if check_user_digest_auth(user_entry, &params, req.method().as_str(), req.uri().path()) {
                            // Set header with username if configured
                            if let Some(header_field) = &arg.header_field {
                                req.headers_mut().insert(
                                    ok_or_internal_error!(http::header::HeaderName::from_bytes(header_field.as_bytes())),
                                    ok_or_internal_error!(http::header::HeaderValue::from_str(username)),
                                );
                            }

                            // Remove auth header if configured
                            if arg.remove_header.unwrap_or(false) {
                                req.headers_mut().remove("Authorization");
                            }

                            return Ok(());
                        }
                    }
                }
            }
        }
    }

    // Authentication failed - send challenge
    let realm = arg.realm.as_deref().unwrap_or("Restricted");
    let nonce = generate_nonce();

    let challenge = format!(
        "Digest realm=\"{}\", qop=\"auth\", nonce=\"{}\", algorithm=MD5",
        realm, nonce
    );

    return Err(MiddlewareError::Default {
        res: Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header("WWW-Authenticate", challenge)
            .body(
                Full::new(Bytes::from("Unauthorized"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap(),
    });
}

fn parse_digest_params(credentials: &str) -> std::collections::HashMap<String, String> {
    let mut params = std::collections::HashMap::new();

    for part in credentials.split(',') {
        let part = part.trim();
        if let Some(eq_pos) = part.find('=') {
            let key = part[..eq_pos].trim();
            let mut value = part[eq_pos + 1..].trim();

            // Remove quotes
            if value.starts_with('"') && value.ends_with('"') {
                value = &value[1..value.len() - 1];
            }

            params.insert(key.to_string(), value.to_string());
        }
    }

    params
}

fn check_user_digest_auth(
    user_entry: &str,
    params: &std::collections::HashMap<String, String>,
    method: &str,
    uri: &str,
) -> bool {
    // Parse user entry: username:realm:password_hash
    let parts: Vec<&str> = user_entry.split(':').collect();
    if parts.len() < 3 {
        return false;
    }

    let expected_username = parts[0];
    let _realm = parts[1];
    let expected_ha1 = parts[2]; // MD5(username:realm:password)

    // Check username matches
    if let Some(username) = params.get("username") {
        if username != expected_username {
            return false;
        }
    } else {
        return false;
    }

    // Get other required parameters
    let nonce = params.get("nonce").map(|s| s.as_str()).unwrap_or("");
    let response = params.get("response").map(|s| s.as_str()).unwrap_or("");
    let qop = params.get("qop").map(|s| s.as_str());
    let nc = params.get("nc").map(|s| s.as_str());
    let cnonce = params.get("cnonce").map(|s| s.as_str());

    // Calculate HA2 = MD5(method:uri)
    let ha2_input = format!("{}:{}", method, uri);
    let ha2 = format!("{:x}", Md5::digest(ha2_input.as_bytes()));

    // Calculate expected response
    let expected_response = if let Some(qop_val) = qop {
        if qop_val == "auth" || qop_val == "auth-int" {
            // response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
            let response_input = format!(
                "{}:{}:{}:{}:{}:{}",
                expected_ha1,
                nonce,
                nc.unwrap_or(""),
                cnonce.unwrap_or(""),
                qop_val,
                ha2
            );
            format!("{:x}", Md5::digest(response_input.as_bytes()))
        } else {
            return false;
        }
    } else {
        // response = MD5(HA1:nonce:HA2)
        let response_input = format!("{}:{}:{}", expected_ha1, nonce, ha2);
        format!("{:x}", Md5::digest(response_input.as_bytes()))
    };

    expected_response == response
}

fn generate_nonce() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let nonce_input = format!("{}:secret", timestamp);
    HEXLOWER.encode(&Md5::digest(nonce_input.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_digest_params() {
        let credentials = r#"username="test", realm="testrealm", nonce="abc123", uri="/", response="def456""#;
        let params = parse_digest_params(credentials);

        assert_eq!(params.get("username").unwrap(), "test");
        assert_eq!(params.get("realm").unwrap(), "testrealm");
        assert_eq!(params.get("nonce").unwrap(), "abc123");
    }

    #[test]
    fn test_generate_nonce() {
        let nonce1 = generate_nonce();
        let nonce2 = generate_nonce();

        // Nonces should be hex strings
        assert!(nonce1.len() > 0);
        assert!(nonce2.len() > 0);

        // Should be valid hex
        assert!(nonce1.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_check_user_digest_auth_invalid_format() {
        let user_entry = "invalid";
        let params = std::collections::HashMap::new();

        let result = check_user_digest_auth(user_entry, &params, "GET", "/");
        assert!(!result);
    }
}
