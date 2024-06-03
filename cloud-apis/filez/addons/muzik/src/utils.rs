use std::{fs, path::Path};

use reqwest::Url;

use crate::config::SERVER_CONFIG;

pub async fn get_spotify_auth_url(state: &str) -> anyhow::Result<String> {
    let config = &SERVER_CONFIG;

    let redirect_uri = Url::parse(&config.spotify.redirect_uri)?.join("/spotify/finish_auth")?;

    let url = format!(
            "https://accounts.spotify.com/authorize?client_id={}&state={}&response_type=code&redirect_uri={}&scope=playlist-read-private%20playlist-read-collaborative",
            config.spotify.client_id,
            state,
            redirect_uri
        );
    Ok(url)
}

pub async fn get_saved_refresh_token(folder_path: &str) -> anyhow::Result<String> {
    let path = Path::new(folder_path).join("refresh_token");
    let token = fs::read_to_string(path)?;
    Ok(token)
}

pub fn generate_id() -> String {
    use rand::Rng;
    const CHARSET: &[u8; 16] = b"0123456789abcdef";
    const LEN: usize = 16;
    let mut rng = rand::thread_rng();

    (0..LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}
