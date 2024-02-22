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

#[macro_export]
macro_rules! get_current_config_cloned {
    () => {{
        let config_locked = CONFIG.read().await;
        let cfg = config_locked.clone();
        drop(config_locked);
        cfg
    }};
}
