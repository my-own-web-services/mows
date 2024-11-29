pub fn generate_id(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8; 62] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            *CHARSET.get(idx).unwrap() as char
        })
        .collect()
}
