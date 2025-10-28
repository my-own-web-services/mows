#[cfg(test)]
mod tests {
    use filez_server_client::client::ApiClient;

    #[tokio::test]
    async fn test_api_client() {
        let client = ApiClient::new(
            "https://filez-server.vindelicorum.eu/".to_string(),
            None,
            None,
            None,
        )
        .unwrap();

        client.get_health(true).await.unwrap();
    }
}
