#[cfg(test)]
mod tests {
    use filez_server_client::client::{ApiClient, AuthMethod};

    #[tokio::test]
    async fn test_api_client() {
        let client = ApiClient::new(
            "https://filez-server.vindelicorum.eu/".to_string(),
            None,
            None,
        );

        client.get_health().await.unwrap();
    }

}