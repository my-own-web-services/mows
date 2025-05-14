#[macro_export]
macro_rules! some_or_bail {
    ( $option:expr, $message:expr ) => {{
        if let Some(val) = $option {
            val
        } else {
            anyhow::bail!($message)
        }
    }};
}

pub fn generate_id(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            *CHARSET.get(idx).unwrap() as char
        })
        .collect()
}
