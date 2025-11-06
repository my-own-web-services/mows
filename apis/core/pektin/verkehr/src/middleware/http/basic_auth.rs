use crate::routing_config::BasicAuth;
use super::{MiddlewareError, ok_or_internal_error, true_or_internal_error};
use http::{header::HeaderName, HeaderValue, Request, Response};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use std::str::{from_utf8, FromStr};

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: BasicAuth,
) -> Result<(), MiddlewareError> {
    let users = &arg.users;
    let default_header_field = "Authorization".to_string();
    let default_realm = "".to_string();
    let header_field = match req.headers().get(
        arg.custom_auth_field
            .as_ref()
            .unwrap_or(&default_header_field),
    ) {
        Some(h) => h,
        None => {
            return Err(MiddlewareError::Default {
                res: Response::builder()
                    .status(401)
                    .header(
                        "WWW-Authenticate",
                        format!(
                            r#"Basic realm="{}", charset="UTF-8""#,
                            &arg.realm.as_ref().unwrap_or(&default_realm)
                        ),
                    )
                    .body(
                        Full::new(Bytes::from("Missing Basic Auth"))
                            .map_err(|never| match never {})
                            .boxed(),
                    )
                    .unwrap(),
            })
        }
    };
    let user_sent_auth = ok_or_internal_error!(header_field.to_str());
    let mut any_user_valid = false;
    for user in users {
        if let (Some(username), true) = check_user_basic_auth(user, user_sent_auth) {
            any_user_valid = true;
            if let Some(header_field) = &arg.header_field {
                req.headers_mut().insert(
                    ok_or_internal_error!(HeaderName::from_str(header_field)),
                    ok_or_internal_error!(HeaderValue::from_str(&username)),
                );
            }
            break;
        }
    }
    true_or_internal_error!(any_user_valid);
    Ok(())
}

fn check_user_basic_auth(config_user_pass: &str, header_field: &str) -> (Option<String>, bool) {
    // request provided
    let user_pass_b64 = if header_field.starts_with("Basic ") {
        header_field.replace("Basic ", "")
    } else {
        return (None, false);
    };

    let user_pass_vec = match data_encoding::BASE64.decode(user_pass_b64.as_bytes()) {
        Ok(v) => v,
        Err(_) => return (None, false),
    };

    let user_pass = match from_utf8(&user_pass_vec) {
        Ok(val) => val,
        Err(_) => return (None, false),
    };

    let (req_username, req_password) = if let Some(user_pass_split) = user_pass.split_once(':') {
        user_pass_split
    } else {
        return (None, false);
    };

    // config provided

    let (config_username, config_password_to_be_decoded) =
        if let Some(config_user_pass) = config_user_pass.split_once(':') {
            config_user_pass
        } else {
            return (None, false);
        };

    if config_username != req_username {
        return (None, false);
    }
    // username is correct, now check password

    // get hashing algorithm from config
    if config_password_to_be_decoded.starts_with("$2y$") {
        let repl = config_password_to_be_decoded.replace("$2y$", "");
        let (cost_str, pw_b64) = match repl.split_once('$') {
            Some(v) => v,
            None => return (None, false),
        };
        let cost = match cost_str.parse::<u32>() {
            Ok(v) => v,
            Err(_) => return (None, false),
        };

        let config_pw_hashed_vec = match data_encoding::BASE64.decode(pw_b64.as_bytes()) {
            Ok(v) => v,
            Err(_) => return (None, false),
        };
        let req_pw_hashed = match bcrypt::hash(req_password, cost) {
            Ok(v) => v,
            Err(_) => return (None, false),
        };
        let config_pw_hashed = match from_utf8(&config_pw_hashed_vec) {
            Ok(v) => v,
            Err(_) => return (None, false),
        };
        if config_pw_hashed == req_pw_hashed {
            return (Some(config_username.to_string()), true);
        };
    } else if config_password_to_be_decoded.starts_with("{SHA}") {
        let config_pw_hashed = match data_encoding::BASE64.decode(
            config_password_to_be_decoded
                .replace("{SHA}", "")
                .as_bytes(),
        ) {
            Ok(v) => v,
            Err(_) => return (None, false),
        };
        use sha1::{Digest, Sha1};

        let mut hasher = Sha1::new();
        hasher.update(req_password.as_bytes());

        let req_pw_hashed = hasher.finalize();
        if config_pw_hashed[..] == req_pw_hashed[..] {
            return (Some(config_username.to_string()), true);
        };
    } else if config_password_to_be_decoded.starts_with("$apr1$") {
        let config_pw_hashed = match data_encoding::BASE64.decode(
            config_password_to_be_decoded
                .replace("$apr1$", "")
                .as_bytes(),
        ) {
            Ok(v) => v,
            Err(_) => return (None, false),
        };
        use md5::{Digest, Md5};

        let mut hasher = Md5::new();
        hasher.update(req_password.as_bytes());

        let req_pw_hashed = hasher.finalize();
        if config_pw_hashed[..] == req_pw_hashed[..] {
            return (Some(config_username.to_string()), true);
        };
    }
    (None, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use http::Request;
    use hyper::body::Incoming;

    #[test]
    fn test_check_user_basic_auth_valid_sha() {
        let auth_header = "Basic dGVzdDp0ZXN0"; // test:test

        // SHA1 hash of "test" = a94a8fe5ccb19ba61c4c0873d391e987982fbbd3
        let (username, valid) = check_user_basic_auth(
            "test:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=",
            auth_header,
        );

        assert_eq!(valid, true);
        assert_eq!(username, Some("test".to_string()));
    }

    #[test]
    fn test_check_user_basic_auth_wrong_username() {
        let auth_header = "Basic d3Jvbmc6dGVzdA=="; // wrong:test
        let (username, valid) = check_user_basic_auth(
            "test:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=",
            auth_header,
        );

        assert_eq!(valid, false);
        assert_eq!(username, None);
    }

    #[test]
    fn test_check_user_basic_auth_no_basic_prefix() {
        let auth_header = "dGVzdDp0ZXN0"; // Missing "Basic " prefix
        let (username, valid) = check_user_basic_auth(
            "test:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=",
            auth_header,
        );

        assert_eq!(valid, false);
        assert_eq!(username, None);
    }

    #[test]
    fn test_check_user_basic_auth_no_colon_in_credentials() {
        let auth_header = "Basic dGVzdA=="; // "test" without colon
        let (username, valid) = check_user_basic_auth(
            "test:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=",
            auth_header,
        );

        assert_eq!(valid, false);
        assert_eq!(username, None);
    }

    // Integration tests with actual HTTP requests
    use crate::routing_config::HttpMiddleware;
    use crate::middleware_http::handle_middleware_incoming;
    use hyper::service::service_fn;
    use hyper::server::conn::http1;
    use hyper_util::rt::TokioIo;
    use tokio::net::TcpListener;
    use http::{Response as HttpResponse, StatusCode};
    use http_body_util::{BodyExt, Full};
    use std::convert::Infallible;

    async fn test_service_basic_auth(
        mut req: Request<Incoming>,
        users: Vec<String>,
        header_field: Option<String>,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::BasicAuth(BasicAuth {
            users,
            users_file: None,
            custom_auth_field: None,
            realm: Some("Test Realm".to_string()),
            header_field: header_field.clone(),
            remove_header: None,
        });

        match handle_middleware_incoming(&mut req, vec![middleware]).await {
            Ok(_) => {
                // Authentication successful, return the username from header if set
                let mut response_body = "Authenticated".to_string();
                if let Some(field) = header_field {
                    if let Some(username_val) = req.headers().get(&field) {
                        response_body = format!("User: {}", username_val.to_str().unwrap_or(""));
                    }
                }
                Ok(HttpResponse::builder()
                    .status(StatusCode::OK)
                    .body(Full::new(Bytes::from(response_body)))
                    .unwrap())
            }
            Err(crate::middleware_http::MiddlewareError::Default { res }) => {
                // Authentication failed, collect the body and return the error response
                let (parts, body) = res.into_parts();
                let body_bytes = body.collect().await.unwrap().to_bytes();
                Ok(HttpResponse::from_parts(parts, Full::new(body_bytes)))
            }
        }
    }

    #[tokio::test]
    async fn test_basic_auth_integration_valid_credentials() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // SHA1 hash of "test" = a94a8fe5ccb19ba61c4c0873d391e987982fbbd3
        let users = vec!["testuser:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let users = users.clone();
                async move { test_service_basic_auth(req, users, None).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // testuser:test in base64
        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .header("Authorization", "Basic dGVzdHVzZXI6dGVzdA==")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        let response_text = response.text().await.unwrap();
        assert_eq!(response_text, "Authenticated");

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_basic_auth_integration_invalid_credentials() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let users = vec!["testuser:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let users = users.clone();
                async move { test_service_basic_auth(req, users, None).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // testuser:wrongpassword in base64
        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .header("Authorization", "Basic dGVzdHVzZXI6d3JvbmdwYXNzd29yZA==")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 500); // Internal error from middleware

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_basic_auth_integration_missing_header() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let users = vec!["testuser:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let users = users.clone();
                async move { test_service_basic_auth(req, users, None).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 401);
        assert_eq!(
            response.headers().get("www-authenticate").unwrap(),
            "Basic realm=\"Test Realm\", charset=\"UTF-8\""
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_basic_auth_integration_with_header_field() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let users = vec!["testuser:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let users = users.clone();
                async move {
                    test_service_basic_auth(req, users, Some("X-Authenticated-User".to_string()))
                        .await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .header("Authorization", "Basic dGVzdHVzZXI6dGVzdA==")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        let response_text = response.text().await.unwrap();
        assert_eq!(response_text, "User: testuser");

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_basic_auth_integration_multiple_users() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // Multiple users with SHA1 hashes
        // test = a94a8fe5ccb19ba61c4c0873d391e987982fbbd3
        // admin = d033e22ae348aeb5660fc2140aec35850c4da997
        let users = vec![
            "testuser:{SHA}qUqP5cyxm6YcTAhz05Hph5gvu9M=".to_string(),
            "admin:{SHA}0DPiKuNIrrVmD8IUCuw1hQxNqZc=".to_string(),
        ];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let users = users.clone();
                async move {
                    test_service_basic_auth(req, users, Some("X-Authenticated-User".to_string()))
                        .await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Test with admin:admin
        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .header("Authorization", "Basic YWRtaW46YWRtaW4=")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        let response_text = response.text().await.unwrap();
        assert_eq!(response_text, "User: admin");

        server_handle.abort();
    }
}
